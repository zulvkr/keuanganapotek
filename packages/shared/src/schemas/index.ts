import { z } from "zod";
import { isBalanced, parseRupiahToSen } from "../math/index.js";
import { isIsoDate } from "../date/index.js";

const IsoDateSchema = z.string().refine(isIsoDate, "Tanggal harus berformat YYYY-MM-DD");

export const AccountClassificationSchema = z.enum([
  "ASET_LANCAR",
  "ASET_TIDAK_LANCAR",
  "KEWAJIBAN_LANCAR",
  "KEWAJIBAN_JANGKA_PANJANG",
  "EKUITAS",
  "PENDAPATAN",
  "BEBAN_POKOK",
  "BEBAN_OPERASIONAL",
  "BEBAN_NON_OPERASIONAL",
]);

export const NormalBalanceSchema = z.enum(["DEBIT", "KREDIT"]);

export const AccountSchema = z.object({
  id: z.string().optional(),
  code: z.string().regex(/^\d{4}$/, "Kode akun harus terdiri dari 4 digit angka"),
  name: z.string().trim().min(1),
  parentId: z.string().nullable().optional(),
  classification: AccountClassificationSchema,
  normalBalance: NormalBalanceSchema,
  level: z.number().int().min(1).max(9).default(1),
  isActive: z.boolean().default(true),
});

const RupiahAmountSchema = z
  .union([z.string().trim().min(1), z.number().finite()])
  .refine((value) => {
    try {
      parseRupiahToSen(typeof value === "number" ? String(value) : value);
      return true;
    } catch {
      return false;
    }
  }, "Nominal rupiah tidak valid");

function positiveAmount(value: string | number): boolean {
  try {
    return parseRupiahToSen(typeof value === "number" ? String(value) : value) > 0;
  } catch {
    return false;
  }
}

export const JournalLineSchema = z
  .object({
    accountId: z.string().min(1),
    description: z.string().trim().optional(),
    debit: RupiahAmountSchema,
    credit: RupiahAmountSchema,
  })
  .refine((line) => positiveAmount(line.debit) || positiveAmount(line.credit), {
    message: "Baris jurnal harus memiliki debit atau kredit",
  })
  .refine((line) => !(positiveAmount(line.debit) && positiveAmount(line.credit)), {
    message: "Baris jurnal hanya boleh memiliki debit atau kredit",
  });

export const JournalEntrySchema = z
  .object({
    entryDate: IsoDateSchema,
    referenceNo: z.string().trim().optional(),
    memo: z.string().trim().optional(),
    lines: z.array(JournalLineSchema).min(2),
  })
  .refine((entry) => isBalanced(entry.lines.map((line) => ({
    debit: parseRupiahToSen(typeof line.debit === "number" ? String(line.debit) : line.debit),
    credit: parseRupiahToSen(typeof line.credit === "number" ? String(line.credit) : line.credit),
  }))), {
    message: "Total debit dan kredit jurnal harus seimbang",
    path: ["lines"],
  });

const RupiahInputSchema = RupiahAmountSchema;

export const OpeningBalanceLineSchema = z.object({
  accountId: z.string().min(1),
  debitAmount: RupiahInputSchema,
  creditAmount: RupiahInputSchema,
  notes: z.string().trim().optional(),
});

export const SaveOpeningBalancesSchema = z.object({
  cutoffDate: IsoDateSchema,
  lines: z.array(OpeningBalanceLineSchema),
});

export const LockOpeningBalanceSchema = z.object({
  cutoffDate: IsoDateSchema,
});

export const PaymentTermsSchema = z.enum(["TUNAI", "TEMPO_14", "TEMPO_30", "TEMPO_45", "TEMPO_60"]);
const NonNegativeMoneySchema = RupiahAmountSchema.refine((value) => positiveAmount(value) || String(value).trim() === "0", "Nominal tidak boleh negatif");

export const PbfInvoiceSchema = z
  .object({
    id: z.string().optional(),
    invoiceDate: IsoDateSchema,
    dueDate: IsoDateSchema,
    pbfName: z.string().trim().min(1),
    invoiceNumber: z.string().trim().min(1),
    dppAmount: NonNegativeMoneySchema,
    ppnAmount: NonNegativeMoneySchema.optional(),
    totalAmount: NonNegativeMoneySchema.optional(),
    paymentTerms: PaymentTermsSchema,
    accountPayableId: z.string().optional(),
    isVerified: z.boolean().default(false),
  })
  .refine((invoice) => invoice.dueDate >= invoice.invoiceDate, {
    message: "Tanggal jatuh tempo tidak boleh sebelum tanggal faktur",
    path: ["dueDate"],
  });

export const PosClearingSchema = z.object({
  id: z.string().optional(), clearingDate: IsoDateSchema, shiftName: z.string().trim().optional(), cashierName: z.string().trim().optional(),
  totalPosOmzet: NonNegativeMoneySchema, cashReceived: NonNegativeMoneySchema, nonCashReceived: NonNegativeMoneySchema, cogsAmount: NonNegativeMoneySchema,
  salesAccountCode: z.enum(["4101", "4102"]).default("4101"), cogsAccountCode: z.enum(["5101", "5102"]).default("5101"),
});

export const ConsignmentVendorSchema = z.object({
  id: z.string().optional(), vendorName: z.string().trim().min(1), contactPerson: z.string().trim().optional(), phone: z.string().trim().optional(), bankAccountInfo: z.string().trim().optional(),
});

export const ConsignmentItemSchema = z.object({
  id: z.string().optional(), vendorId: z.string().min(1), productName: z.string().trim().min(1), qtySold: z.number().int().nonnegative(), agreedCostPrice: NonNegativeMoneySchema,
});

export const ConsignmentSettlementSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1), settlementDate: IsoDateSchema, paymentAccountId: z.string().min(1), referenceNo: z.string().trim().optional(),
});

export const CashBankTransferSchema = z.object({
  transactionTime: z.string().trim().min(10), transactionType: z.enum(["DEPOSIT", "BANK_TRANSFER", "EXPENSE", "OTHER"]), sourceAccountId: z.string().min(1), targetAccountId: z.string().min(1),
  netAmount: NonNegativeMoneySchema.refine(positiveAmount, "Nominal transaksi harus lebih besar dari nol"), adminFee: NonNegativeMoneySchema.default("0"), referenceNo: z.string().trim().optional(), memo: z.string().trim().optional(),
}).refine((input) => input.sourceAccountId !== input.targetAccountId, { message: "Akun sumber dan tujuan harus berbeda" });

export const BankStatementImportRowSchema = z.object({
  statementDate: IsoDateSchema,
  description: z.string().trim().optional(),
  debit: NonNegativeMoneySchema.default("0"),
  credit: NonNegativeMoneySchema.default("0"),
}).refine((row) => positiveAmount(row.debit) !== positiveAmount(row.credit), {
  message: "Baris rekening koran harus memiliki tepat satu nominal debit atau kredit",
});

export const BankStatementImportSchema = z.object({
  bankAccountId: z.string().min(1),
  rows: z.array(BankStatementImportRowSchema).min(1),
});

export const BankReconMatchSchema = z.object({
  bankStatementId: z.string().min(1),
  journalLineId: z.string().min(1),
});

export type Account = z.infer<typeof AccountSchema>;
export type JournalLine = z.infer<typeof JournalLineSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type PbfInvoice = z.infer<typeof PbfInvoiceSchema>;
export type PosClearing = z.infer<typeof PosClearingSchema>;
export type ConsignmentVendor = z.infer<typeof ConsignmentVendorSchema>;
export type ConsignmentItem = z.infer<typeof ConsignmentItemSchema>;
export type ConsignmentSettlement = z.infer<typeof ConsignmentSettlementSchema>;
export type CashBankTransfer = z.infer<typeof CashBankTransferSchema>;
export type BankStatementImportRow = z.infer<typeof BankStatementImportRowSchema>;
export type BankStatementImport = z.infer<typeof BankStatementImportSchema>;
export type BankReconMatch = z.infer<typeof BankReconMatchSchema>;
export type OpeningBalanceLine = z.infer<typeof OpeningBalanceLineSchema>;
export type SaveOpeningBalances = z.infer<typeof SaveOpeningBalancesSchema>;
