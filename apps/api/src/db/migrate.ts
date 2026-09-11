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
  `CREATE TABLE IF NOT EXISTS pos_clearings (
    id TEXT PRIMARY KEY NOT NULL, clearing_date TEXT NOT NULL, shift_name TEXT, cashier_name TEXT,
    total_pos_omzet INTEGER NOT NULL DEFAULT 0 CHECK (total_pos_omzet >= 0), cash_received INTEGER NOT NULL DEFAULT 0 CHECK (cash_received >= 0),
    non_cash_received INTEGER NOT NULL DEFAULT 0 CHECK (non_cash_received >= 0), physical_cash_diff INTEGER NOT NULL DEFAULT 0,
    cogs_amount INTEGER NOT NULL DEFAULT 0 CHECK (cogs_amount >= 0), journal_id TEXT REFERENCES journals(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pos_clearings_date ON pos_clearings(clearing_date)`,
  `CREATE TABLE IF NOT EXISTS pbf_invoices (
    id TEXT PRIMARY KEY NOT NULL, invoice_date TEXT NOT NULL, due_date TEXT NOT NULL, pbf_name TEXT NOT NULL, invoice_number TEXT NOT NULL,
    dpp_amount INTEGER NOT NULL DEFAULT 0 CHECK (dpp_amount >= 0), ppn_amount INTEGER NOT NULL DEFAULT 0 CHECK (ppn_amount >= 0), total_amount INTEGER NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    payment_terms TEXT NOT NULL, account_payable_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, is_verified INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID', journal_id TEXT REFERENCES journals(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(pbf_name, invoice_number)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pbf_invoices_date ON pbf_invoices(invoice_date)`,
  `CREATE TABLE IF NOT EXISTS consignment_vendors (
    id TEXT PRIMARY KEY NOT NULL, vendor_name TEXT NOT NULL, contact_person TEXT, phone TEXT, bank_account_info TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS consignment_items (
    id TEXT PRIMARY KEY NOT NULL, vendor_id TEXT NOT NULL REFERENCES consignment_vendors(id) ON DELETE RESTRICT, product_name TEXT NOT NULL,
    qty_sold INTEGER NOT NULL DEFAULT 0 CHECK (qty_sold >= 0), agreed_cost_price INTEGER NOT NULL DEFAULT 0 CHECK (agreed_cost_price >= 0),
    total_payable INTEGER NOT NULL DEFAULT 0 CHECK (total_payable >= 0), status TEXT NOT NULL DEFAULT 'READY_TO_PAY', created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS consignment_settlements (
    id TEXT PRIMARY KEY NOT NULL, settlement_no TEXT NOT NULL UNIQUE, settlement_date TEXT NOT NULL, total_paid INTEGER NOT NULL CHECK (total_paid > 0),
    payment_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, reference_no TEXT, journal_id TEXT REFERENCES journals(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS consignment_settlement_items (
    settlement_id TEXT NOT NULL REFERENCES consignment_settlements(id) ON DELETE CASCADE, consignment_item_id TEXT NOT NULL REFERENCES consignment_items(id) ON DELETE RESTRICT,
    PRIMARY KEY (settlement_id, consignment_item_id)
  )`,
  `CREATE TABLE IF NOT EXISTS cash_bank_transfers (
    id TEXT PRIMARY KEY NOT NULL, transaction_time TEXT NOT NULL, transaction_type TEXT NOT NULL,
    source_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT, target_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    net_amount INTEGER NOT NULL CHECK (net_amount > 0), admin_fee INTEGER NOT NULL DEFAULT 0 CHECK (admin_fee >= 0), total_deducted INTEGER NOT NULL,
    reference_no TEXT, memo TEXT, journal_id TEXT REFERENCES journals(id) ON DELETE SET NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_cash_bank_transfers_time ON cash_bank_transfers(transaction_time)`,
  `CREATE TABLE IF NOT EXISTS bank_statements (
    id TEXT PRIMARY KEY NOT NULL,
    bank_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    statement_date TEXT NOT NULL,
    description TEXT,
    debit INTEGER NOT NULL DEFAULT 0 CHECK (debit >= 0),
    credit INTEGER NOT NULL DEFAULT 0 CHECK (credit >= 0),
    is_matched INTEGER NOT NULL DEFAULT 0,
    imported_at TEXT NOT NULL DEFAULT (datetime('now')),
    CHECK (debit > 0 OR credit > 0),
    CHECK (NOT (debit > 0 AND credit > 0))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bank_statements_account_date ON bank_statements(bank_account_id, statement_date)`,
  `CREATE TABLE IF NOT EXISTS bank_recon_matches (
    id TEXT PRIMARY KEY NOT NULL,
    bank_statement_id TEXT NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
    journal_line_id TEXT NOT NULL REFERENCES journal_lines(id) ON DELETE CASCADE,
    matched_at TEXT NOT NULL DEFAULT (datetime('now')),
    match_type TEXT NOT NULL DEFAULT 'MANUAL' CHECK (match_type IN ('AUTO', 'MANUAL')),
    UNIQUE(bank_statement_id, journal_line_id),
    UNIQUE(bank_statement_id),
    UNIQUE(journal_line_id)
  )`,
];

export function runMigrations(sqlite: Database.Database): void {
  sqlite.exec("PRAGMA foreign_keys = ON");
  const migrate = sqlite.transaction(() => {
    for (const statement of migrationStatements) sqlite.exec(statement);
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
