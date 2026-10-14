import { randomUUID } from "node:crypto";
import { asc, desc, eq, like } from "drizzle-orm";
import {
  accountingPeriod,
  inferTransactionGroup,
  nowIsoInstant,
  parseRupiahToSen,
  rupiahToSen,
} from "@keuangan-apotek/shared";
import type {
  MetadataFieldDefinition,
  TransactionRecord,
  TransactionType,
  TransactionWithBalances,
  TransactionsSummary,
  CashBankAccountSummary,
} from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import {
  accounts,
  journalLines,
  journals,
  openingBalances,
  transactionTypes,
  transactions,
} from "../db/schema/index.js";
import { recordAudit } from "./audit.service.js";
import { assertPeriodUnlocked } from "./period-lock.service.js";

type Db = SqliteClient["db"];
type Executor = Pick<Db, "select" | "insert" | "update" | "delete">;

export const CASH_BANK_CODES = [
  "1101",
  "1102",
  "1103",
  "1104",
  "1105",
  "1106",
  "1107",
  "1108",
  "1109",
] as const;

function amountToSen(value: string | number): number {
  if (typeof value === "number") return rupiahToSen(String(value));
  const normalized = value.trim();
  if (!normalized || normalized === "0") return 0;
  const thousandGroups = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized);
  return normalized.includes(",") || thousandGroups
    ? parseRupiahToSen(normalized)
    : rupiahToSen(normalized);
}

function nextJournalNo(tx: Executor, entryDate: string): string {
  const prefix = `JU-${accountingPeriod(entryDate)}-`;
  const last = tx
    .select({ journalNo: journals.journalNo })
    .from(journals)
    .where(like(journals.journalNo, `${prefix}%`))
    .orderBy(desc(journals.journalNo))
    .limit(1)
    .get() as { journalNo: string } | undefined;
  const sequence = last ? Number(last.journalNo.slice(-4)) + 1 : 1;
  if (!Number.isSafeInteger(sequence) || sequence > 9999) {
    throw new Error(`Nomor jurnal periode ${accountingPeriod(entryDate)} sudah penuh`);
  }
  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

export function listTransactionTypes(
  db: Db,
  options: { includeInactive?: boolean } = {},
  allowedAccountCodes?: string[] | Set<string>,
): TransactionType[] {
  const allAccounts = db.select().from(accounts).all();
  const accountById = new Map(allAccounts.map((a) => [a.id, a]));
  const allowedSet =
    allowedAccountCodes instanceof Set
      ? allowedAccountCodes
      : allowedAccountCodes
        ? new Set(allowedAccountCodes)
        : undefined;

  const query = db.select().from(transactionTypes);
  const rows = options.includeInactive
    ? query.orderBy(asc(transactionTypes.code)).all()
    : query.where(eq(transactionTypes.isActive, true)).orderBy(asc(transactionTypes.code)).all();

  return rows
    .filter((row) => {
      if (!allowedSet) return true;
      const debitAccount = accountById.get(row.debitAccountId);
      const creditAccount = accountById.get(row.creditAccountId);
      return (
        debitAccount &&
        creditAccount &&
        allowedSet.has(debitAccount.code) &&
        allowedSet.has(creditAccount.code)
      );
    })
    .map((row) => {
      const debitAccount = accountById.get(row.debitAccountId);
      const creditAccount = accountById.get(row.creditAccountId);
      return {
        ...row,
        group: inferTransactionGroup(debitAccount, creditAccount),
        metadataSchema: JSON.parse(row.metadataSchema || "[]") as MetadataFieldDefinition[],
      };
    });
}

export function getTransactionTypeById(db: Db, id: string): TransactionType | undefined {
  const row = db.select().from(transactionTypes).where(eq(transactionTypes.id, id)).get();
  if (!row) return undefined;
  const debitAccount = db.select().from(accounts).where(eq(accounts.id, row.debitAccountId)).get();
  const creditAccount = db
    .select()
    .from(accounts)
    .where(eq(accounts.id, row.creditAccountId))
    .get();
  return {
    ...row,
    group: inferTransactionGroup(debitAccount, creditAccount),
    metadataSchema: JSON.parse(row.metadataSchema || "[]") as MetadataFieldDefinition[],
  };
}

export function createTransactionType(
  db: Db,
  input: {
    name: string;
    code: string;
    debitAccountId: string;
    creditAccountId: string;
    description?: string;
    metadataSchema?: MetadataFieldDefinition[];
    isActive?: boolean;
  },
): TransactionType {
  return db.transaction((tx) => {
    const existing = tx
      .select({ id: transactionTypes.id })
      .from(transactionTypes)
      .where(eq(transactionTypes.code, input.code))
      .get();
    if (existing) throw new Error(`Kode tipe transaksi ${input.code} sudah digunakan`);

    const id = randomUUID();
    const now = nowIsoInstant();
    const newRow = {
      id,
      code: input.code.trim(),
      name: input.name.trim(),
      debitAccountId: input.debitAccountId,
      creditAccountId: input.creditAccountId,
      description: input.description?.trim() || null,
      metadataSchema: JSON.stringify(input.metadataSchema || []),
      isActive: input.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    };

    tx.insert(transactionTypes).values(newRow).run();
    recordAudit(tx, {
      entityType: "TRANSACTION_TYPE",
      entityId: id,
      action: "CREATE",
      actor: "system",
      after: newRow,
    });

    const debitAccount = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, newRow.debitAccountId))
      .get();
    const creditAccount = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, newRow.creditAccountId))
      .get();

    return {
      ...newRow,
      group: inferTransactionGroup(debitAccount, creditAccount),
      metadataSchema: input.metadataSchema || [],
    };
  });
}

export function updateTransactionType(
  db: Db,
  id: string,
  input: {
    name?: string;
    code?: string;
    debitAccountId?: string;
    creditAccountId?: string;
    description?: string | null;
    metadataSchema?: MetadataFieldDefinition[];
    isActive?: boolean;
  },
): TransactionType {
  return db.transaction((tx) => {
    const existing = tx.select().from(transactionTypes).where(eq(transactionTypes.id, id)).get();
    if (!existing) throw new Error("Tipe transaksi tidak ditemukan");

    if (input.code && input.code !== existing.code) {
      const codeDuplicate = tx
        .select({ id: transactionTypes.id })
        .from(transactionTypes)
        .where(eq(transactionTypes.code, input.code))
        .get();
      if (codeDuplicate) throw new Error(`Kode tipe transaksi ${input.code} sudah digunakan`);
    }

    const now = nowIsoInstant();
    const updated = {
      name: input.name !== undefined ? input.name.trim() : existing.name,
      code: input.code !== undefined ? input.code.trim() : existing.code,
      debitAccountId: input.debitAccountId ?? existing.debitAccountId,
      creditAccountId: input.creditAccountId ?? existing.creditAccountId,
      description:
        input.description !== undefined ? input.description?.trim() || null : existing.description,
      metadataSchema:
        input.metadataSchema !== undefined
          ? JSON.stringify(input.metadataSchema)
          : existing.metadataSchema,
      isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
      updatedAt: now,
    };

    tx.update(transactionTypes).set(updated).where(eq(transactionTypes.id, id)).run();
    recordAudit(tx, {
      entityType: "TRANSACTION_TYPE",
      entityId: id,
      action: "UPDATE",
      actor: "system",
      before: existing,
      after: updated,
    });

    const debitAccount = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, updated.debitAccountId))
      .get();
    const creditAccount = tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, updated.creditAccountId))
      .get();

    return {
      id,
      ...updated,
      group: inferTransactionGroup(debitAccount, creditAccount),
      createdAt: existing.createdAt,
      metadataSchema:
        input.metadataSchema !== undefined
          ? input.metadataSchema
          : (JSON.parse(existing.metadataSchema || "[]") as MetadataFieldDefinition[]),
    };
  });
}

export function deleteTransactionType(db: Db, id: string): void {
  db.transaction((tx) => {
    const existing = tx.select().from(transactionTypes).where(eq(transactionTypes.id, id)).get();
    if (!existing) throw new Error("Tipe transaksi tidak ditemukan");

    const used = tx
      .select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.transactionTypeId, id))
      .limit(1)
      .get();
    if (used) {
      // Soft-delete if already used in transactions
      tx.update(transactionTypes)
        .set({ isActive: false, updatedAt: nowIsoInstant() })
        .where(eq(transactionTypes.id, id))
        .run();
    } else {
      tx.delete(transactionTypes).where(eq(transactionTypes.id, id)).run();
    }

    recordAudit(tx, {
      entityType: "TRANSACTION_TYPE",
      entityId: id,
      action: "DELETE",
      actor: "system",
      before: existing,
    });
  });
}

/**
 * Creates double-entry journal lines for a transaction.
 */
function syncTransactionJournal(
  tx: Executor,
  transaction: {
    id: string;
    transactionDate: string;
    amount: number;
    debitAccountId: string;
    creditAccountId: string;
    memo: string | null;
    journalId: string | null;
  },
  typeName: string,
): string | null {
  if (transaction.amount <= 0) {
    if (transaction.journalId) {
      tx.delete(journals).where(eq(journals.id, transaction.journalId)).run();
    }
    return null;
  }

  const memo = transaction.memo || typeName;
  const now = nowIsoInstant();

  if (transaction.journalId) {
    const existingJournal = tx
      .select()
      .from(journals)
      .where(eq(journals.id, transaction.journalId))
      .get();
    if (existingJournal) {
      tx.update(journals)
        .set({
          entryDate: transaction.transactionDate,
          memo,
          updatedAt: now,
        })
        .where(eq(journals.id, transaction.journalId))
        .run();

      tx.delete(journalLines).where(eq(journalLines.journalId, transaction.journalId)).run();
      tx.insert(journalLines)
        .values([
          {
            id: randomUUID(),
            journalId: transaction.journalId,
            lineNumber: 1,
            accountId: transaction.debitAccountId,
            description: memo,
            debit: transaction.amount,
            credit: 0,
          },
          {
            id: randomUUID(),
            journalId: transaction.journalId,
            lineNumber: 2,
            accountId: transaction.creditAccountId,
            description: memo,
            debit: 0,
            credit: transaction.amount,
          },
        ])
        .run();

      return transaction.journalId;
    }
  }

  const journalId = randomUUID();
  const journalNo = nextJournalNo(tx, transaction.transactionDate);

  tx.insert(journals)
    .values({
      id: journalId,
      journalNo,
      entryDate: transaction.transactionDate,
      referenceNo: null,
      sourceModule: "TRANSACTION",
      sourceId: transaction.id,
      memo,
      isPosted: true,
      createdBy: "system",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  tx.insert(journalLines)
    .values([
      {
        id: randomUUID(),
        journalId,
        lineNumber: 1,
        accountId: transaction.debitAccountId,
        description: memo,
        debit: transaction.amount,
        credit: 0,
      },
      {
        id: randomUUID(),
        journalId,
        lineNumber: 2,
        accountId: transaction.creditAccountId,
        description: memo,
        debit: 0,
        credit: transaction.amount,
      },
    ])
    .run();

  return journalId;
}

export function createTransaction(
  db: Db,
  input: {
    transactionDate: string;
    transactionTypeId: string;
    amount: string | number;
    memo?: string;
    metadata?: Record<string, any>;
  },
  allowedAccountCodes?: string[] | Set<string>,
): TransactionRecord {
  return db.transaction((tx) => {
    assertPeriodUnlocked(tx, input.transactionDate);

    const type = tx
      .select()
      .from(transactionTypes)
      .where(eq(transactionTypes.id, input.transactionTypeId))
      .get();
    if (!type) throw new Error("Tipe transaksi tidak ditemukan");

    if (allowedAccountCodes) {
      const allowedSet =
        allowedAccountCodes instanceof Set ? allowedAccountCodes : new Set(allowedAccountCodes);
      const debitAccount = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, type.debitAccountId))
        .get();
      const creditAccount = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, type.creditAccountId))
        .get();
      if (
        !debitAccount ||
        !creditAccount ||
        !allowedSet.has(debitAccount.code) ||
        !allowedSet.has(creditAccount.code)
      ) {
        throw new Error(
          "Akses ditolak: Anda tidak memiliki izin untuk akun transaksi ini (CoA dibatasi)",
        );
      }
    }

    const id = randomUUID();
    const amountSen = amountToSen(input.amount);
    const now = nowIsoInstant();

    const journalId = syncTransactionJournal(
      tx,
      {
        id,
        transactionDate: input.transactionDate,
        amount: amountSen,
        debitAccountId: type.debitAccountId,
        creditAccountId: type.creditAccountId,
        memo: input.memo?.trim() || null,
        journalId: null,
      },
      type.name,
    );

    const row = {
      id,
      transactionDate: input.transactionDate,
      transactionTypeId: input.transactionTypeId,
      amount: amountSen,
      debitAccountId: type.debitAccountId,
      creditAccountId: type.creditAccountId,
      memo: input.memo?.trim() || null,
      metadata: JSON.stringify(input.metadata || {}),
      journalId,
      createdAt: now,
      updatedAt: now,
    };

    tx.insert(transactions).values(row).run();
    recordAudit(tx, {
      entityType: "TRANSACTION",
      entityId: id,
      action: "CREATE",
      actor: "system",
      after: row,
    });

    return {
      ...row,
      metadata: input.metadata || {},
    };
  });
}

export function updateTransaction(
  db: Db,
  id: string,
  input: {
    transactionDate?: string;
    transactionTypeId?: string;
    amount?: string | number;
    memo?: string | null;
    metadata?: Record<string, any>;
  },
  allowedAccountCodes?: string[] | Set<string>,
): TransactionRecord {
  return db.transaction((tx) => {
    const existing = tx.select().from(transactions).where(eq(transactions.id, id)).get();
    if (!existing) throw new Error("Transaksi tidak ditemukan");

    const allowedSet =
      allowedAccountCodes instanceof Set
        ? allowedAccountCodes
        : allowedAccountCodes
          ? new Set(allowedAccountCodes)
          : undefined;

    if (allowedSet) {
      const existingDebit = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, existing.debitAccountId))
        .get();
      const existingCredit = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, existing.creditAccountId))
        .get();
      if (
        !existingDebit ||
        !existingCredit ||
        !allowedSet.has(existingDebit.code) ||
        !allowedSet.has(existingCredit.code)
      ) {
        throw new Error("Akses ditolak: Anda tidak memiliki izin untuk transaksi ini");
      }
    }

    const targetDate = input.transactionDate ?? existing.transactionDate;
    assertPeriodUnlocked(tx, existing.transactionDate);
    if (targetDate !== existing.transactionDate) {
      assertPeriodUnlocked(tx, targetDate);
    }

    const typeId = input.transactionTypeId ?? existing.transactionTypeId;
    const type = tx.select().from(transactionTypes).where(eq(transactionTypes.id, typeId)).get();
    if (!type) throw new Error("Tipe transaksi tidak ditemukan");

    if (allowedSet) {
      const targetDebit = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, type.debitAccountId))
        .get();
      const targetCredit = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, type.creditAccountId))
        .get();
      if (
        !targetDebit ||
        !targetCredit ||
        !allowedSet.has(targetDebit.code) ||
        !allowedSet.has(targetCredit.code)
      ) {
        throw new Error(
          "Akses ditolak: Anda tidak memiliki izin untuk akun transaksi ini (CoA dibatasi)",
        );
      }
    }

    const amountSen = input.amount !== undefined ? amountToSen(input.amount) : existing.amount;
    const memo = input.memo !== undefined ? input.memo?.trim() || null : existing.memo;
    const now = nowIsoInstant();

    const journalId = syncTransactionJournal(
      tx,
      {
        id,
        transactionDate: targetDate,
        amount: amountSen,
        debitAccountId: type.debitAccountId,
        creditAccountId: type.creditAccountId,
        memo,
        journalId: existing.journalId,
      },
      type.name,
    );

    const updated = {
      transactionDate: targetDate,
      transactionTypeId: typeId,
      amount: amountSen,
      debitAccountId: type.debitAccountId,
      creditAccountId: type.creditAccountId,
      memo,
      metadata: input.metadata !== undefined ? JSON.stringify(input.metadata) : existing.metadata,
      journalId,
      updatedAt: now,
    };

    tx.update(transactions).set(updated).where(eq(transactions.id, id)).run();
    recordAudit(tx, {
      entityType: "TRANSACTION",
      entityId: id,
      action: "UPDATE",
      actor: "system",
      before: existing,
      after: updated,
    });

    return {
      id,
      ...updated,
      createdAt: existing.createdAt,
      metadata:
        input.metadata !== undefined
          ? input.metadata
          : (JSON.parse(existing.metadata || "{}") as Record<string, any>),
    };
  });
}

export function deleteTransaction(
  db: Db,
  id: string,
  allowedAccountCodes?: string[] | Set<string>,
): void {
  db.transaction((tx) => {
    const existing = tx.select().from(transactions).where(eq(transactions.id, id)).get();
    if (!existing) throw new Error("Transaksi tidak ditemukan");

    if (allowedAccountCodes) {
      const allowedSet =
        allowedAccountCodes instanceof Set ? allowedAccountCodes : new Set(allowedAccountCodes);
      const existingDebit = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, existing.debitAccountId))
        .get();
      const existingCredit = tx
        .select()
        .from(accounts)
        .where(eq(accounts.id, existing.creditAccountId))
        .get();
      if (
        !existingDebit ||
        !existingCredit ||
        !allowedSet.has(existingDebit.code) ||
        !allowedSet.has(existingCredit.code)
      ) {
        throw new Error("Akses ditolak: Anda tidak memiliki izin untuk transaksi ini");
      }
    }

    assertPeriodUnlocked(tx, existing.transactionDate);

    if (existing.journalId) {
      tx.delete(journals).where(eq(journals.id, existing.journalId)).run();
    }

    tx.delete(transactions).where(eq(transactions.id, id)).run();
    recordAudit(tx, {
      entityType: "TRANSACTION",
      entityId: id,
      action: "DELETE",
      actor: "system",
      before: existing,
    });
  });
}

export function getInitialCashBankBalances(
  db: Db,
  allowedAccountCodes?: string[] | Set<string>,
): Record<string, number> {
  const allowedSet =
    allowedAccountCodes instanceof Set
      ? allowedAccountCodes
      : allowedAccountCodes
        ? new Set(allowedAccountCodes)
        : undefined;

  const initialBalances: Record<string, number> = {};
  for (const code of CASH_BANK_CODES) {
    if (!allowedSet || allowedSet.has(code)) {
      initialBalances[code] = 0;
    }
  }

  const opBalances = db
    .select({
      accountId: openingBalances.accountId,
      debit: openingBalances.debitAmount,
      credit: openingBalances.creditAmount,
      code: accounts.code,
    })
    .from(openingBalances)
    .innerJoin(accounts, eq(accounts.id, openingBalances.accountId))
    .where(eq(openingBalances.isLocked, true))
    .all();

  for (const op of opBalances) {
    if ((CASH_BANK_CODES as readonly string[]).includes(op.code)) {
      if (!allowedSet || allowedSet.has(op.code)) {
        initialBalances[op.code] = (initialBalances[op.code] || 0) + (op.debit - op.credit);
      }
    }
  }

  return initialBalances;
}

/**
 * Calculates running balance and mutations across cash & bank accounts,
 * filtered by allowedAccountCodes if provided (e.g. for assistant RBAC).
 */
export function listTransactions(
  db: Db,
  filters: { startDate?: string; endDate?: string } = {},
  allowedAccountCodes?: string[] | Set<string>,
): TransactionWithBalances[] {
  const allowedSet =
    allowedAccountCodes instanceof Set
      ? allowedAccountCodes
      : allowedAccountCodes
        ? new Set(allowedAccountCodes)
        : undefined;

  // 1. Fetch cash/bank accounts map { accountId -> code }
  const allAccounts = db.select().from(accounts).all();
  const accountById = new Map(allAccounts.map((account) => [account.id, account]));
  const cashBankAccounts = allAccounts.filter(
    (account) =>
      (CASH_BANK_CODES as readonly string[]).includes(account.code) &&
      (!allowedSet || allowedSet.has(account.code)),
  );
  const cashBankIds = new Set(cashBankAccounts.map((account) => account.id));

  // 2. Fetch base opening balances for the allowed accounts
  const initialBalances = getInitialCashBankBalances(db, allowedSet);

  // 3. Fetch all transactions ordered chronologically
  const allTxRows = db
    .select({
      id: transactions.id,
      transactionDate: transactions.transactionDate,
      transactionTypeId: transactions.transactionTypeId,
      amount: transactions.amount,
      debitAccountId: transactions.debitAccountId,
      creditAccountId: transactions.creditAccountId,
      memo: transactions.memo,
      metadata: transactions.metadata,
      journalId: transactions.journalId,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      transactionTypeName: transactionTypes.name,
    })
    .from(transactions)
    .leftJoin(transactionTypes, eq(transactionTypes.id, transactions.transactionTypeId))
    .orderBy(asc(transactions.transactionDate), asc(transactions.createdAt), asc(transactions.id))
    .all();

  // If allowedSet is provided, filter out transactions where debit or credit account is restricted
  const visibleTxRows = allTxRows.filter((row) => {
    if (!allowedSet) return true;
    const debitAccount = accountById.get(row.debitAccountId);
    const creditAccount = accountById.get(row.creditAccountId);
    return (
      debitAccount &&
      creditAccount &&
      allowedSet.has(debitAccount.code) &&
      allowedSet.has(creditAccount.code)
    );
  });

  // 4. Sequentially accumulate running balance and track mutation per row
  const running = { ...initialBalances };
  const rowsWithBalances: TransactionWithBalances[] = [];

  for (const row of visibleTxRows) {
    const debitAccount = accountById.get(row.debitAccountId);
    const creditAccount = accountById.get(row.creditAccountId);

    const mutations: Record<string, number> = {};

    if (debitAccount && cashBankIds.has(debitAccount.id)) {
      running[debitAccount.code] = (running[debitAccount.code] || 0) + row.amount;
      mutations[debitAccount.code] = row.amount;
    }

    if (creditAccount && cashBankIds.has(creditAccount.id)) {
      running[creditAccount.code] = (running[creditAccount.code] || 0) - row.amount;
      mutations[creditAccount.code] = (mutations[creditAccount.code] || 0) - row.amount;
    }

    rowsWithBalances.push({
      id: row.id,
      transactionDate: row.transactionDate,
      transactionTypeId: row.transactionTypeId,
      transactionTypeName: row.transactionTypeName ?? undefined,
      group: inferTransactionGroup(debitAccount, creditAccount),
      amount: row.amount,
      debitAccountId: row.debitAccountId,
      creditAccountId: row.creditAccountId,
      debitAccountCode: debitAccount?.code,
      debitAccountName: debitAccount?.name,
      creditAccountCode: creditAccount?.code,
      creditAccountName: creditAccount?.name,
      memo: row.memo,
      metadata: JSON.parse(row.metadata || "{}") as Record<string, any>,
      journalId: row.journalId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      runningBalances: { ...running },
      mutations,
    });
  }

  // 5. Filter by requested date range if provided
  let filtered = rowsWithBalances;
  if (filters.startDate) {
    filtered = filtered.filter((row) => row.transactionDate >= filters.startDate!);
  }
  if (filters.endDate) {
    filtered = filtered.filter((row) => row.transactionDate <= filters.endDate!);
  }

  return filtered;
}

/**
 * Returns summary cards data: ending balances for each cash & bank accounts,
 * total transaction count and volume. Filtered by allowedAccountCodes if provided.
 */
export function getTransactionsSummary(
  db: Db,
  allowedAccountCodes?: string[] | Set<string>,
): TransactionsSummary {
  const allowedSet =
    allowedAccountCodes instanceof Set
      ? allowedAccountCodes
      : allowedAccountCodes
        ? new Set(allowedAccountCodes)
        : undefined;

  const allRows = listTransactions(db, {}, allowedSet);
  const allAccounts = db.select().from(accounts).all();
  const accountByCode = new Map(allAccounts.map((account) => [account.code, account]));

  const lastRow = allRows.at(-1);
  const endingBalances = lastRow
    ? lastRow.runningBalances
    : getInitialCashBankBalances(db, allowedSet);

  const eligibleCodes = allowedSet
    ? CASH_BANK_CODES.filter((code) => allowedSet.has(code))
    : CASH_BANK_CODES;

  const accountsSummary: CashBankAccountSummary[] = eligibleCodes.map((code) => {
    const account = accountByCode.get(code);
    const balance = endingBalances[code] ?? 0;
    return {
      code,
      name: account?.name || `Akun ${code}`,
      balance,
    };
  });

  const totalAmount = allRows.reduce((sum, row) => sum + row.amount, 0);

  return {
    accounts: accountsSummary,
    totalTransactions: allRows.length,
    totalAmount,
  };
}
