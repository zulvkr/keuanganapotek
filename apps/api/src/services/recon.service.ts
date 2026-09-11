import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { BankReconMatchSchema, BankStatementImportSchema, BankStatementImportRowSchema, nowIsoInstant, parseRupiahToSen, rupiahToSen } from "@keuangan-apotek/shared";
import type { BankStatementImport, BankStatementImportRow } from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { accounts, bankReconMatches, bankStatements, journalLines, journals } from "../db/schema/index.js";

type Db = SqliteClient["db"];
type Executor = Pick<Db, "select" | "insert" | "update" | "delete">;

export type ReconInternalRow = {
  journalLineId: string;
  journalId: string;
  entryDate: string;
  description: string;
  referenceNo: string | null;
  debit: number;
  credit: number;
  isMatched: boolean;
  matchId: string | null;
  matchType: string | null;
};

export type ReconStatementRow = typeof bankStatements.$inferSelect & {
  matchId: string | null;
  journalLineId: string | null;
  matchType: string | null;
};

function amountToSen(value: string | number): number {
  if (typeof value === "number") return rupiahToSen(String(value));
  const normalized = value.trim().replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
  if (!normalized || ["-", "—"].includes(normalized)) return 0;
  if (normalized.includes(",") && normalized.includes(".")) {
    const canonical = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
    return rupiahToSen(canonical);
  }
  const commaGroups = /^\d{1,3}(?:,\d{3})+$/.test(normalized);
  const thousandGroups = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized);
  if (commaGroups) return rupiahToSen(normalized.replace(/,/g, ""));
  return normalized.includes(",") || thousandGroups ? parseRupiahToSen(normalized) : rupiahToSen(normalized);
}

function dateDistance(left: string, right: string): number {
  const leftMs = Date.parse(`${left}T00:00:00Z`);
  const rightMs = Date.parse(`${right}T00:00:00Z`);
  return Math.abs(leftMs - rightMs) / 86_400_000;
}

function normalizeDate(value: string): string {
  const trimmed = value.trim();
  const parts = trimmed.split(/[/.\-]/);
  if (parts.length === 3 && parts[0]!.length <= 2 && parts[2]!.length === 4) {
    return `${parts[2]}-${parts[1]!.padStart(2, "0")}-${parts[0]!.padStart(2, "0")}`;
  }
  if (parts.length === 3 && parts[0]!.length === 4) return `${parts[0]}-${parts[1]!.padStart(2, "0")}-${parts[2]!.padStart(2, "0")}`;
  return trimmed.slice(0, 10);
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ""; continue; }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function parseBankStatementCsv(csv: string): BankStatementImportRow[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV rekening koran harus memiliki header dan minimal satu baris data");
  const first = lines[0]!;
  const delimiter = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const headers = parseCsvLine(first, delimiter).map((header) => header.toLowerCase().replace(/[\s_./-]+/g, ""));
  const findHeader = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const dateIndex = findHeader(["tanggal", "tgl", "date", "transactiondate", "tanggaltransaksi"]);
  const descriptionIndex = findHeader(["keterangan", "deskripsi", "description", "remark", "memo"]);
  const debitIndex = findHeader(["debit", "db", "keluar", "debet", "withdrawal"]);
  const creditIndex = findHeader(["kredit", "credit", "cr", "masuk", "deposit"]);
  if (dateIndex < 0 || debitIndex < 0 || creditIndex < 0) throw new Error("Header CSV wajib memuat tanggal, debit, dan kredit");
  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line, delimiter);
    const debit = cells[debitIndex] || "0";
    const credit = cells[creditIndex] || "0";
    const parsed = BankStatementImportRowSchema.safeParse({ statementDate: normalizeDate(cells[dateIndex] || ""), description: descriptionIndex >= 0 ? cells[descriptionIndex] : undefined, debit, credit });
    if (!parsed.success) throw new Error(`Baris CSV ${index + 2} tidak valid: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`);
    return parsed.data;
  });
}

function mapMatchRows(db: Executor, statementRows: Array<typeof bankStatements.$inferSelect>): ReconStatementRow[] {
  if (statementRows.length === 0) return [];
  const matches = db.select().from(bankReconMatches).where(inArray(bankReconMatches.bankStatementId, statementRows.map((row) => row.id))).all();
  const byStatement = new Map(matches.map((match) => [match.bankStatementId, match]));
  return statementRows.map((row) => {
    const match = byStatement.get(row.id);
    return { ...row, matchId: match?.id ?? null, journalLineId: match?.journalLineId ?? null, matchType: match?.matchType ?? null };
  });
}

export function importBankStatements(db: Db, input: BankStatementImport): { imported: ReconStatementRow[] } {
  const parsed = BankStatementImportSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
  const account = db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, parsed.data.bankAccountId)).get();
  if (!account) throw new Error("Akun bank tidak ditemukan");
  const ids = db.transaction((tx) => {
    const created: string[] = [];
    for (const row of parsed.data.rows) {
      const debit = amountToSen(row.debit);
      const credit = amountToSen(row.credit);
      const id = randomUUID();
      tx.insert(bankStatements).values({ id, bankAccountId: parsed.data.bankAccountId, statementDate: row.statementDate, description: row.description?.trim() || null, debit, credit, isMatched: false, importedAt: nowIsoInstant() }).run();
      created.push(id);
    }
    return created;
  });
  const rows = db.select().from(bankStatements).where(inArray(bankStatements.id, ids)).orderBy(asc(bankStatements.statementDate)).all();
  return { imported: mapMatchRows(db, rows) };
}

export function importBankStatementCsv(db: Db, bankAccountId: string, csv: string) {
  return importBankStatements(db, { bankAccountId, rows: parseBankStatementCsv(csv) });
}

function getInternalRows(db: Executor, bankAccountId: string, includeMatched = true): ReconInternalRow[] {
  const conditions = [eq(journalLines.accountId, bankAccountId)];
  if (!includeMatched) conditions.push(isNull(bankReconMatches.id));
  const rows = db.select({
    journalLineId: journalLines.id,
    journalId: journals.id,
    entryDate: journals.entryDate,
    lineDescription: journalLines.description,
    memo: journals.memo,
    referenceNo: journals.referenceNo,
    debit: journalLines.debit,
    credit: journalLines.credit,
    matchId: bankReconMatches.id,
    matchType: bankReconMatches.matchType,
  }).from(journalLines)
    .innerJoin(journals, eq(journals.id, journalLines.journalId))
    .leftJoin(bankReconMatches, eq(bankReconMatches.journalLineId, journalLines.id))
    .where(and(...conditions))
    .orderBy(asc(journals.entryDate), asc(journalLines.lineNumber)).all();
  return rows.map((row) => ({ journalLineId: row.journalLineId, journalId: row.journalId, entryDate: row.entryDate, description: row.lineDescription || row.memo || "Mutasi jurnal", referenceNo: row.referenceNo, debit: row.debit, credit: row.credit, isMatched: Boolean(row.matchId), matchId: row.matchId, matchType: row.matchType }));
}

export function getReconData(db: Db, bankAccountId: string) {
  const account = db.select({ id: accounts.id, code: accounts.code, name: accounts.name }).from(accounts).where(eq(accounts.id, bankAccountId)).get();
  if (!account) throw new Error("Akun bank tidak ditemukan");
  const statements = db.select().from(bankStatements).where(eq(bankStatements.bankAccountId, bankAccountId)).orderBy(asc(bankStatements.statementDate)).all();
  const internal = getInternalRows(db, bankAccountId);
  return { account, statements: mapMatchRows(db, statements), internal };
}

function matchingAmount(statement: typeof bankStatements.$inferSelect, internal: { debit: number; credit: number }): boolean {
  return statement.credit > 0 ? internal.debit === statement.credit : internal.credit === statement.debit;
}

function createMatch(db: Executor, bankStatementId: string, journalLineId: string, matchType: "AUTO" | "MANUAL") {
  const statement = db.select().from(bankStatements).where(eq(bankStatements.id, bankStatementId)).get();
  const internal = db.select({ id: journalLines.id, accountId: journalLines.accountId, debit: journalLines.debit, credit: journalLines.credit }).from(journalLines).where(eq(journalLines.id, journalLineId)).get();
  if (!statement || !internal) throw new Error("Baris rekonsiliasi tidak ditemukan");
  if (statement.isMatched || db.select({ id: bankReconMatches.id }).from(bankReconMatches).where(or(eq(bankReconMatches.bankStatementId, bankStatementId), eq(bankReconMatches.journalLineId, journalLineId))).get()) throw new Error("Salah satu transaksi sudah dicocokkan");
  if (internal.accountId !== statement.bankAccountId) throw new Error("Akun bank internal dan rekening koran harus sama");
  if (!matchingAmount(statement, internal)) throw new Error("Nominal debit-kredit tidak identik");
  const id = randomUUID();
  db.insert(bankReconMatches).values({ id, bankStatementId, journalLineId, matchType, matchedAt: nowIsoInstant() }).run();
  db.update(bankStatements).set({ isMatched: true }).where(eq(bankStatements.id, bankStatementId)).run();
  return db.select().from(bankReconMatches).where(eq(bankReconMatches.id, id)).get()!;
}

export function autoMatch(db: Db, bankAccountId: string) {
  const statements = db.select().from(bankStatements).where(and(eq(bankStatements.bankAccountId, bankAccountId), eq(bankStatements.isMatched, false))).all();
  const internal = getInternalRows(db, bankAccountId, false);
  const used = new Set<string>();
  const matched: Array<{ bankStatementId: string; journalLineId: string }> = [];
  db.transaction((tx) => {
    for (const statement of statements) {
      const candidate = internal.filter((line) => !used.has(line.journalLineId) && matchingAmount(statement, line) && dateDistance(statement.statementDate, line.entryDate) <= 1)
        .sort((left, right) => dateDistance(statement.statementDate, left.entryDate) - dateDistance(statement.statementDate, right.entryDate))[0];
      if (!candidate) continue;
      createMatch(tx, statement.id, candidate.journalLineId, "AUTO");
      used.add(candidate.journalLineId);
      matched.push({ bankStatementId: statement.id, journalLineId: candidate.journalLineId });
    }
  });
  return { matchedCount: matched.length, matched };
}

export function manualMatch(db: Db, input: { bankStatementId: string; journalLineId: string }) {
  const parsed = BankReconMatchSchema.parse(input);
  return db.transaction((tx) => createMatch(tx, parsed.bankStatementId, parsed.journalLineId, "MANUAL"));
}

export function removeMatch(db: Db, matchId: string) {
  return db.transaction((tx) => {
    const match = tx.select().from(bankReconMatches).where(eq(bankReconMatches.id, matchId)).get();
    if (!match) throw new Error("Pencocokan tidak ditemukan");
    tx.delete(bankReconMatches).where(eq(bankReconMatches.id, matchId)).run();
    tx.update(bankStatements).set({ isMatched: false }).where(eq(bankStatements.id, match.bankStatementId)).run();
    return { removed: true };
  });
}

export function parseStatementCsvForTest(csv: string) {
  return parseBankStatementCsv(csv);
}
