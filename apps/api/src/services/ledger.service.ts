import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lte, like } from "drizzle-orm";
import { JournalEntrySchema, accountingPeriod, nowIsoInstant, parseRupiahToSen, rupiahToSen, sumDebitCredit } from "@keuangan-apotek/shared";
import type { JournalEntry, JournalLine, SourceModule } from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { accounts, journalLines, journals, openingBalances } from "../db/schema/index.js";

type Db = SqliteClient["db"];
type Executor = Pick<Db, "select" | "insert" | "update" | "delete">;

export type JournalEntryInput = JournalEntry & {
  sourceModule?: SourceModule;
  sourceId?: string;
  createdBy?: string;
};

export type JournalWithLines = {
  journal: typeof journals.$inferSelect;
  lines: Array<typeof journalLines.$inferSelect & { accountCode: string; accountName: string }>;
};

function amountToSen(value: string | number): number {
  if (typeof value === "number") return rupiahToSen(String(value));
  const normalized = value.trim();
  const thousandGroups = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized);
  return normalized.includes(",") || thousandGroups ? parseRupiahToSen(normalized) : rupiahToSen(normalized);
}

function parseEntry(input: JournalEntryInput): JournalEntry {
  const parsed = JournalEntrySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}

function assertPeriodOpen(db: Executor, entryDate: string): void {
  const locked = db.select({ id: openingBalances.id })
    .from(openingBalances)
    .where(and(gte(openingBalances.cutoffDate, entryDate), eq(openingBalances.isLocked, true)))
    .limit(1)
    .get();
  if (locked) throw new Error(`Periode ${entryDate} sudah dikunci`);
}

function validateAndConvertLines(lines: readonly JournalLine[]) {
  const converted = lines.map((line) => ({
    accountId: line.accountId,
    description: line.description?.trim() || null,
    debit: amountToSen(line.debit),
    credit: amountToSen(line.credit),
  }));
  const totals = sumDebitCredit(converted);
  if (!totals.difference.isZero()) throw new Error("Total debit dan kredit jurnal harus seimbang");
  if (converted.some((line) => (line.debit > 0 && line.credit > 0) || (line.debit === 0 && line.credit === 0))) {
    throw new Error("Setiap baris jurnal harus memiliki tepat satu sisi nominal");
  }
  return converted;
}

function assertAccounts(tx: Executor, lines: readonly ReturnType<typeof validateAndConvertLines>[number][]) {
  const ids = [...new Set(lines.map((line) => line.accountId))];
  const found = tx.select({ id: accounts.id, isActive: accounts.isActive }).from(accounts).where(inArray(accounts.id, ids)).all() as Array<{ id: string; isActive: boolean }>;
  const foundIds = new Set(found.filter((account) => account.isActive).map((account) => account.id));
  const missing = ids.filter((id) => !foundIds.has(id));
  if (missing.length > 0) throw new Error(`Akun tidak ditemukan atau tidak aktif: ${missing.join(", ")}`);
}

function nextJournalNo(tx: Executor, entryDate: string): string {
  const prefix = `JU-${accountingPeriod(entryDate)}-`;
  const last = tx.select({ journalNo: journals.journalNo })
    .from(journals)
    .where(like(journals.journalNo, `${prefix}%`))
    .orderBy(desc(journals.journalNo))
    .limit(1)
    .get() as { journalNo: string } | undefined;
  const sequence = last ? Number(last.journalNo.slice(-4)) + 1 : 1;
  if (!Number.isSafeInteger(sequence) || sequence > 9999) throw new Error(`Nomor jurnal periode ${accountingPeriod(entryDate)} sudah penuh`);
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export function createJournalEntry(db: Db, input: JournalEntryInput): JournalWithLines {
  const entry = parseEntry(input);
  return db.transaction((tx) => {
    assertPeriodOpen(tx, entry.entryDate);
    const lines = validateAndConvertLines(entry.lines);
    assertAccounts(tx, lines);
    const journal = {
      id: randomUUID(),
      journalNo: nextJournalNo(tx, entry.entryDate),
      entryDate: entry.entryDate,
      referenceNo: entry.referenceNo || null,
      sourceModule: input.sourceModule ?? "GENERAL",
      sourceId: input.sourceId ?? null,
      memo: entry.memo || null,
      isPosted: true,
      createdBy: input.createdBy ?? null,
      createdAt: nowIsoInstant(),
      updatedAt: nowIsoInstant(),
    } as const;
    tx.insert(journals).values(journal).run();
    tx.insert(journalLines).values(lines.map((line, index) => ({
      id: randomUUID(), journalId: journal.id, lineNumber: index + 1,
      accountId: line.accountId, description: line.description,
      debit: line.debit, credit: line.credit,
    }))).run();
    return getJournalById(tx, journal.id)!;
  });
}

export function listJournals(db: Db, filters: { startDate?: string; endDate?: string; sourceModule?: SourceModule } = {}) {
  const conditions = [];
  if (filters.startDate) conditions.push(gte(journals.entryDate, filters.startDate));
  if (filters.endDate) conditions.push(lte(journals.entryDate, filters.endDate));
  if (filters.sourceModule) conditions.push(eq(journals.sourceModule, filters.sourceModule));
  const rows = db.select().from(journals)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(journals.entryDate), desc(journals.journalNo)).all();
  return rows.map((journal) => {
    const lines = db.select({ debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines).where(eq(journalLines.journalId, journal.id)).all();
    const totals = sumDebitCredit(lines);
    return { ...journal, totalDebit: totals.debit.toNumber(), totalCredit: totals.credit.toNumber(), lineCount: lines.length };
  });
}

export function getJournalById(db: Executor, id: string): JournalWithLines | undefined {
  const journal = db.select().from(journals).where(eq(journals.id, id)).get();
  if (!journal) return undefined;
  const lines = db.select({
    id: journalLines.id, journalId: journalLines.journalId, lineNumber: journalLines.lineNumber,
    accountId: journalLines.accountId, description: journalLines.description,
    debit: journalLines.debit, credit: journalLines.credit,
    accountCode: accounts.code, accountName: accounts.name,
  }).from(journalLines).innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .where(eq(journalLines.journalId, id)).orderBy(asc(journalLines.lineNumber)).all();
  return { journal, lines };
}

export function updateJournal(db: Db, id: string, input: JournalEntryInput): JournalWithLines {
  const entry = parseEntry(input);
  return db.transaction((tx) => {
    const existing = tx.select().from(journals).where(eq(journals.id, id)).get();
    if (!existing) throw new Error("Jurnal tidak ditemukan");
    if (existing.sourceModule !== "GENERAL") throw new Error("Jurnal sistem tidak dapat diubah");
    if (existing.entryDate !== entry.entryDate) assertPeriodOpen(tx, existing.entryDate);
    assertPeriodOpen(tx, entry.entryDate);
    const lines = validateAndConvertLines(entry.lines);
    assertAccounts(tx, lines);
    tx.update(journals).set({ entryDate: entry.entryDate, referenceNo: entry.referenceNo || null, memo: entry.memo || null, updatedAt: nowIsoInstant() }).where(eq(journals.id, id)).run();
    tx.delete(journalLines).where(eq(journalLines.journalId, id)).run();
    tx.insert(journalLines).values(lines.map((line, index) => ({
      id: randomUUID(), journalId: id, lineNumber: index + 1,
      accountId: line.accountId, description: line.description,
      debit: line.debit, credit: line.credit,
    }))).run();
    return getJournalById(tx, id)!;
  });
}

export function deleteJournal(db: Db, id: string): void {
  db.transaction((tx) => {
    const existing = tx.select().from(journals).where(eq(journals.id, id)).get();
    if (!existing) throw new Error("Jurnal tidak ditemukan");
    if (existing.sourceModule !== "GENERAL") throw new Error("Jurnal sistem tidak dapat dihapus");
    assertPeriodOpen(tx, existing.entryDate);
    tx.delete(journals).where(eq(journals.id, id)).run();
  });
}
