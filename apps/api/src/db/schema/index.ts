import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    parentId: text("parent_id").references((): AnySQLiteColumn => accounts.id, {
      onDelete: "restrict",
    }),
    classification: text("classification").notNull(),
    normalBalance: text("normal_balance").notNull(),
    level: integer("level").notNull().default(1),
    isGroup: integer("is_group", { mode: "boolean" }).notNull().default(false),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
    updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
  },
  (table) => ({
    codeIndex: index("idx_accounts_code").on(table.code),
    parentIndex: index("idx_accounts_parent").on(table.parentId),
  }),
);

export const openingBalances = sqliteTable(
  "opening_balances",
  {
    id: text("id").primaryKey().notNull(),
    cutoffDate: text("cutoff_date").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    debitAmount: integer("debit_amount").notNull().default(0),
    creditAmount: integer("credit_amount").notNull().default(0),
    notes: text("notes"),
    isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
    createdBy: text("created_by"),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
  },
  (table) => ({
    cutoffAccountUnique: uniqueIndex("uq_opening_balances_cutoff_account").on(
      table.cutoffDate,
      table.accountId,
    ),
  }),
);

export const journals = sqliteTable("journals", {
  id: text("id").primaryKey().notNull(),
  journalNo: text("journal_no").notNull().unique(),
  entryDate: text("entry_date").notNull(),
  referenceNo: text("reference_no"),
  sourceModule: text("source_module").notNull(),
  sourceId: text("source_id"),
  memo: text("memo"),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const journalLines = sqliteTable(
  "journal_lines",
  {
    id: text("id").primaryKey().notNull(),
    journalId: text("journal_id")
      .notNull()
      .references(() => journals.id, { onDelete: "cascade" }),
    lineNumber: integer("line_number").notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    description: text("description"),
    debit: integer("debit").notNull().default(0),
    credit: integer("credit").notNull().default(0),
  },
  (table) => ({
    accountIndex: index("idx_journal_lines_account_id").on(table.accountId),
    journalIndex: index("idx_journal_lines_journal_id").on(table.journalId),
  }),
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey().notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    actor: text("actor").notNull(),
    beforeData: text("before_data"),
    afterData: text("after_data"),
    occurredAt: text("occurred_at").notNull(),
  },
  (table) => ({
    entityIndex: index("idx_audit_logs_entity").on(table.entityType, table.entityId),
    occurredIndex: index("idx_audit_logs_occurred_at").on(table.occurredAt),
  }),
);

export const transactionTypes = sqliteTable(
  "transaction_types",
  {
    id: text("id").primaryKey().notNull(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    group: text("group").notNull().default("tidak_terkategori"),
    debitAccountId: text("debit_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    creditAccountId: text("credit_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    description: text("description"),
    metadataSchema: text("metadata_schema").notNull().default("[]"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
    updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
  },
  (table) => ({
    codeIndex: index("idx_transaction_types_code").on(table.code),
    groupIndex: index("idx_transaction_types_group").on(table.group),
  }),
);

export const transactionGroupConfigs = sqliteTable("transaction_group_configs", {
  group: text("group").primaryKey().notNull(),
  label: text("label"),
  badgeLabel: text("badge_label"),
  description: text("description"),
  badgeClass: text("badge_class"),
  metadataSchema: text("metadata_schema").notNull().default("[]"),
  sortOrder: real("sort_order").notNull().default(0),
  isSystem: integer("is_system", { mode: "boolean" }).notNull().default(false),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey().notNull(),
    idempotencyKey: text("idempotency_key"),
    transactionDate: text("transaction_date").notNull(),
    transactionTypeId: text("transaction_type_id")
      .notNull()
      .references(() => transactionTypes.id, { onDelete: "restrict" }),
    amount: integer("amount").notNull().default(0),
    debitAccountId: text("debit_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    creditAccountId: text("credit_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    pic: text("pic"),
    metadata: text("metadata").notNull().default("{}"),
    journalId: text("journal_id").references(() => journals.id, { onDelete: "set null" }),
    sortOrder: real("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
    updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
  },
  (table) => ({
    dateIndex: index("idx_transactions_date").on(table.transactionDate),
    dateSortIndex: index("idx_transactions_date_sort").on(table.transactionDate, table.sortOrder),
    typeIndex: index("idx_transactions_type").on(table.transactionTypeId),
    idempotencyKeyIndex: uniqueIndex("idx_transactions_idempotency_key").on(table.idempotencyKey),
  }),
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey().notNull(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    salt: text("salt").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull(), // 'admin' | 'asisten' | 'kasir' | 'auditor'
    allowedCoaCodes: text("allowed_coa_codes").notNull().default("[]"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
    updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
  },
  (table) => ({
    usernameIndex: index("idx_users_username").on(table.username),
  }),
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    scopes: text("scopes").notNull().default("[]"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastUsedAt: text("last_used_at"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
    updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
  },
  (table) => ({
    keyHashIndex: uniqueIndex("idx_api_keys_key_hash").on(table.keyHash),
    userIdIndex: index("idx_api_keys_user_id").on(table.userId),
  }),
);

export type AccountRow = typeof accounts.$inferSelect;
export type OpeningBalanceRow = typeof openingBalances.$inferSelect;
export type JournalRow = typeof journals.$inferSelect;
export type JournalLineRow = typeof journalLines.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type TransactionTypeRow = typeof transactionTypes.$inferSelect;
export type TransactionGroupConfigRow = typeof transactionGroupConfigs.$inferSelect;
export type TransactionRow = typeof transactions.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
