import { Temporal } from "@js-temporal/polyfill";

export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

/** Parses and strictly validates an ISO calendar date without timezone leakage. */
export function parseIsoDate(value: string): Temporal.PlainDate {
  const date = Temporal.PlainDate.from(value);
  if (date.toString() !== value) throw new RangeError("Tanggal harus berformat YYYY-MM-DD");
  return date;
}

export function isIsoDate(value: string): boolean {
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

/** Gets today's business date in the application's configured timezone. */
export function todayIsoDate(timeZone = DEFAULT_TIME_ZONE): string {
  return Temporal.Now.zonedDateTimeISO(timeZone).toPlainDate().toString();
}

/** Creates an unambiguous UTC timestamp for audit columns and API responses. */
export function nowIsoInstant(): string {
  return Temporal.Now.instant().toString();
}

/** Formats an ISO date for Indonesian display without constructing a JS Date. */
export function formatDateId(value: string): string {
  return parseIsoDate(value).toLocaleString("id-ID", { dateStyle: "medium" });
}

/** Returns the YYYYMM accounting period key used by journal numbering. */
export function accountingPeriod(value: string): string {
  const date = parseIsoDate(value);
  return `${String(date.year).padStart(4, "0")}${String(date.month).padStart(2, "0")}`;
}
