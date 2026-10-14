import type Database from "better-sqlite3";
import { createSqliteClient } from "./client.js";

const migrationStatements = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    parent_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
    classification TEXT NOT NULL,
    normal_balance TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    is_group INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_code ON accounts(code)`,
  `CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id)`,
  `CREATE TABLE IF NOT EXISTS opening_balances (
    id TEXT PRIMARY KEY NOT NULL,
    cutoff_date TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    debit_amount INTEGER NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount INTEGER NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
    notes TEXT,
    is_locked INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(cutoff_date, account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS journals (
    id TEXT PRIMARY KEY NOT NULL,
    journal_no TEXT NOT NULL UNIQUE,
    entry_date TEXT NOT NULL,
    reference_no TEXT,
    source_module TEXT NOT NULL,
    source_id TEXT,
    memo TEXT,
    is_posted INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS journal_lines (
    id TEXT PRIMARY KEY NOT NULL,
    journal_id TEXT NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    description TEXT,
    debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
    CHECK (debit > 0 OR credit > 0)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_journal_lines_account_id ON journal_lines(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_journal_lines_journal_id ON journal_lines(journal_id)`,
  `CREATE TABLE IF NOT EXISTS period_locks (
    id TEXT PRIMARY KEY NOT NULL,
    locked_through TEXT NOT NULL UNIQUE,
    locked_by TEXT NOT NULL,
    locked_by_role TEXT NOT NULL CHECK (locked_by_role IN ('OWNER', 'APOTEKER_PENGELOLA')),
    locked_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOCK', 'UNLOCK')),
    actor TEXT NOT NULL,
    before_data TEXT,
    after_data TEXT,
    occurred_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs(occurred_at)`,
  `CREATE TABLE IF NOT EXISTS transaction_types (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    debit_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    credit_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    description TEXT,
    metadata_schema TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transaction_types_code ON transaction_types(code)`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    transaction_date TEXT NOT NULL,
    transaction_type_id TEXT NOT NULL REFERENCES transaction_types(id) ON DELETE RESTRICT,
    amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
    debit_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    credit_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    memo TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    journal_id TEXT REFERENCES journals(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type_id)`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'asisten')),
    allowed_coa_codes TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
];

export function runMigrations(sqlite: Database.Database): void {
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrate = sqlite.transaction(() => {
    for (const statement of migrationStatements) sqlite.exec(statement);
    const accountColumns = new Set(
      (sqlite.prepare("PRAGMA table_info(accounts)").all() as Array<{ name: string }>).map(
        (column) => column.name,
      ),
    );
    if (!accountColumns.has("is_group"))
      sqlite.exec("ALTER TABLE accounts ADD COLUMN is_group INTEGER NOT NULL DEFAULT 0");
  });
  migrate();
}

const invokedFile = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (invokedFile.endsWith("/db/migrate.ts") || invokedFile.endsWith("/db/migrate.js")) {
  const client = createSqliteClient();
  runMigrations(client.sqlite);
  client.sqlite.close();
  console.log("Database migrations applied.");
}
