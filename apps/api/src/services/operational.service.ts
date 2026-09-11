import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import Decimal from "decimal.js";
import {
  CashBankTransferSchema, ConsignmentItemSchema, ConsignmentSettlementSchema, ConsignmentVendorSchema,
  PbfInvoiceSchema, PosClearingSchema, calculatePpn, parseRupiahToSen, rupiahToSen, senToRupiah,
} from "@keuangan-apotek/shared";
import type { CashBankTransfer, ConsignmentItem, ConsignmentSettlement, ConsignmentVendor, PbfInvoice, PosClearing } from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { accounts, cashBankTransfers, consignmentItems, consignmentSettlementItems, consignmentSettlements, consignmentVendors, journalLines, journals, pbfInvoices, posClearings } from "../db/schema/index.js";
import { createJournalEntry } from "./ledger.service.js";

type Db = SqliteClient["db"];

function amountToSen(value: string | number): number {
  if (typeof value === "number") return rupiahToSen(String(value));
  const normalized = value.trim();
  return normalized.includes(",") || /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized) ? parseRupiahToSen(normalized) : rupiahToSen(normalized);
}

function money(sen: number): string { return senToRupiah(sen).toFixed(2); }
function signedSen(value: Decimal): number { const result = Number(value.times(100).toFixed(0)); if (!Number.isSafeInteger(result)) throw new RangeError("Nominal melebihi integer aman"); return result; }
function accountIdByCode(db: Db, code: string): string {
  const account = db.select({ id: accounts.id }).from(accounts).where(eq(accounts.code, code)).get();
  if (!account) throw new Error(`Akun ${code} belum tersedia`);
  return account.id;
}

function accountCode(db: Db, id: string): string {
  const account = db.select({ code: accounts.code }).from(accounts).where(eq(accounts.id, id)).get();
  if (!account) throw new Error("Akun transaksi tidak ditemukan");
  return account.code;
}

export function listPosClearings(db: Db) {
  return db.select().from(posClearings).orderBy(desc(posClearings.clearingDate)).all();
}

export function createPosClearing(db: Db, input: PosClearing) {
  const parsed = PosClearingSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const omzet = amountToSen(parsed.totalPosOmzet); const cash = amountToSen(parsed.cashReceived); const nonCash = amountToSen(parsed.nonCashReceived); const cogs = amountToSen(parsed.cogsAmount);
  const difference = new Decimal(cash).minus(new Decimal(omzet).minus(nonCash));
  const diffSen = signedSen(difference.div(100));
  const cashId = accountIdByCode(db, "1101"); const nonCashId = accountIdByCode(db, "1120"); const salesId = accountIdByCode(db, parsed.salesAccountCode); const cogsId = accountIdByCode(db, parsed.cogsAccountCode); const inventoryId = accountIdByCode(db, parsed.cogsAccountCode === "5102" ? "1302" : "1301");
  const lines = [
    { accountId: cashId, description: "Penerimaan tunai POS", debit: money(cash), credit: "0" },
    { accountId: nonCashId, description: "Penerimaan QRIS / EDC", debit: money(nonCash), credit: "0" },
    ...(diffSen < 0 ? [{ accountId: accountIdByCode(db, "6106"), description: "Selisih kasir minus", debit: money(Math.abs(diffSen)), credit: "0" }] : []),
    ...(diffSen > 0 ? [{ accountId: accountIdByCode(db, "4900"), description: "Selisih kasir plus", debit: "0", credit: money(diffSen) }] : []),
    { accountId: salesId, description: "Omzet penjualan POS", debit: "0", credit: money(omzet) },
    ...(cogs > 0 ? [
      { accountId: cogsId, description: "Pengakuan HPP harian", debit: money(cogs), credit: "0" },
      { accountId: inventoryId, description: "Pengurangan persediaan", debit: "0", credit: money(cogs) },
    ] : []),
  ];
  db.insert(posClearings).values({ id, clearingDate: parsed.clearingDate, shiftName: parsed.shiftName ?? null, cashierName: parsed.cashierName ?? null, totalPosOmzet: omzet, cashReceived: cash, nonCashReceived: nonCash, physicalCashDiff: diffSen, cogsAmount: cogs, status: "DRAFT" }).run();
  return { id, clearing: db.select().from(posClearings).where(eq(posClearings.id, id)).get()! };
}

export function generatePosJournal(db: Db, id: string) {
  const clearing = db.select().from(posClearings).where(eq(posClearings.id, id)).get();
  if (!clearing) throw new Error("Rekap POS tidak ditemukan");
  if (clearing.status === "POSTED" || clearing.journalId) throw new Error("Rekap POS sudah diposting");
  const salesCode = clearing.cogsAmount > 0 ? "4101" : "4101";
  const cogsCode = "5101";
  const lines = [
    { accountId: accountIdByCode(db, "1101"), description: "Penerimaan tunai POS", debit: money(clearing.cashReceived), credit: "0" },
    { accountId: accountIdByCode(db, "1120"), description: "Penerimaan QRIS / EDC", debit: money(clearing.nonCashReceived), credit: "0" },
    ...(clearing.physicalCashDiff < 0 ? [{ accountId: accountIdByCode(db, "6106"), description: "Selisih kasir minus", debit: money(Math.abs(clearing.physicalCashDiff)), credit: "0" }] : []),
    ...(clearing.physicalCashDiff > 0 ? [{ accountId: accountIdByCode(db, "4900"), description: "Selisih kasir plus", debit: "0", credit: money(clearing.physicalCashDiff) }] : []),
    { accountId: accountIdByCode(db, salesCode), description: "Omzet penjualan POS", debit: "0", credit: money(clearing.totalPosOmzet) },
    ...(clearing.cogsAmount > 0 ? [
      { accountId: accountIdByCode(db, cogsCode), description: "Pengakuan HPP harian", debit: money(clearing.cogsAmount), credit: "0" },
      { accountId: accountIdByCode(db, "1301"), description: "Pengurangan persediaan", debit: "0", credit: money(clearing.cogsAmount) },
    ] : []),
  ];
  const journal = createJournalEntry(db, { entryDate: clearing.clearingDate, referenceNo: `POS-${clearing.clearingDate}`, memo: "POS Clearing & pengakuan HPP harian", lines: lines.filter((line) => parseRupiahToSen(line.debit) > 0 || parseRupiahToSen(line.credit) > 0), sourceModule: "POS_CLEARING", sourceId: id });
  db.update(posClearings).set({ journalId: journal.journal.id, status: "POSTED" }).where(eq(posClearings.id, id)).run();
  return { clearing: db.select().from(posClearings).where(eq(posClearings.id, id)).get()!, journal };
}

export function listPbfInvoices(db: Db) { return db.select().from(pbfInvoices).orderBy(desc(pbfInvoices.invoiceDate)).all(); }

export function createPbfInvoice(db: Db, input: PbfInvoice) {
  const parsed = PbfInvoiceSchema.parse(input); const id = parsed.id ?? randomUUID(); const dpp = amountToSen(parsed.dppAmount);
  const ppn = parsed.ppnAmount === undefined ? rupiahToSen(calculatePpn(senToRupiah(dpp)).toString()) : amountToSen(parsed.ppnAmount); const total = dpp + ppn;
  const payableId = parsed.accountPayableId ?? accountIdByCode(db, parsed.paymentTerms === "TUNAI" ? "1101" : "2100");
  if (db.select({ id: pbfInvoices.id }).from(pbfInvoices).where(and(eq(pbfInvoices.pbfName, parsed.pbfName), eq(pbfInvoices.invoiceNumber, parsed.invoiceNumber))).get()) throw new Error("Nomor faktur PBF sudah terdaftar untuk distributor ini");
  const journal = createJournalEntry(db, { entryDate: parsed.invoiceDate, referenceNo: parsed.invoiceNumber, memo: `Pembelian PBF ${parsed.pbfName}`, sourceModule: "PBF_INVOICE", sourceId: id, lines: [
    { accountId: accountIdByCode(db, "1301"), description: "Persediaan obat dari PBF", debit: money(dpp), credit: "0" },
    { accountId: accountIdByCode(db, "1400"), description: "PPN Masukan 11%", debit: money(ppn), credit: "0" },
    { accountId: payableId, description: parsed.paymentTerms === "TUNAI" ? "Pembayaran tunai faktur PBF" : "Utang usaha PBF", debit: "0", credit: money(total) },
  ].filter((line) => parseRupiahToSen(line.debit) > 0 || parseRupiahToSen(line.credit) > 0) });
  try {
    db.insert(pbfInvoices).values({ id, invoiceDate: parsed.invoiceDate, dueDate: parsed.dueDate, pbfName: parsed.pbfName, invoiceNumber: parsed.invoiceNumber, dppAmount: dpp, ppnAmount: ppn, totalAmount: total, paymentTerms: parsed.paymentTerms, accountPayableId: payableId, isVerified: parsed.isVerified, paymentStatus: parsed.paymentTerms === "TUNAI" ? "PAID" : "UNPAID", journalId: journal.journal.id }).run();
  } catch (error) { db.delete(journals).where(eq(journals.id, journal.journal.id)).run(); throw error; }
  return { invoice: db.select().from(pbfInvoices).where(eq(pbfInvoices.id, id)).get()!, journal };
}

// Kept separate to avoid exposing journal deletion as part of the public ledger API.
export function listConsignmentItems(db: Db) {
  return db.select({ id: consignmentItems.id, vendorId: consignmentItems.vendorId, vendorName: consignmentVendors.vendorName, productName: consignmentItems.productName, qtySold: consignmentItems.qtySold, agreedCostPrice: consignmentItems.agreedCostPrice, totalPayable: consignmentItems.totalPayable, status: consignmentItems.status }).from(consignmentItems).innerJoin(consignmentVendors, eq(consignmentVendors.id, consignmentItems.vendorId)).orderBy(desc(consignmentItems.createdAt)).all();
}

export function createConsignmentVendor(db: Db, input: ConsignmentVendor) { const parsed = ConsignmentVendorSchema.parse(input); const id = parsed.id ?? randomUUID(); db.insert(consignmentVendors).values({ id, vendorName: parsed.vendorName, contactPerson: parsed.contactPerson ?? null, phone: parsed.phone ?? null, bankAccountInfo: parsed.bankAccountInfo ?? null }).run(); return db.select().from(consignmentVendors).where(eq(consignmentVendors.id, id)).get()!; }

export function createConsignmentItem(db: Db, input: ConsignmentItem) {
  const parsed = ConsignmentItemSchema.parse(input); const id = parsed.id ?? randomUUID(); const price = amountToSen(parsed.agreedCostPrice); const total = Number(new Decimal(price).times(parsed.qtySold).toFixed(0));
  if (!db.select({ id: consignmentVendors.id }).from(consignmentVendors).where(eq(consignmentVendors.id, parsed.vendorId)).get()) throw new Error("Vendor konsinyasi tidak ditemukan");
  db.insert(consignmentItems).values({ id, vendorId: parsed.vendorId, productName: parsed.productName, qtySold: parsed.qtySold, agreedCostPrice: price, totalPayable: total, status: "READY_TO_PAY" }).run(); return db.select().from(consignmentItems).where(eq(consignmentItems.id, id)).get()!;
}

export function settleConsignment(db: Db, input: ConsignmentSettlement) {
  const parsed = ConsignmentSettlementSchema.parse(input); const items = db.select().from(consignmentItems).where(inArray(consignmentItems.id, parsed.itemIds)).all();
  if (items.length !== parsed.itemIds.length || items.some((item) => item.status !== "READY_TO_PAY")) throw new Error("Item konsinyasi tidak tersedia atau sudah lunas");
  const total = items.reduce((sum, item) => sum + item.totalPayable, 0); if (total <= 0) throw new Error("Total tagihan konsinyasi harus lebih besar dari nol");
  const settlementId = randomUUID(); const settlementNo = `KS-${parsed.settlementDate.replaceAll("-", "")}-${settlementId.slice(0, 6).toUpperCase()}`;
  const journal = createJournalEntry(db, { entryDate: parsed.settlementDate, referenceNo: parsed.referenceNo, memo: "Pembayaran tagihan konsinyasi", sourceModule: "CONSIGNMENT", sourceId: settlementId, lines: [{ accountId: accountIdByCode(db, "2110"), description: "Pelunasan utang konsinyasi", debit: money(total), credit: "0" }, { accountId: parsed.paymentAccountId, description: "Kas / bank pembayaran konsinyasi", debit: "0", credit: money(total) }] });
  db.transaction((tx) => {
    tx.insert(consignmentSettlements).values({ id: settlementId, settlementNo, settlementDate: parsed.settlementDate, totalPaid: total, paymentAccountId: parsed.paymentAccountId, referenceNo: parsed.referenceNo ?? null, journalId: journal.journal.id }).run();
    tx.insert(consignmentSettlementItems).values(items.map((item) => ({ settlementId, consignmentItemId: item.id }))).run();
    tx.update(consignmentItems).set({ status: "PAID" }).where(inArray(consignmentItems.id, parsed.itemIds)).run();
  });
  return { settlement: db.select().from(consignmentSettlements).where(eq(consignmentSettlements.id, settlementId)).get()!, journal };
}

export function listCashBankTransfers(db: Db) { return db.select().from(cashBankTransfers).orderBy(desc(cashBankTransfers.transactionTime)).all(); }

export function createCashBankTransfer(db: Db, input: CashBankTransfer) {
  const parsed = CashBankTransferSchema.parse(input); const id = randomUUID(); const net = amountToSen(parsed.netAmount); const fee = amountToSen(parsed.adminFee); const total = net + fee;
  const sourceCode = accountCode(db, parsed.sourceAccountId); const targetCode = accountCode(db, parsed.targetAccountId);
  const journal = createJournalEntry(db, { entryDate: parsed.transactionTime.slice(0, 10), referenceNo: parsed.referenceNo, memo: parsed.memo ?? `Mutasi ${sourceCode} ke ${targetCode}`, sourceModule: "CASH_BANK", sourceId: id, lines: [
    { accountId: parsed.targetAccountId, description: "Dana masuk akun tujuan", debit: money(net), credit: "0" },
    ...(fee > 0 ? [{ accountId: accountIdByCode(db, "6201"), description: "Biaya administrasi bank", debit: money(fee), credit: "0" }] : []),
    { accountId: parsed.sourceAccountId, description: "Dana keluar akun sumber", debit: "0", credit: money(total) },
  ] });
  db.insert(cashBankTransfers).values({ id, transactionTime: parsed.transactionTime, transactionType: parsed.transactionType, sourceAccountId: parsed.sourceAccountId, targetAccountId: parsed.targetAccountId, netAmount: net, adminFee: fee, totalDeducted: total, referenceNo: parsed.referenceNo ?? null, memo: parsed.memo ?? null, journalId: journal.journal.id }).run();
  return { transfer: db.select().from(cashBankTransfers).where(eq(cashBankTransfers.id, id)).get()!, journal };
}

export function getCashBankSummary(db: Db) {
  return ["1101", "1111", "1112"].map((code) => {
    const accountId = accountIdByCode(db, code); const rows = db.select({ debit: journalLines.debit, credit: journalLines.credit }).from(journalLines).where(eq(journalLines.accountId, accountId)).all();
    const balance = rows.reduce((sum, row) => sum + row.debit - row.credit, 0); const account = db.select({ id: accounts.id, code: accounts.code, name: accounts.name }).from(accounts).where(eq(accounts.id, accountId)).get()!;
    return { ...account, balance };
  });
}
