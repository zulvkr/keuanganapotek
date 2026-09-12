import { describe, expect, it } from "vitest";
import { AccountSchema, JournalLineSchema, PbfInvoiceSchema } from "../index.js";

describe("shared validation schemas", () => {
  it("accepts a four-digit account code and rejects malformed codes", () => {
    expect(
      AccountSchema.safeParse({
        code: "1101",
        name: "Kas Toko",
        classification: "ASET_LANCAR",
        normalBalance: "DEBIT",
      }).success,
    ).toBe(true);
    expect(
      AccountSchema.safeParse({
        code: "110",
        name: "Kas Toko",
        classification: "ASET_LANCAR",
        normalBalance: "DEBIT",
      }).success,
    ).toBe(false);
  });

  it("requires a non-zero, non-negative journal amount", () => {
    expect(JournalLineSchema.safeParse({ accountId: "cash", debit: 1, credit: 0 }).success).toBe(
      true,
    );
    expect(JournalLineSchema.safeParse({ accountId: "cash", debit: 0, credit: 0 }).success).toBe(
      false,
    );
    expect(JournalLineSchema.safeParse({ accountId: "cash", debit: -1, credit: 0 }).success).toBe(
      false,
    );
  });

  it("requires PBF due date to be on or after invoice date", () => {
    const base = {
      pbfName: "Kimia Farma",
      invoiceNumber: "INV-001",
      dppAmount: 100000,
      ppnAmount: 11000,
      totalAmount: 111000,
      paymentTerms: "TEMPO_30" as const,
    };
    expect(
      PbfInvoiceSchema.safeParse({ ...base, invoiceDate: "2026-01-01", dueDate: "2026-01-31" })
        .success,
    ).toBe(true);
    expect(
      PbfInvoiceSchema.safeParse({ ...base, invoiceDate: "2026-01-31", dueDate: "2026-01-01" })
        .success,
    ).toBe(false);
  });
});
