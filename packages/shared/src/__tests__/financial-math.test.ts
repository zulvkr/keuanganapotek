import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateInvoiceTotal,
  calculatePpn,
  isBalanced,
  parseRupiahToSen,
  rupiahToSen,
  sumDebitCredit,
} from "../index.js";

describe("financial math", () => {
  it("calculates PPN and invoice total exactly", () => {
    expect(calculatePpn("1000000").equals(new Decimal("110000"))).toBe(true);
    expect(calculateInvoiceTotal("1000000").equals(new Decimal("1110000"))).toBe(true);
    expect(calculatePpn("12345").equals(new Decimal("1357.95"))).toBe(true);
  });

  it("balances debit and credit with Decimal arithmetic", () => {
    const balanced = sumDebitCredit([
      { debit: "1000000", credit: 0 },
      { debit: 0, credit: "400000" },
      { debit: 0, credit: "600000" },
    ]);
    expect(balanced.difference.isZero()).toBe(true);
    expect(isBalanced([
      { debit: "0.1", credit: 0 },
      { debit: "0.2", credit: "0.3" },
    ])).toBe(true);
    expect(sumDebitCredit([{ debit: "500000", credit: "400000" }]).difference.toString()).toBe("100000");
  });

  it("converts Indonesian rupiah display values to integer sen", () => {
    expect(parseRupiahToSen("Rp 1.500.000,00")).toBe(150000000);
    expect(rupiahToSen("12345.67")).toBe(1234567);
  });
});
