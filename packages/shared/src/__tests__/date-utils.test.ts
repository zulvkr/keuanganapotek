import { describe, expect, it } from "vitest";
import { accountingPeriod, isIsoDate, parseIsoDate } from "../date/index.js";

describe("Temporal date utilities", () => {
  it("strictly validates calendar dates without timezone conversion", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-2-8")).toBe(false);
    expect(parseIsoDate("2026-09-11").toString()).toBe("2026-09-11");
  });

  it("derives accounting periods from Temporal calendar fields", () => {
    expect(accountingPeriod("2026-09-11")).toBe("202609");
  });
});
