import { index, integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().notNull(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  parentId: text("parent_id").references((): AnySQLiteColumn => accounts.id, { onDelete: "restrict" }),
  classification: text("classification").notNull(),
  normalBalance: text("normal_balance").notNull(),
  level: integer("level").notNull().default(1),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
}, (table) => ({
  codeIndex: index("idx_accounts_code").on(table.code),
  parentIndex: index("idx_accounts_parent").on(table.parentId),
}));

export const openingBalances = sqliteTable("opening_balances", {
  id: text("id").primaryKey().notNull(),
  cutoffDate: text("cutoff_date").notNull(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  debitAmount: integer("debit_amount").notNull().default(0),
  creditAmount: integer("credit_amount").notNull().default(0),
  notes: text("notes"),
  isLocked: integer("is_locked", { mode: "boolean" }).notNull().default(false),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
}, (table) => ({
  cutoffAccountUnique: uniqueIndex("uq_opening_balances_cutoff_account").on(table.cutoffDate, table.accountId),
}));

export const journals = sqliteTable("journals", {
  id: text("id").primaryKey().notNull(),
  journalNo: text("journal_no").notNull().unique(),
  entryDate: text("entry_date").notNull(),
  referenceNo: text("reference_no"),
  sourceModule: text("source_module").notNull(),
  sourceId: text("source_id"),
  memo: text("memo"),
  isPosted: integer("is_posted", { mode: "boolean" }).notNull().default(true),
  createdBy: text("created_by"),
  createdAt: text("created_at").notNull().default("(datetime('now'))"),
  updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const journalLines = sqliteTable("journal_lines", {
  id: text("id").primaryKey().notNull(),
  journalId: text("journal_id").notNull().references(() => journals.id, { onDelete: "cascade" }),
  lineNumber: integer("line_number").notNull(),
  accountId: text("account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  description: text("description"),
  debit: integer("debit").notNull().default(0),
  credit: integer("credit").notNull().default(0),
}, (table) => ({
  accountIndex: index("idx_journal_lines_account_id").on(table.accountId),
  journalIndex: index("idx_journal_lines_journal_id").on(table.journalId),
}));

export const posClearings = sqliteTable("pos_clearings", {
  id: text("id").primaryKey().notNull(), clearingDate: text("clearing_date").notNull(), shiftName: text("shift_name"), cashierName: text("cashier_name"),
  totalPosOmzet: integer("total_pos_omzet").notNull().default(0), cashReceived: integer("cash_received").notNull().default(0), nonCashReceived: integer("non_cash_received").notNull().default(0),
  physicalCashDiff: integer("physical_cash_diff").notNull().default(0), cogsAmount: integer("cogs_amount").notNull().default(0), journalId: text("journal_id").references(() => journals.id, { onDelete: "set null" }),
  status: text("status").notNull().default("DRAFT"), createdAt: text("created_at").notNull().default("(datetime('now'))"),
}, (table) => ({ dateIndex: index("idx_pos_clearings_date").on(table.clearingDate) }));

export const pbfInvoices = sqliteTable("pbf_invoices", {
  id: text("id").primaryKey().notNull(), invoiceDate: text("invoice_date").notNull(), dueDate: text("due_date").notNull(), pbfName: text("pbf_name").notNull(), invoiceNumber: text("invoice_number").notNull(),
  dppAmount: integer("dpp_amount").notNull().default(0), ppnAmount: integer("ppn_amount").notNull().default(0), totalAmount: integer("total_amount").notNull().default(0), paymentTerms: text("payment_terms").notNull(),
  accountPayableId: text("account_payable_id").notNull().references(() => accounts.id, { onDelete: "restrict" }), isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
  paymentStatus: text("payment_status").notNull().default("UNPAID"), journalId: text("journal_id").references(() => journals.id, { onDelete: "set null" }), createdAt: text("created_at").notNull().default("(datetime('now'))"),
}, (table) => ({ uniqueInvoice: uniqueIndex("uq_pbf_invoices_name_number").on(table.pbfName, table.invoiceNumber), dateIndex: index("idx_pbf_invoices_date").on(table.invoiceDate) }));

export const consignmentVendors = sqliteTable("consignment_vendors", {
  id: text("id").primaryKey().notNull(), vendorName: text("vendor_name").notNull(), contactPerson: text("contact_person"), phone: text("phone"), bankAccountInfo: text("bank_account_info"),
});

export const consignmentItems = sqliteTable("consignment_items", {
  id: text("id").primaryKey().notNull(), vendorId: text("vendor_id").notNull().references(() => consignmentVendors.id, { onDelete: "restrict" }), productName: text("product_name").notNull(),
  qtySold: integer("qty_sold").notNull().default(0), agreedCostPrice: integer("agreed_cost_price").notNull().default(0), totalPayable: integer("total_payable").notNull().default(0), status: text("status").notNull().default("READY_TO_PAY"), createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const consignmentSettlements = sqliteTable("consignment_settlements", {
  id: text("id").primaryKey().notNull(), settlementNo: text("settlement_no").notNull().unique(), settlementDate: text("settlement_date").notNull(), totalPaid: integer("total_paid").notNull(),
  paymentAccountId: text("payment_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }), referenceNo: text("reference_no"), journalId: text("journal_id").references(() => journals.id, { onDelete: "set null" }), createdAt: text("created_at").notNull().default("(datetime('now'))"),
});

export const consignmentSettlementItems = sqliteTable("consignment_settlement_items", {
  settlementId: text("settlement_id").notNull().references(() => consignmentSettlements.id, { onDelete: "cascade" }), consignmentItemId: text("consignment_item_id").notNull().references(() => consignmentItems.id, { onDelete: "restrict" }),
}, (table) => ({ itemUnique: uniqueIndex("uq_consignment_settlement_item").on(table.settlementId, table.consignmentItemId) }));

export const cashBankTransfers = sqliteTable("cash_bank_transfers", {
  id: text("id").primaryKey().notNull(), transactionTime: text("transaction_time").notNull(), transactionType: text("transaction_type").notNull(),
  sourceAccountId: text("source_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }), targetAccountId: text("target_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }), netAmount: integer("net_amount").notNull().default(0), adminFee: integer("admin_fee").notNull().default(0), totalDeducted: integer("total_deducted").notNull().default(0),
  referenceNo: text("reference_no"), memo: text("memo"), journalId: text("journal_id").references(() => journals.id, { onDelete: "set null" }), createdAt: text("created_at").notNull().default("(datetime('now'))"),
}, (table) => ({ timeIndex: index("idx_cash_bank_transfers_time").on(table.transactionTime) }));

export const bankStatements = sqliteTable("bank_statements", {
  id: text("id").primaryKey().notNull(),
  bankAccountId: text("bank_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  statementDate: text("statement_date").notNull(),
  description: text("description"),
  debit: integer("debit").notNull().default(0),
  credit: integer("credit").notNull().default(0),
  isMatched: integer("is_matched", { mode: "boolean" }).notNull().default(false),
  importedAt: text("imported_at").notNull().default("(datetime('now'))"),
}, (table) => ({
  accountDateIndex: index("idx_bank_statements_account_date").on(table.bankAccountId, table.statementDate),
}));

export const bankReconMatches = sqliteTable("bank_recon_matches", {
  id: text("id").primaryKey().notNull(),
  bankStatementId: text("bank_statement_id").notNull().references(() => bankStatements.id, { onDelete: "cascade" }),
  journalLineId: text("journal_line_id").notNull().references(() => journalLines.id, { onDelete: "cascade" }),
  matchedAt: text("matched_at").notNull().default("(datetime('now'))"),
  matchType: text("match_type").notNull().default("MANUAL"),
}, (table) => ({
  statementLineUnique: uniqueIndex("uq_bank_recon_statement_line").on(table.bankStatementId, table.journalLineId),
  statementUnique: uniqueIndex("uq_bank_recon_statement").on(table.bankStatementId),
  journalLineUnique: uniqueIndex("uq_bank_recon_journal_line").on(table.journalLineId),
}));

export type AccountRow = typeof accounts.$inferSelect;
export type OpeningBalanceRow = typeof openingBalances.$inferSelect;
export type JournalRow = typeof journals.$inferSelect;
export type JournalLineRow = typeof journalLines.$inferSelect;
export type PosClearingRow = typeof posClearings.$inferSelect;
export type PbfInvoiceRow = typeof pbfInvoices.$inferSelect;
export type ConsignmentVendorRow = typeof consignmentVendors.$inferSelect;
export type ConsignmentItemRow = typeof consignmentItems.$inferSelect;
export type CashBankTransferRow = typeof cashBankTransfers.$inferSelect;
export type BankStatementRow = typeof bankStatements.$inferSelect;
export type BankReconMatchRow = typeof bankReconMatches.$inferSelect;
