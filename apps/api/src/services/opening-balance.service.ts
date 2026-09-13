import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, like, ne, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import {
  accountingPeriod,
  balancingAmount,
  parseRupiahToSen,
  rupiahToSen,
  senToRupiah,
  sumDebitCredit,
} from "@keuangan-apotek/shared";
import type { OpeningBalanceLine, SaveOpeningBalances } from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { accounts, journalLines, journals, openingBalances } from "../db/schema/index.js";
import { recordAudit } from "./audit.service.js";

type Db = SqliteClient["db"];

function assertOpeningBalanceCutoff(db: Db, cutoffDate: string) {
  const existingCutoffs = db
    .select({ cutoffDate: openingBalances.cutoffDate })
    .from(openingBalances)
    .groupBy(openingBalances.cutoffDate)
    .all()
    .map((row) => row.cutoffDate);
  if (existingCutoffs.some((existing) => existing !== cutoffDate)) {
    throw new Error(
      `Saldo awal hanya boleh memiliki satu tanggal cut-off (${existingCutoffs[0]}). Gunakan tanggal tersebut dan koreksi draft yang ada sebelum dikunci.`,
    );
  }
}

export function getOpeningBalanceCutoff(db: Db): string | null {
  return (
    db
      .select({ cutoffDate: openingBalances.cutoffDate })
      .from(openingBalances)
      .orderBy(asc(openingBalances.cutoffDate))
      .get()?.cutoffDate ?? null
  );
}

function toSen(value: string | number): number {
  if (typeof value === "number") return rupiahToSen(String(value));
  const normalized = value.trim();
  const thousandGroups = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized);
  return normalized.includes(",") || thousandGroups
    ? parseRupiahToSen(normalized)
    : rupiahToSen(normalized);
}

function openingRows(lines: readonly OpeningBalanceLine[]) {
  return lines.map((line) => ({
    ...line,
    debitAmount: toSen(line.debitAmount),
    creditAmount: toSen(line.creditAmount),
  }));
}

function assertOpeningBalancePostingAccounts(
  db: Db,
  rows: readonly { accountId: string; debitAmount: number; creditAmount: number }[],
) {
  const ids = rows
    .filter((row) => row.debitAmount > 0 || row.creditAmount > 0)
    .map((row) => row.accountId);
  if (ids.length === 0) return;
  const groups = db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(inArray(accounts.id, ids), eq(accounts.isGroup, true)))
    .all();
  if (groups.length > 0)
    throw new Error(
      `Akun grup tidak boleh memiliki saldo awal: ${groups.map((group) => group.id).join(", ")}`,
    );
}

export function calculateOpeningBalanceTotals(lines: readonly OpeningBalanceLine[]) {
  const rows = openingRows(lines);
  const totals = sumDebitCredit(
    rows.map((row) => ({ debit: row.debitAmount, credit: row.creditAmount })),
  );
  return {
    debitAmount: totals.debit.toNumber(),
    creditAmount: totals.credit.toNumber(),
    difference: totals.difference.toNumber(),
  };
}

export function autoBalanceOpeningBalances(
  lines: readonly OpeningBalanceLine[],
  equityAccountId: string,
): OpeningBalanceLine[] {
  const rows = openingRows(lines);
  const totals = sumDebitCredit(
    rows.map((row) => ({ debit: row.debitAmount, credit: row.creditAmount })),
  );
  if (totals.difference.isZero()) return lines.map((line) => ({ ...line }));

  const equity = rows.find((row) => row.accountId === equityAccountId);
  if (equity) {
    if (totals.difference.isPositive())
      equity.creditAmount = new Decimal(equity.creditAmount).plus(totals.difference).toNumber();
    else
      equity.debitAmount = new Decimal(equity.debitAmount)
        .plus(balancingAmount(totals.debit, totals.credit))
        .toNumber();
  } else {
    rows.push({
      accountId: equityAccountId,
      debitAmount: totals.difference.isNegative()
        ? balancingAmount(totals.debit, totals.credit).toNumber()
        : 0,
      creditAmount: totals.difference.isPositive() ? totals.difference.toNumber() : 0,
    });
  }

  return rows.map((row) => ({
    accountId: row.accountId,
    debitAmount: senToRupiah(row.debitAmount).toString(),
    creditAmount: senToRupiah(row.creditAmount).toString(),
    ...(row.notes ? { notes: row.notes } : {}),
  }));
}

export async function listAccounts(db: Db) {
  return db.select().from(accounts).orderBy(asc(accounts.code));
}

export async function getOpeningBalances(db: Db, cutoffDate: string) {
  assertOpeningBalanceCutoff(db, cutoffDate);
  const rows = db
    .select({
      id: openingBalances.id,
      cutoffDate: openingBalances.cutoffDate,
      accountId: accounts.id,
      code: accounts.code,
      name: accounts.name,
      parentId: accounts.parentId,
      classification: accounts.classification,
      normalBalance: accounts.normalBalance,
      level: accounts.level,
      isGroup: accounts.isGroup,
      debitAmount: sql<number>`coalesce(${openingBalances.debitAmount}, 0)`,
      creditAmount: sql<number>`coalesce(${openingBalances.creditAmount}, 0)`,
      notes: openingBalances.notes,
      isLocked: sql<boolean>`coalesce(${openingBalances.isLocked}, 0) = 1`,
    })
    .from(accounts)
    .leftJoin(
      openingBalances,
      and(eq(openingBalances.accountId, accounts.id), eq(openingBalances.cutoffDate, cutoffDate)),
    )
    .where(eq(accounts.isActive, true))
    .orderBy(asc(accounts.code))
    .all();

  // Saldo awal sudah direpresentasikan ulang oleh jurnal OPENING_BALANCE saat
  // dikunci. Hanya jurnal terposting non-pembuka yang ditambahkan agar saldo
  // berjalan tidak menghitung saldo awal dua kali.
  const movements = db
    .select({
      accountId: journalLines.accountId,
      debit: journalLines.debit,
      credit: journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journals, eq(journals.id, journalLines.journalId))
    .where(and(eq(journals.isPosted, true), ne(journals.sourceModule, "OPENING_BALANCE")))
    .all();
  const movementByAccount = new Map<string, Decimal>();
  for (const movement of movements) {
    const current = movementByAccount.get(movement.accountId) ?? new Decimal(0);
    movementByAccount.set(movement.accountId, current.plus(movement.debit).minus(movement.credit));
  }

  return rows.map((row) => {
    const debitBalance = new Decimal(row.debitAmount)
      .minus(row.creditAmount)
      .plus(movementByAccount.get(row.accountId) ?? 0);
    return {
      ...row,
      runningBalance: (row.normalBalance === "KREDIT"
        ? debitBalance.negated()
        : debitBalance
      ).toNumber(),
    };
  });
}

export async function saveOpeningBalances(db: Db, input: SaveOpeningBalances): Promise<void> {
  const rows = openingRows(input.lines);
  const totals = sumDebitCredit(
    rows.map((row) => ({ debit: row.debitAmount, credit: row.creditAmount })),
  );
  if (!totals.difference.isZero()) throw new Error("Saldo awal belum seimbang");
  assertOpeningBalancePostingAccounts(db, rows);

  db.transaction((tx) => {
    const otherCutoff = tx
      .select({ cutoffDate: openingBalances.cutoffDate })
      .from(openingBalances)
      .where(ne(openingBalances.cutoffDate, input.cutoffDate))
      .groupBy(openingBalances.cutoffDate)
      .get();
    if (otherCutoff) {
      const lockedOther = tx
        .select({ cutoffDate: openingBalances.cutoffDate })
        .from(openingBalances)
        .where(
          and(ne(openingBalances.cutoffDate, input.cutoffDate), eq(openingBalances.isLocked, true)),
        )
        .get();
      if (lockedOther)
        throw new Error(
          `Saldo awal pada tanggal ${lockedOther.cutoffDate} sudah dikunci dan tidak dapat diganti.`,
        );
      // An unlocked draft is still editable: changing the date moves the
      // draft instead of treating the date as a second opening-balance set.
      tx.delete(openingBalances).where(ne(openingBalances.cutoffDate, input.cutoffDate)).run();
    }
    const locked = tx
      .select({ id: openingBalances.id })
      .from(openingBalances)
      .where(
        and(eq(openingBalances.cutoffDate, input.cutoffDate), eq(openingBalances.isLocked, true)),
      )
      .get();
    if (locked) throw new Error("Saldo awal pada tanggal cut-off sudah dikunci");
    tx.delete(openingBalances).where(eq(openingBalances.cutoffDate, input.cutoffDate)).run();

    for (const row of rows) {
      tx.insert(openingBalances)
        .values({
          id: randomUUID(),
          cutoffDate: input.cutoffDate,
          accountId: row.accountId,
          debitAmount: row.debitAmount,
          creditAmount: row.creditAmount,
          notes: row.notes ?? null,
          isLocked: false,
        })
        .onConflictDoUpdate({
          target: [openingBalances.cutoffDate, openingBalances.accountId],
          set: {
            debitAmount: row.debitAmount,
            creditAmount: row.creditAmount,
            notes: row.notes ?? null,
          },
        })
        .run();
    }
    recordAudit(tx, {
      entityType: "OPENING_BALANCE",
      entityId: input.cutoffDate,
      action: "UPDATE",
      after: rows,
    });
  });
}

export function moveLockedOpeningBalance(db: Db, fromDate: string, toDate: string) {
  return db.transaction((tx) => {
    const rows = tx
      .select()
      .from(openingBalances)
      .where(eq(openingBalances.cutoffDate, fromDate))
      .all();
    if (rows.length === 0) throw new Error("Saldo awal tidak ditemukan");
    if (rows.some((row) => !row.isLocked))
      throw new Error("Saldo awal yang belum terkunci harus disimpan melalui formulir");

    const target = tx
      .select({ id: openingBalances.id })
      .from(openingBalances)
      .where(eq(openingBalances.cutoffDate, toDate))
      .get();
    if (target) throw new Error(`Sudah ada saldo awal pada tanggal ${toDate}`);

    const journal = tx
      .select()
      .from(journals)
      .where(and(eq(journals.sourceModule, "OPENING_BALANCE"), eq(journals.sourceId, fromDate)))
      .get();
    if (!journal) throw new Error("Jurnal pembuka saldo awal tidak ditemukan");

    tx.update(openingBalances)
      .set({ cutoffDate: toDate })
      .where(eq(openingBalances.cutoffDate, fromDate))
      .run();
    tx.update(journals)
      .set({
        entryDate: toDate,
        sourceId: toDate,
        referenceNo: `OPENING-${accountingPeriod(toDate)}`,
        memo: `Jurnal pembuka per ${toDate}`,
      })
      .where(eq(journals.id, journal.id))
      .run();
    recordAudit(tx, {
      entityType: "OPENING_BALANCE",
      entityId: toDate,
      action: "UPDATE",
      before: { cutoffDate: fromDate, journalId: journal.id },
      after: { cutoffDate: toDate, journalId: journal.id },
    });
    return { cutoffDate: toDate, journalNo: journal.journalNo };
  });
}

export async function lockOpeningBalance(db: Db, cutoffDate: string) {
  return db.transaction((tx) => {
    assertOpeningBalanceCutoff(tx as unknown as Db, cutoffDate);
    const rows = tx
      .select()
      .from(openingBalances)
      .where(eq(openingBalances.cutoffDate, cutoffDate))
      .all();
    if (rows.length === 0) throw new Error("Tidak ada saldo awal untuk dikunci");
    const totals = sumDebitCredit(
      rows.map((row) => ({ debit: row.debitAmount, credit: row.creditAmount })),
    );
    if (!totals.difference.isZero()) throw new Error("Saldo awal belum seimbang");
    assertOpeningBalancePostingAccounts(tx as unknown as Db, rows);

    const existing = tx
      .select()
      .from(journals)
      .where(and(eq(journals.sourceModule, "OPENING_BALANCE"), eq(journals.sourceId, cutoffDate)))
      .get();
    if (existing) {
      tx.update(openingBalances)
        .set({ isLocked: true })
        .where(eq(openingBalances.cutoffDate, cutoffDate))
        .run();
      return existing;
    }

    const period = accountingPeriod(cutoffDate);
    const prefix = `JU-${period}-`;
    const last = tx
      .select({ journalNo: journals.journalNo })
      .from(journals)
      .where(like(journals.journalNo, `${prefix}%`))
      .orderBy(sql`${journals.journalNo} DESC`)
      .get();
    const sequence = last ? Number(last.journalNo.slice(-4)) + 1 : 1;
    const journal = {
      id: randomUUID(),
      journalNo: `${prefix}${String(sequence).padStart(4, "0")}`,
      entryDate: cutoffDate,
      referenceNo: `OPENING-${period}`,
      sourceModule: "OPENING_BALANCE",
      sourceId: cutoffDate,
      memo: `Jurnal pembuka per ${cutoffDate}`,
      isPosted: true,
    } as const;
    tx.insert(journals).values(journal).run();

    let lineNumber = 1;
    for (const row of rows) {
      if (row.debitAmount > 0)
        tx.insert(journalLines)
          .values({
            id: randomUUID(),
            journalId: journal.id,
            lineNumber: lineNumber++,
            accountId: row.accountId,
            description: row.notes,
            debit: row.debitAmount,
            credit: 0,
          })
          .run();
      if (row.creditAmount > 0)
        tx.insert(journalLines)
          .values({
            id: randomUUID(),
            journalId: journal.id,
            lineNumber: lineNumber++,
            accountId: row.accountId,
            description: row.notes,
            debit: 0,
            credit: row.creditAmount,
          })
          .run();
    }
    tx.update(openingBalances)
      .set({ isLocked: true })
      .where(eq(openingBalances.cutoffDate, cutoffDate))
      .run();
    recordAudit(tx, {
      entityType: "JOURNAL",
      entityId: journal.id,
      action: "CREATE",
      after: { journal, lines: rows },
    });
    return journal;
  });
}
