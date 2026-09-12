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

test("renders the 5,000-row grid with only viewport rows in the DOM", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Uji Beban" }).click();
  await page.getByRole("button", { name: "5.000 jurnal" }).waitFor();
  const elapsed = await page.evaluate(
    () =>
      (window as Window & { __phase6GridRenderMs?: number }).__phase6GridRenderMs ??
      Number.POSITIVE_INFINITY,
  );
  const mountedRows = await page.locator('[aria-label="Grid stress jurnal"] [data-index]').count();
  expect(elapsed).toBeLessThan(100);
  expect(mountedRows).toBeLessThan(100);
  expect(mountedRows).toBeGreaterThan(0);
});
