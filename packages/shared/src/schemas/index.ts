import { z } from "zod";
import { isBalanced } from "../math/index.js";

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

export const JournalLineSchema = z
  .object({
    accountId: z.string().min(1),
    description: z.string().trim().optional(),
    debit: z.coerce.number().finite().min(0),
    credit: z.coerce.number().finite().min(0),
  })
  .refine((line) => line.debit > 0 || line.credit > 0, {
    message: "Baris jurnal harus memiliki debit atau kredit",
  });

export const JournalEntrySchema = z
  .object({
    entryDate: z.string().date(),
    referenceNo: z.string().trim().optional(),
    memo: z.string().trim().optional(),
    lines: z.array(JournalLineSchema).min(2),
  })
  .refine((entry) => isBalanced(entry.lines), {
    message: "Total debit dan kredit jurnal harus seimbang",
    path: ["lines"],
  });

export const PbfInvoiceSchema = z
  .object({
    invoiceDate: z.string().date(),
    dueDate: z.string().date(),
    pbfName: z.string().trim().min(1),
    invoiceNumber: z.string().trim().min(1),
    dppAmount: z.coerce.number().finite().nonnegative(),
    ppnAmount: z.coerce.number().finite().nonnegative(),
    totalAmount: z.coerce.number().finite().nonnegative(),
    paymentTerms: z.enum(["TUNAI", "TEMPO_14", "TEMPO_30", "TEMPO_45", "TEMPO_60"]),
  })
  .refine((invoice) => invoice.dueDate >= invoice.invoiceDate, {
    message: "Tanggal jatuh tempo tidak boleh sebelum tanggal faktur",
    path: ["dueDate"],
  });

export type Account = z.infer<typeof AccountSchema>;
export type JournalLine = z.infer<typeof JournalLineSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export type PbfInvoice = z.infer<typeof PbfInvoiceSchema>;
