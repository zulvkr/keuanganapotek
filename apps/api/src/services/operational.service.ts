import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Decimal from "decimal.js";
import {
  CashBankTransferSchema,
  ConsignmentItemSchema,
  ConsignmentSettlementSchema,
  ConsignmentVendorSchema,
  PbfInvoiceSchema,
  PosClearingSchema,
  PosPaymentMethodSchema,
  calculatePpn,
  parseRupiahToSen,
  rupiahToSen,
  senToRupiah,
} from "@keuangan-apotek/shared";
import type {
  CashBankTransfer,
  ConsignmentItem,
  ConsignmentSettlement,
  ConsignmentVendor,
  PbfInvoice,
  PosClearing,
  PosPaymentMethod,
} from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import {
  accounts,
  cashBankTransfers,
  consignmentItems,
  consignmentSettlementItems,
  consignmentSettlements,
  consignmentVendors,
  journalLines,
  journals,
  pbfInvoices,
  posClearingPayments,
  posClearings,
  posPaymentMethods,
} from "../db/schema/index.js";
import { createJournalEntry, deleteJournal, updateJournal } from "./ledger.service.js";

type Db = SqliteClient["db"];

function amountToSen(value: string | number): number {
  if (typeof value === "number") return rupiahToSen(String(value));
  const normalized = value.trim();
  return normalized.includes(",") || /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(normalized)
    ? parseRupiahToSen(normalized)
    : rupiahToSen(normalized);
}

function money(sen: number): string {
  return senToRupiah(sen).toFixed(2);
}
function accountIdByCode(db: Db, code: string): string {
  const account = db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.code, code))
    .get();
  if (!account) throw new Error(`Akun ${code} belum tersedia`);
  return account.id;
}

function accountCode(db: Db, id: string): string {
  const account = db
    .select({ code: accounts.code })
    .from(accounts)
    .where(eq(accounts.id, id))
    .get();
  if (!account) throw new Error("Akun transaksi tidak ditemukan");
  return account.code;
}

export function ensurePosPaymentMethods(db: Db) {
  const cash = db
    .select({ id: posPaymentMethods.id })
    .from(posPaymentMethods)
    .where(eq(posPaymentMethods.code, "TUNAI"))
    .get();
  if (!cash)
    db.insert(posPaymentMethods)
      .values({
        id: "pos-method-cash",
        code: "TUNAI",
        name: "Tunai",
        accountId: accountIdByCode(db, "1101"),
        isCash: true,
        isActive: true,
        sortOrder: 10,
      })
      .run();
  const nonCash = db
    .select({ id: posPaymentMethods.id })
    .from(posPaymentMethods)
    .where(eq(posPaymentMethods.code, "QRIS_EDC"))
    .get();
  if (!nonCash)
    db.insert(posPaymentMethods)
      .values({
        id: "pos-method-noncash",
        code: "QRIS_EDC",
        name: "QRIS / EDC",
        accountId: accountIdByCode(db, "1120"),
        isCash: false,
        isActive: true,
        sortOrder: 20,
      })
      .run();
}

function accountGroupCode(db: Db, accountId: string): "1100" | "1200" | null {
  let currentId: string | null = accountId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const current = db
      .select({ code: accounts.code, parentId: accounts.parentId })
      .from(accounts)
      .where(eq(accounts.id, currentId))
      .get();
    if (!current) return null;
    if (current.code === "1100" || current.code === "1200") return current.code;
    currentId = current.parentId;
  }
  return null;
}

function paymentDestinationAccount(db: Db, accountId: string) {
  const account = db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
      parentId: accounts.parentId,
      classification: accounts.classification,
      normalBalance: accounts.normalBalance,
      level: accounts.level,
      isGroup: accounts.isGroup,
      isActive: accounts.isActive,
    })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .get();
  if (!account) throw new Error("Akun tujuan pembayaran POS tidak ditemukan");
  const groupCode = accountGroupCode(db, accountId);
  if (
    !account.isActive ||
    account.isGroup ||
    account.classification !== "ASET_LANCAR" ||
    account.normalBalance !== "DEBIT" ||
    !groupCode
  ) {
    throw new Error(
      "Akun tujuan POS harus berupa akun anak aktif di grup Kas/Bank (1100) atau Piutang (1200)",
    );
  }
  return { ...account, groupCode };
}

export function listPosPaymentMethods(db: Db) {
  ensurePosPaymentMethods(db);
  return db
    .select({
      id: posPaymentMethods.id,
      code: posPaymentMethods.code,
      name: posPaymentMethods.name,
      accountId: posPaymentMethods.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      isCash: posPaymentMethods.isCash,
      isActive: posPaymentMethods.isActive,
      sortOrder: posPaymentMethods.sortOrder,
    })
    .from(posPaymentMethods)
    .innerJoin(accounts, eq(accounts.id, posPaymentMethods.accountId))
    .orderBy(asc(posPaymentMethods.sortOrder), asc(posPaymentMethods.name))
    .all()
    .map((method) => ({
      ...method,
      isCash: accountGroupCode(db, method.accountId) === "1100",
      isReceivable: accountGroupCode(db, method.accountId) === "1200",
    }));
}

export function savePosPaymentMethod(db: Db, input: PosPaymentMethod) {
  const parsed = PosPaymentMethodSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const destination = paymentDestinationAccount(db, parsed.accountId);
  const existing = db
    .select({ code: posPaymentMethods.code })
    .from(posPaymentMethods)
    .where(eq(posPaymentMethods.id, id))
    .get();
  const code = existing?.code ?? "POS_" + id.replaceAll("-", "_").toUpperCase();
  db.insert(posPaymentMethods)
    .values({
      id,
      code,
      name: parsed.name,
      accountId: parsed.accountId,
      isCash: destination.groupCode === "1100",
      isActive: parsed.isActive,
      sortOrder: parsed.sortOrder,
    })
    .onConflictDoUpdate({
      target: posPaymentMethods.id,
      set: {
        name: parsed.name,
        accountId: parsed.accountId,
        isCash: destination.groupCode === "1100",
        isActive: parsed.isActive,
        sortOrder: parsed.sortOrder,
        updatedAt: new Date().toISOString(),
      },
    })
    .run();
  return listPosPaymentMethods(db).find((method) => method.id === id)!;
}

function configuredPayments(db: Db, parsed: PosClearing) {
  ensurePosPaymentMethods(db);
  const methods = db
    .select()
    .from(posPaymentMethods)
    .all()
    .map((method) => ({ ...method, isCash: accountGroupCode(db, method.accountId) === "1100" }));
  const cashMethod = methods.find((method) => method.code === "TUNAI");
  const nonCashMethod = methods.find((method) => method.code === "QRIS_EDC");
  const requested = parsed.payments?.map((payment) => ({
    method: methods.find((method) => method.id === payment.paymentMethodId),
    amount: amountToSen(payment.amount),
  })) ?? [
    {
      method: cashMethod && {
        ...cashMethod,
        accountId: parsed.cashAccountId ?? cashMethod.accountId,
      },
      amount: amountToSen(parsed.cashReceived),
    },
    {
      method: nonCashMethod && {
        ...nonCashMethod,
        accountId: parsed.nonCashAccountId ?? nonCashMethod.accountId,
      },
      amount: amountToSen(parsed.nonCashReceived),
    },
  ];
  if (requested.some((payment) => !payment.method))
    throw new Error("Metode pembayaran POS tidak ditemukan");
  const seen = new Set<string>();
  return requested.map((payment) => {
    const method = payment.method!;
    if (seen.has(method.id)) throw new Error("Metode pembayaran POS tidak boleh diulang");
    seen.add(method.id);
    paymentDestinationAccount(db, method.accountId);
    if (parsed.payments && !method.isActive)
      throw new Error("Metode pembayaran POS yang tidak aktif tidak dapat dipakai");
    return { method, amount: payment.amount };
  });
}

export function listPosClearings(db: Db) {
  const clearings = db.select().from(posClearings).orderBy(desc(posClearings.clearingDate)).all();
  const payments = db.select().from(posClearingPayments).all();
  return clearings.map((clearing) => ({
    ...clearing,
    payments: payments.filter((payment) => payment.clearingId === clearing.id),
  }));
}

export function createPosClearing(db: Db, input: PosClearing) {
  const parsed = PosClearingSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const cogs = amountToSen(parsed.cogsAmount);
  const payments = configuredPayments(db, parsed);
  const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const omzet = parsed.totalPosOmzet ? amountToSen(parsed.totalPosOmzet) : paymentTotal;
  const diffSen = paymentTotal - omzet;
  const legacyCash = amountToSen(parsed.cashReceived);
  const legacyNonCash = amountToSen(parsed.nonCashReceived);

  db.transaction((tx) => {
    tx.insert(posClearings)
      .values({
        id,
        clearingDate: parsed.clearingDate,
        shiftName: parsed.shiftName ?? null,
        cashierName: parsed.cashierName ?? null,
        totalPosOmzet: omzet,
        cashReceived: legacyCash,
        nonCashReceived: legacyNonCash,
        cashAccountId:
          payments.find((payment) => payment.method.code === "TUNAI")?.method.accountId ?? null,
        nonCashAccountId:
          payments.find((payment) => payment.method.code === "QRIS_EDC")?.method.accountId ?? null,
        physicalCashDiff: diffSen,
        cogsAmount: cogs,
        status: "DRAFT",
      })
      .run();
    if (parsed.payments)
      tx.insert(posClearingPayments)
        .values(
          payments.map((payment) => ({
            id: randomUUID(),
            clearingId: id,
            paymentMethodId: payment.method.id,
            amount: payment.amount,
          })),
        )
        .run();
  });
  return { id, ...generatePosJournal(db, id) };
}

function posJournalInput(
  db: Db,
  clearing: typeof posClearings.$inferSelect,
  configuredPaymentLines?: Array<{ amount: number; accountId: string; methodName: string }>,
) {
  let paymentLines =
    configuredPaymentLines ??
    db
      .select({
        amount: posClearingPayments.amount,
        accountId: posPaymentMethods.accountId,
        methodName: posPaymentMethods.name,
      })
      .from(posClearingPayments)
      .innerJoin(posPaymentMethods, eq(posPaymentMethods.id, posClearingPayments.paymentMethodId))
      .where(eq(posClearingPayments.clearingId, clearing.id))
      .all();

  if (paymentLines.length === 0) {
    paymentLines = [
      {
        amount: clearing.cashReceived,
        accountId: clearing.cashAccountId ?? accountIdByCode(db, "1101"),
        methodName: "Tunai",
      },
      {
        amount: clearing.nonCashReceived,
        accountId: clearing.nonCashAccountId ?? accountIdByCode(db, "1120"),
        methodName: "QRIS / EDC",
      },
    ];
  }
  const lines = [
    ...paymentLines.map((payment) => ({
      accountId: payment.accountId,
      description: "Penerimaan POS - " + payment.methodName,
      debit: money(payment.amount),
      credit: "0",
    })),
    ...(clearing.physicalCashDiff < 0
      ? [
          {
            accountId: accountIdByCode(db, "6106"),
            description: "Selisih penerimaan POS minus",
            debit: money(Math.abs(clearing.physicalCashDiff)),
            credit: "0",
          },
        ]
      : []),
    ...(clearing.physicalCashDiff > 0
      ? [
          {
            accountId: accountIdByCode(db, "4900"),
            description: "Selisih penerimaan POS plus",
            debit: "0",
            credit: money(clearing.physicalCashDiff),
          },
        ]
      : []),
    {
      accountId: accountIdByCode(db, "4101"),
      description: "Omzet penjualan POS",
      debit: "0",
      credit: money(clearing.totalPosOmzet),
    },
    ...(clearing.cogsAmount > 0
      ? [
          {
            accountId: accountIdByCode(db, "5101"),
            description: "Pengakuan HPP harian",
            debit: money(clearing.cogsAmount),
            credit: "0",
          },
          {
            accountId: accountIdByCode(db, "1301"),
            description: "Pengurangan persediaan",
            debit: "0",
            credit: money(clearing.cogsAmount),
          },
        ]
      : []),
  ];
  return {
    entryDate: clearing.clearingDate,
    referenceNo: "POS-" + clearing.clearingDate,
    memo: "POS Clearing & pengakuan HPP harian",
    lines: lines.filter(
      (line) => parseRupiahToSen(line.debit) > 0 || parseRupiahToSen(line.credit) > 0,
    ),
    sourceModule: "POS_CLEARING" as const,
    sourceId: clearing.id,
  };
}

export function generatePosJournal(db: Db, id: string) {
  const clearing = db.select().from(posClearings).where(eq(posClearings.id, id)).get();
  if (!clearing) throw new Error("Rekap POS tidak ditemukan");
  if (clearing.status === "POSTED" || clearing.journalId)
    return {
      clearing,
      journal: clearing.journalId
        ? db.select().from(journals).where(eq(journals.id, clearing.journalId)).get()
        : null,
    };

  const journal = createJournalEntry(db, posJournalInput(db, clearing));
  db.update(posClearings)
    .set({ journalId: journal.journal.id, status: "POSTED" })
    .where(eq(posClearings.id, id))
    .run();
  return {
    clearing: db.select().from(posClearings).where(eq(posClearings.id, id)).get()!,
    journal,
  };
}

export function updatePosClearing(db: Db, id: string, input: PosClearing) {
  const parsed = PosClearingSchema.parse(input);
  const existing = db.select().from(posClearings).where(eq(posClearings.id, id)).get();
  if (!existing) throw new Error("Rekap POS tidak ditemukan");
  const payments = configuredPayments(db, parsed);
  const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const omzet = parsed.totalPosOmzet ? amountToSen(parsed.totalPosOmzet) : paymentTotal;
  const updated = {
    ...existing,
    clearingDate: parsed.clearingDate,
    shiftName: parsed.shiftName ?? null,
    cashierName: parsed.cashierName ?? null,
    totalPosOmzet: omzet,
    cashReceived: amountToSen(parsed.cashReceived),
    nonCashReceived: amountToSen(parsed.nonCashReceived),
    cashAccountId:
      payments.find((payment) => payment.method.code === "TUNAI")?.method.accountId ?? null,
    nonCashAccountId:
      payments.find((payment) => payment.method.code === "QRIS_EDC")?.method.accountId ?? null,
    physicalCashDiff: parsed.totalPosOmzet ? paymentTotal - omzet : 0,
    cogsAmount: amountToSen(parsed.cogsAmount),
  };
  const journal = existing.journalId
    ? updateJournal(
        db,
        existing.journalId,
        posJournalInput(
          db,
          updated,
          payments.map((payment) => ({
            amount: payment.amount,
            accountId: payment.method.accountId,
            methodName: payment.method.name,
          })),
        ),
        { allowSystem: true },
      )
    : createJournalEntry(db, posJournalInput(db, updated));
  db.transaction((tx) => {
    tx.update(posClearings)
      .set({ ...updated, journalId: journal.journal.id, status: "POSTED" })
      .where(eq(posClearings.id, id))
      .run();
    tx.delete(posClearingPayments).where(eq(posClearingPayments.clearingId, id)).run();
    tx.insert(posClearingPayments)
      .values(
        payments.map((payment) => ({
          id: randomUUID(),
          clearingId: id,
          paymentMethodId: payment.method.id,
          amount: payment.amount,
        })),
      )
      .run();
  });
  return { id, clearing: db.select().from(posClearings).where(eq(posClearings.id, id)).get()! };
}

export function deletePosClearing(db: Db, id: string) {
  const clearing = db.select().from(posClearings).where(eq(posClearings.id, id)).get();
  if (!clearing) throw new Error("Rekap POS tidak ditemukan");
  if (clearing.journalId) deleteJournal(db, clearing.journalId, { allowSystem: true });
  db.delete(posClearings).where(eq(posClearings.id, id)).run();
}

export function listPbfInvoices(db: Db) {
  return db.select().from(pbfInvoices).orderBy(desc(pbfInvoices.invoiceDate)).all();
}

export function createPbfInvoice(db: Db, input: PbfInvoice) {
  const parsed = PbfInvoiceSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const dpp = amountToSen(parsed.dppAmount);
  const ppn =
    parsed.ppnAmount === undefined
      ? rupiahToSen(calculatePpn(senToRupiah(dpp)).toString())
      : amountToSen(parsed.ppnAmount);
  const total = dpp + ppn;
  const payableId =
    parsed.accountPayableId ??
    accountIdByCode(db, parsed.paymentTerms === "TUNAI" ? "1101" : "2100");
  if (
    db
      .select({ id: pbfInvoices.id })
      .from(pbfInvoices)
      .where(
        and(
          eq(pbfInvoices.pbfName, parsed.pbfName),
          eq(pbfInvoices.invoiceNumber, parsed.invoiceNumber),
        ),
      )
      .get()
  )
    throw new Error("Nomor faktur PBF sudah terdaftar untuk distributor ini");
  const journal = createJournalEntry(db, {
    entryDate: parsed.invoiceDate,
    referenceNo: parsed.invoiceNumber,
    memo: `Pembelian PBF ${parsed.pbfName}`,
    sourceModule: "PBF_INVOICE",
    sourceId: id,
    lines: [
      {
        accountId: accountIdByCode(db, "1301"),
        description: "Persediaan obat dari PBF",
        debit: money(dpp),
        credit: "0",
      },
      {
        accountId: accountIdByCode(db, "1400"),
        description: "PPN Masukan 11%",
        debit: money(ppn),
        credit: "0",
      },
      {
        accountId: payableId,
        description:
          parsed.paymentTerms === "TUNAI" ? "Pembayaran tunai faktur PBF" : "Utang usaha PBF",
        debit: "0",
        credit: money(total),
      },
    ].filter((line) => parseRupiahToSen(line.debit) > 0 || parseRupiahToSen(line.credit) > 0),
  });
  try {
    db.insert(pbfInvoices)
      .values({
        id,
        invoiceDate: parsed.invoiceDate,
        dueDate: parsed.dueDate,
        pbfName: parsed.pbfName,
        invoiceNumber: parsed.invoiceNumber,
        dppAmount: dpp,
        ppnAmount: ppn,
        totalAmount: total,
        paymentTerms: parsed.paymentTerms,
        accountPayableId: payableId,
        isVerified: parsed.isVerified,
        paymentStatus: parsed.paymentTerms === "TUNAI" ? "PAID" : "UNPAID",
        journalId: journal.journal.id,
      })
      .run();
  } catch (error) {
    db.delete(journals).where(eq(journals.id, journal.journal.id)).run();
    throw error;
  }
  return { invoice: db.select().from(pbfInvoices).where(eq(pbfInvoices.id, id)).get()!, journal };
}

// Kept separate to avoid exposing journal deletion as part of the public ledger API.
export function listConsignmentItems(db: Db) {
  return db
    .select({
      id: consignmentItems.id,
      vendorId: consignmentItems.vendorId,
      vendorName: consignmentVendors.vendorName,
      productName: consignmentItems.productName,
      qtySold: consignmentItems.qtySold,
      agreedCostPrice: consignmentItems.agreedCostPrice,
      totalPayable: consignmentItems.totalPayable,
      status: consignmentItems.status,
    })
    .from(consignmentItems)
    .innerJoin(consignmentVendors, eq(consignmentVendors.id, consignmentItems.vendorId))
    .orderBy(desc(consignmentItems.createdAt))
    .all();
}

export function createConsignmentVendor(db: Db, input: ConsignmentVendor) {
  const parsed = ConsignmentVendorSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  db.insert(consignmentVendors)
    .values({
      id,
      vendorName: parsed.vendorName,
      contactPerson: parsed.contactPerson ?? null,
      phone: parsed.phone ?? null,
      bankAccountInfo: parsed.bankAccountInfo ?? null,
    })
    .run();
  return db.select().from(consignmentVendors).where(eq(consignmentVendors.id, id)).get()!;
}

export function createConsignmentItem(db: Db, input: ConsignmentItem) {
  const parsed = ConsignmentItemSchema.parse(input);
  const id = parsed.id ?? randomUUID();
  const price = amountToSen(parsed.agreedCostPrice);
  const total = Number(new Decimal(price).times(parsed.qtySold).toFixed(0));
  if (
    !db
      .select({ id: consignmentVendors.id })
      .from(consignmentVendors)
      .where(eq(consignmentVendors.id, parsed.vendorId))
      .get()
  )
    throw new Error("Vendor konsinyasi tidak ditemukan");
  db.insert(consignmentItems)
    .values({
      id,
      vendorId: parsed.vendorId,
      productName: parsed.productName,
      qtySold: parsed.qtySold,
      agreedCostPrice: price,
      totalPayable: total,
      status: "READY_TO_PAY",
    })
    .run();
  return db.select().from(consignmentItems).where(eq(consignmentItems.id, id)).get()!;
}

export function settleConsignment(db: Db, input: ConsignmentSettlement) {
  const parsed = ConsignmentSettlementSchema.parse(input);
  const items = db
    .select()
    .from(consignmentItems)
    .where(inArray(consignmentItems.id, parsed.itemIds))
    .all();
  if (
    items.length !== parsed.itemIds.length ||
    items.some((item) => item.status !== "READY_TO_PAY")
  )
    throw new Error("Item konsinyasi tidak tersedia atau sudah lunas");
  const total = items.reduce((sum, item) => sum + item.totalPayable, 0);
  if (total <= 0) throw new Error("Total tagihan konsinyasi harus lebih besar dari nol");
  const settlementId = randomUUID();
  const settlementNo = `KS-${parsed.settlementDate.replaceAll("-", "")}-${settlementId.slice(0, 6).toUpperCase()}`;
  const journal = createJournalEntry(db, {
    entryDate: parsed.settlementDate,
    referenceNo: parsed.referenceNo,
    memo: "Pembayaran tagihan konsinyasi",
    sourceModule: "CONSIGNMENT",
    sourceId: settlementId,
    lines: [
      {
        accountId: accountIdByCode(db, "2110"),
        description: "Pelunasan utang konsinyasi",
        debit: money(total),
        credit: "0",
      },
      {
        accountId: parsed.paymentAccountId,
        description: "Kas / bank pembayaran konsinyasi",
        debit: "0",
        credit: money(total),
      },
    ],
  });
  db.transaction((tx) => {
    tx.insert(consignmentSettlements)
      .values({
        id: settlementId,
        settlementNo,
        settlementDate: parsed.settlementDate,
        totalPaid: total,
        paymentAccountId: parsed.paymentAccountId,
        referenceNo: parsed.referenceNo ?? null,
        journalId: journal.journal.id,
      })
      .run();
    tx.insert(consignmentSettlementItems)
      .values(items.map((item) => ({ settlementId, consignmentItemId: item.id })))
      .run();
    tx.update(consignmentItems)
      .set({ status: "PAID" })
      .where(inArray(consignmentItems.id, parsed.itemIds))
      .run();
  });
  return {
    settlement: db
      .select()
      .from(consignmentSettlements)
      .where(eq(consignmentSettlements.id, settlementId))
      .get()!,
    journal,
  };
}

export function listCashBankTransfers(db: Db) {
  return db.select().from(cashBankTransfers).orderBy(desc(cashBankTransfers.transactionTime)).all();
}

export function createCashBankTransfer(db: Db, input: CashBankTransfer) {
  const parsed = CashBankTransferSchema.parse(input);
  const id = randomUUID();
  const net = amountToSen(parsed.netAmount);
  const fee = amountToSen(parsed.adminFee);
  const total = net + fee;
  const sourceCode = accountCode(db, parsed.sourceAccountId);
  const targetCode = accountCode(db, parsed.targetAccountId);
  const journal = createJournalEntry(db, {
    entryDate: parsed.transactionTime.slice(0, 10),
    referenceNo: parsed.referenceNo,
    memo: parsed.memo ?? `Mutasi ${sourceCode} ke ${targetCode}`,
    sourceModule: "CASH_BANK",
    sourceId: id,
    lines: [
      {
        accountId: parsed.targetAccountId,
        description: "Dana masuk akun tujuan",
        debit: money(net),
        credit: "0",
      },
      ...(fee > 0
        ? [
            {
              accountId: accountIdByCode(db, "6201"),
              description: "Biaya administrasi bank",
              debit: money(fee),
              credit: "0",
            },
          ]
        : []),
      {
        accountId: parsed.sourceAccountId,
        description: "Dana keluar akun sumber",
        debit: "0",
        credit: money(total),
      },
    ],
  });
  db.insert(cashBankTransfers)
    .values({
      id,
      transactionTime: parsed.transactionTime,
      transactionType: parsed.transactionType,
      sourceAccountId: parsed.sourceAccountId,
      targetAccountId: parsed.targetAccountId,
      netAmount: net,
      adminFee: fee,
      totalDeducted: total,
      referenceNo: parsed.referenceNo ?? null,
      memo: parsed.memo ?? null,
      journalId: journal.journal.id,
    })
    .run();
  return {
    transfer: db.select().from(cashBankTransfers).where(eq(cashBankTransfers.id, id)).get()!,
    journal,
  };
}

export function getCashBankSummary(db: Db) {
  return ["1101", "1111", "1112"].map((code) => {
    const accountId = accountIdByCode(db, code);
    const rows = db
      .select({ debit: journalLines.debit, credit: journalLines.credit })
      .from(journalLines)
      .where(eq(journalLines.accountId, accountId))
      .all();
    const balance = rows.reduce((sum, row) => sum + row.debit - row.credit, 0);
    const account = db
      .select({ id: accounts.id, code: accounts.code, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .get()!;
    return { ...account, balance };
  });
}
