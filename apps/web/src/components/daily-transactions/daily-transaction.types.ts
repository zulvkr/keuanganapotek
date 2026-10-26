import { parseRupiahToSen, senToRupiah } from "@keuangan-apotek/shared";

export type DraftRow = {
  isNew?: boolean;
  id: string;
  transactionDate: string;
  transactionTypeId: string;
  amount: string;
  pic: string;
  metadata: Record<string, any>;
  sortOrder?: number;
  insertAfterId?: string;
  insertBeforeId?: string;
};

export type ActiveMetadataRowIndex = {
  isDraft: boolean;
  idOrIndex: string | number;
} | null;

export type SortColumn = "bookOrder" | "transactionDate" | "transactionTypeName" | "amount" | "pic";

export const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatSen(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0,00";

  if (typeof value === "string") {
    // If it contains Indonesian thousand separators or decimal comma like "50.000,00"
    if (
      value.includes(",") ||
      (value.includes(".") && value.indexOf(".") !== value.lastIndexOf("."))
    ) {
      try {
        const sen = parseRupiahToSen(value);
        return formatSen(sen);
      } catch {
        return value;
      }
    }
    const num = Number(value);
    if (!Number.isNaN(num)) {
      value = num;
    } else {
      return value;
    }
  }

  const isNegative = value < 0;
  const absValue = Math.abs(value);
  try {
    const rupiah = senToRupiah(absValue);
    const fixed = rupiah.toFixed(2);
    const [whole, fraction] = fixed.split(".");
    const formattedWhole = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${isNegative ? "-" : ""}${formattedWhole},${fraction}`;
  } catch {
    return String(value);
  }
}

export function formatAmountInput(value: string): string {
  try {
    const sen = parseRupiahToSen(value || "0");
    const fixed = senToRupiah(sen).toFixed(2);
    const [whole, fraction] = fixed.split(".");
    return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
  } catch {
    return value;
  }
}

export function formatMonthYearId(yearMonth: string): string {
  const parts = yearMonth.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!y || !m || m < 1 || m > 12) return yearMonth;
  return `${MONTH_NAMES_ID[m - 1]} ${y}`;
}

export function getMonthRange(yearMonth: string): { startDate: string; endDate: string } {
  const parts = yearMonth.split("-").map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? new Date().getMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function stepMonth(yearMonth: string, offset: number): string {
  const parts = yearMonth.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? new Date().getMonth() + 1;
  const totalMonths = y * 12 + (m - 1) + offset;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}
