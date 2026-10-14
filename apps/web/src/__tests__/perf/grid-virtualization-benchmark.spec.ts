import { test, expect } from "@playwright/test";
import { generateStressInvoices, generateStressJournals } from "../../test-utils/stress-data";

test("stress fixtures contain the Phase 6 volume targets", () => {
  const started = performance.now();
  const journals = generateStressJournals();
  const invoices = generateStressInvoices();
  const elapsed = performance.now() - started;
  expect(journals).toHaveLength(5_000);
  expect(invoices).toHaveLength(2_000);
  expect(journals[4_999]?.journalNo).toBe("JU-STRESS-05000");
  expect(invoices[1_999]?.totalAmount).toBeGreaterThan(invoices[1_999]?.dppAmount ?? 0);
  expect(elapsed).toBeLessThan(100);
});
