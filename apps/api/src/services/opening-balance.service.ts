import { randomUUID } from "node:crypto";
import { and, asc, eq, like, ne, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import { accountingPeriod, balancingAmount, parseRupiahToSen, rupiahToSen, senToRupiah, sumDebitCredit } from "@keuangan-apotek/shared";
import type { OpeningBalanceLine, SaveOpeningBalances } from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { accounts, journalLines, journals, openingBalances } from "../db/schema/index.js";

type Db = SqliteClient["db"];

function toSen(value: string | number): number {
  if (typeof value === "number") return rupiahToSen(String(value));
  const normalized = value.trim();
  const thousandGroups = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized);
  return normalized.includes(",") || thousandGroups ? parseRupiahToSen(normalized) : rupiahToSen(normalized);
}

function openingRows(lines: readonly OpeningBalanceLine[]) {
  return lines.map((line) => ({
    ...line,
    debitAmount: toSen(line.debitAmount),
    creditAmount: toSen(line.creditAmount),
  }));
}

export function calculateOpeningBalanceTotals(lines: readonly OpeningBalanceLine[]) {
  const rows = openingRows(lines);
  const totals = sumDebitCredit(rows.map((row) => ({ debit: row.debitAmount, credit: row.creditAmount })));
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
  const totals = sumDebitCredit(rows.map((row) => ({ debit: row.debitAmount, credit: row.creditAmount })));
  if (totals.difference.isZero()) return lines.map((line) => ({ ...line }));

  const equity = rows.find((row) => row.accountId === equityAccountId);
  if (equity) {
    if (totals.difference.isPositive()) equity.creditAmount = new Decimal(equity.creditAmount).plus(totals.difference).toNumber();
    else equity.debitAmount = new Decimal(equity.debitAmount).plus(balancingAmount(totals.debit, totals.credit)).toNumber();
  } else {
    rows.push({
      accountId: equityAccountId,
      debitAmount: totals.difference.isNegative() ? balancingAmount(totals.debit, totals.credit).toNumber() : 0,
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
      debitAmount: sql<number>`coalesce(${openingBalances.debitAmount}, 0)`,
      creditAmount: sql<number>`coalesce(${openingBalances.creditAmount}, 0)`,
      notes: openingBalances.notes,
      isLocked: sql<boolean>`coalesce(${openingBalances.isLocked}, 0) = 1`,
    })
    .from(accounts)
    .leftJoin(openingBalances, and(eq(openingBalances.accountId, accounts.id), eq(openingBalances.cutoffDate, cutoffDate)))
    .where(eq(accounts.isActive, true))
    .orderBy(asc(accounts.code))
    .all();

  // Saldo awal sudah direpresentasikan ulang oleh jurnal OPENING_BALANCE saat
  // dikunci. Hanya jurnal terposting non-pembuka yang ditambahkan agar saldo
  // berjalan tidak menghitung saldo awal dua kali.
  const movements = db
    .select({ accountId: journalLines.accountId, debit: journalLines.debit, credit: journalLines.credit })
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
      runningBalance: (row.normalBalance === "KREDIT" ? debitBalance.negated() : debitBalance).toNumber(),
    };
  });
}

export async function saveOpeningBalances(db: Db, input: SaveOpeningBalances): Promise<void> {
  const rows = openingRows(input.lines);
  const totals = sumDebitCredit(rows.map((row) => ({ debit: row.debitAmount, credit: row.creditAmount })));
  if (!totals.difference.isZero()) throw new Error("Saldo awal belum seimbang");

  db.transaction((tx) => {
    const locked = tx.select({ id: openingBalances.id }).from(openingBalances)
      .where(and(eq(openingBalances.cutoffDate, input.cutoffDate), eq(openingBalances.isLocked, true))).get();
    if (locked) throw new Error("Saldo awal pada tanggal cut-off sudah dikunci");
    tx.delete(openingBalances).where(eq(openingBalances.cutoffDate, input.cutoffDate)).run();

    for (const row of rows) {
      tx.insert(openingBalances).values({
        id: randomUUID(),
        cutoffDate: input.cutoffDate,
        accountId: row.accountId,
        debitAmount: row.debitAmount,
        creditAmount: row.creditAmount,
        notes: row.notes ?? null,
        isLocked: false,
      }).onConflictDoUpdate({
        target: [openingBalances.cutoffDate, openingBalances.accountId],
        set: { debitAmount: row.debitAmount, creditAmount: row.creditAmount, notes: row.notes ?? null },
      }).run();
    }
  });
}

export async function lockOpeningBalance(db: Db, cutoffDate: string) {
  return db.transaction((tx) => {
    const rows = tx.select().from(openingBalances).where(eq(openingBalances.cutoffDate, cutoffDate)).all();
    if (rows.length === 0) throw new Error("Tidak ada saldo awal untuk dikunci");
    const totals = sumDebitCredit(rows.map((row) => ({ debit: row.debitAmount, credit: row.creditAmount })));
    if (!totals.difference.isZero()) throw new Error("Saldo awal belum seimbang");

    const existing = tx.select().from(journals)
      .where(and(eq(journals.sourceModule, "OPENING_BALANCE"), eq(journals.sourceId, cutoffDate))).get();
    if (existing) {
      tx.update(openingBalances).set({ isLocked: true }).where(eq(openingBalances.cutoffDate, cutoffDate)).run();
      return existing;
    }

    const period = accountingPeriod(cutoffDate);
    const prefix = `JU-${period}-`;
    const last = tx.select({ journalNo: journals.journalNo }).from(journals)
      .where(like(journals.journalNo, `${prefix}%`)).orderBy(sql`${journals.journalNo} DESC`).get();
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
      if (row.debitAmount > 0) tx.insert(journalLines).values({
        id: randomUUID(), journalId: journal.id, lineNumber: lineNumber++, accountId: row.accountId,
        description: row.notes, debit: row.debitAmount, credit: 0,
      }).run();
      if (row.creditAmount > 0) tx.insert(journalLines).values({
        id: randomUUID(), journalId: journal.id, lineNumber: lineNumber++, accountId: row.accountId,
        description: row.notes, debit: 0, credit: row.creditAmount,
      }).run();
    }
    tx.update(openingBalances).set({ isLocked: true }).where(eq(openingBalances.cutoffDate, cutoffDate)).run();
    return journal;
  });
}
