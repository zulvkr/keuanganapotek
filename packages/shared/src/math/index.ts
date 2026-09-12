import Decimal from "decimal.js";

export type MoneyInput = Decimal.Value;

const PPN_RATE = new Decimal("0.11");

function asDecimal(value: MoneyInput): Decimal {
  return new Decimal(value);
}

/** Calculates an exact PPN amount from a rupiah-denominated DPP. */
export function calculatePpn(dpp: MoneyInput): Decimal {
  return asDecimal(dpp).times(PPN_RATE);
}

/** Calculates an exact invoice total from DPP and PPN. */
export function calculateInvoiceTotal(dpp: MoneyInput, ppn = calculatePpn(dpp)): Decimal {
  return asDecimal(dpp).plus(ppn);
}

export type JournalAmountLine = {
  debit: MoneyInput;
  credit: MoneyInput;
};

export type DebitCreditTotals = {
  debit: Decimal;
  credit: Decimal;
  difference: Decimal;
};

/** Sums journal amounts without using binary floating-point arithmetic. */
export function sumDebitCredit(lines: readonly JournalAmountLine[]): DebitCreditTotals {
  const debit = lines.reduce((total, line) => total.plus(asDecimal(line.debit)), new Decimal(0));
  const credit = lines.reduce((total, line) => total.plus(asDecimal(line.credit)), new Decimal(0));

  return {
    debit,
    credit,
    difference: debit.minus(credit),
  };
}

export function isBalanced(lines: readonly JournalAmountLine[]): boolean {
  return sumDebitCredit(lines).difference.isZero();
}

/** Converts a rupiah amount to integer sen after exact Decimal arithmetic. */
export function rupiahToSen(value: MoneyInput): number {
  const sen = asDecimal(value).times(100);
  if (!sen.isInteger() || !sen.isFinite() || (!sen.isPositive() && !sen.isZero())) {
    throw new RangeError("Nominal rupiah harus berupa nilai non-negatif dengan maksimal 2 desimal");
  }

  const result = Number(sen.toFixed(0));
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Nominal rupiah melebihi batas integer aman JavaScript");
  }
  return result;
}

/** Returns the absolute amount needed to balance an opening-balance batch. */
export function balancingAmount(debit: MoneyInput, credit: MoneyInput): Decimal {
  return asDecimal(debit).minus(asDecimal(credit)).abs();
}

/** Parses Indonesian rupiah display text and converts it to integer sen. */
export function parseRupiahToSen(value: string): number {
  const normalized = value
    .trim()
    .replace(/^rp\.?\s*/i, "")
    .replace(/\s/g, "");

  if (!normalized) {
    return 0;
  }

  const thousandGroups = /^\d{1,3}(?:\.\d{3})+$/.test(normalized);
  const canonical = normalized.includes(",")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : thousandGroups
      ? normalized.replace(/\./g, "")
      : normalized;

  return rupiahToSen(canonical);
}

export function senToRupiah(value: MoneyInput): Decimal {
  return asDecimal(value).dividedBy(100);
}
