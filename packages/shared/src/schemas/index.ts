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
  code: z
    .string()
    .regex(/^(\d{4}|\d-\d{4})$/, "Kode akun harus terdiri dari 4 digit angka atau format X-XXXX"),
  name: z.string().trim().min(1),
  parentId: z.string().nullable().optional(),
  classification: AccountClassificationSchema,
  normalBalance: NormalBalanceSchema,
  level: z.number().int().min(1).max(9).default(1),
  isGroup: z.boolean().default(false),
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
  .refine(
    (entry) =>
      isBalanced(
        entry.lines.map((line) => ({
          debit: parseRupiahToSen(typeof line.debit === "number" ? String(line.debit) : line.debit),
          credit: parseRupiahToSen(
            typeof line.credit === "number" ? String(line.credit) : line.credit,
          ),
        })),
      ),
    {
      message: "Total debit dan kredit jurnal harus seimbang",
      path: ["lines"],
    },
  );

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

export const MoveOpeningBalanceSchema = z
  .object({
    fromDate: IsoDateSchema,
    toDate: IsoDateSchema,
  })
  .refine((input) => input.fromDate !== input.toDate, {
    message: "Tanggal saldo awal baru harus berbeda dari tanggal sebelumnya",
    path: ["toDate"],
  });

export const NonNegativeMoneySchema = RupiahAmountSchema.refine((value) => {
  try {
    const sen = parseRupiahToSen(typeof value === "number" ? String(value) : value);
    return sen >= 0;
  } catch {
    return false;
  }
}, "Nominal tidak boleh negatif");

export const MetadataFieldTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "currency",
  "date",
  "select",
  "multi-select",
  "boolean",
]);

export const MetadataFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, "Key hanya boleh huruf, angka, _, atau -"),
  label: z.string().trim().min(1),
  type: MetadataFieldTypeSchema,
  required: z.boolean().default(false),
  defaultValue: z.any().optional(),
  placeholder: z.string().trim().optional(),
  options: z.array(z.string().trim().min(1)).optional(),
  width: z.enum(["full", "half"]).default("full"),
  helpText: z.string().trim().optional(),
});

export const TransactionTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  code: z.string().trim().min(1),
  debitAccountId: z.string().min(1),
  creditAccountId: z.string().min(1),
  description: z.string().trim().optional(),
  metadataSchema: z.array(MetadataFieldSchema).default([]),
  isActive: z.boolean().default(true),
});

export const TransactionEntrySchema = z.object({
  id: z.string().optional(),
  idempotencyKey: z.string().trim().max(128).optional(),
  transactionDate: IsoDateSchema,
  transactionTypeId: z.string().min(1),
  amount: NonNegativeMoneySchema.default("0"),
  memo: z.string().trim().optional(),
  metadata: z
    .record(z.string(), z.any())
    .nullish()
    .transform((val) => val ?? {}),
});

export const ReportPeriodSchema = z
  .object({
    startDate: IsoDateSchema,
    endDate: IsoDateSchema,
  })
  .refine((period) => period.startDate <= period.endDate, {
    message: "Rentang tanggal laporan tidak valid",
    path: ["endDate"],
  });

export const IncomeStatementQuerySchema = z.object({
  period: ReportPeriodSchema,
  comparePeriod: ReportPeriodSchema.optional(),
});

export const BalanceSheetQuerySchema = z.object({
  asOfDate: IsoDateSchema,
});

export const TrialBalanceQuerySchema = ReportPeriodSchema;
export const CashFlowStatementQuerySchema = ReportPeriodSchema;

export const AccountJournalDrillDownQuerySchema = z.object({
  accountId: z.string().min(1),
  period: ReportPeriodSchema,
});

export const LoginInputSchema = z.object({
  username: z.string().trim().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const CreateUserInputSchema = z.object({
  username: z.string().trim().min(3, "Username minimal 3 karakter"),
  password: z.string().min(4, "Password minimal 4 karakter"),
  name: z.string().trim().min(1, "Nama wajib diisi"),
  role: z.enum(["admin", "asisten"]),
  allowedCoaCodes: z.array(z.string()).default([]),
});

export const UpdateUserInputSchema = z.object({
  name: z.string().trim().min(1).optional(),
  password: z.string().min(4).optional(),
  role: z.enum(["admin", "asisten"]).optional(),
  allowedCoaCodes: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export const UpdatePermissionsInputSchema = z.object({
  allowedCoaCodes: z.array(z.string()),
});

export const SetupInputSchema = z.object({
  pharmacyName: z.string().trim().min(1, "Nama apotek wajib diisi").optional(),
  admin: z.object({
    name: z.string().trim().min(1, "Nama lengkap admin wajib diisi"),
    username: z.string().trim().min(3, "Username minimal 3 karakter"),
    password: z.string().min(4, "Password minimal 4 karakter"),
  }),
  createAssistant: z.boolean().default(false),
  assistant: z
    .object({
      name: z.string().trim().min(1).optional(),
      username: z.string().trim().min(3).optional(),
      password: z.string().min(4).optional(),
    })
    .optional(),
});

export const CreateApiKeyInputSchema = z.object({
  name: z.string().trim().min(1, "Nama API Key wajib diisi"),
  expiresAt: IsoDateSchema.optional().nullable(),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserInputSchema>;
export type UpdatePermissionsInput = z.infer<typeof UpdatePermissionsInputSchema>;
export type SetupInput = z.infer<typeof SetupInputSchema>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeyInputSchema>;

export type Account = z.infer<typeof AccountSchema>;
export type JournalLine = z.infer<typeof JournalLineSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type MetadataField = z.infer<typeof MetadataFieldSchema>;
export type TransactionTypeInput = z.infer<typeof TransactionTypeSchema>;
export type TransactionEntryInput = z.infer<typeof TransactionEntrySchema>;
export type OpeningBalanceLine = z.infer<typeof OpeningBalanceLineSchema>;
export type SaveOpeningBalances = z.infer<typeof SaveOpeningBalancesSchema>;
export type MoveOpeningBalance = z.infer<typeof MoveOpeningBalanceSchema>;
export type ReportPeriod = z.infer<typeof ReportPeriodSchema>;
export type IncomeStatementQuery = z.infer<typeof IncomeStatementQuerySchema>;
export type BalanceSheetQuery = z.infer<typeof BalanceSheetQuerySchema>;
export type TrialBalanceQuery = z.infer<typeof TrialBalanceQuerySchema>;
export type CashFlowStatementQuery = z.infer<typeof CashFlowStatementQuerySchema>;
export type AccountJournalDrillDownQuery = z.infer<typeof AccountJournalDrillDownQuerySchema>;
