import { describe, expect, it } from "vitest";
import {
  AccountSchema,
  JournalLineSchema,
  MetadataFieldSchema,
  TransactionTypeSchema,
  TransactionEntrySchema,
} from "../index.js";

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

  it("validates metadata field schemas properly", () => {
    expect(
      MetadataFieldSchema.safeParse({
        key: "no_faktur",
        label: "Nomor Faktur",
        type: "text",
        required: true,
      }).success,
    ).toBe(true);

    expect(
      MetadataFieldSchema.safeParse({
        key: "invalid key!",
        label: "Invalid",
        type: "text",
      }).success,
    ).toBe(false);

    expect(
      MetadataFieldSchema.safeParse({
        key: "metode",
        label: "Metode",
        type: "select",
        options: ["Tunai", "Transfer"],
      }).success,
    ).toBe(true);
  });

  it("validates transaction type and transaction entry schemas", () => {
    expect(
      TransactionTypeSchema.safeParse({
        name: "Penjualan Tunai",
        code: "TRX-001",
        debitAccountId: "coa-1102",
        creditAccountId: "coa-4101",
        metadataSchema: [
          {
            key: "shift",
            label: "Shift",
            type: "select",
            options: ["Pagi", "Siang", "Malam"],
            required: true,
          },
        ],
      }).success,
    ).toBe(true);

    expect(
      TransactionEntrySchema.safeParse({
        transactionDate: "2026-08-20",
        transactionTypeId: "type-1",
        amount: "150000",
        metadata: { shift: "Pagi" },
      }).success,
    ).toBe(true);

    expect(
      TransactionEntrySchema.safeParse({
        transactionDate: "2026-08-20",
        transactionTypeId: "type-1",
        amount: "0,00",
        metadata: null,
      }).success,
    ).toBe(true);

    expect(
      TransactionEntrySchema.safeParse({
        transactionDate: "2026-08-20",
        transactionTypeId: "type-1",
        amount: 0,
      }).success,
    ).toBe(true);

    expect(
      TransactionEntrySchema.safeParse({
        transactionDate: "invalid-date",
        transactionTypeId: "type-1",
        amount: "150000",
      }).success,
    ).toBe(false);
  });
});
