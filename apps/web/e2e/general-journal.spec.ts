import { expect, test } from "@playwright/test";

test("adds a journal row from the last credit cell and keeps posting disabled while empty", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Jurnal Umum" }).click();
  await expect(page.locator("h2", { hasText: "Jurnal Umum" })).toBeVisible();

  const creditCells = page.getByRole("textbox", { name: /Kredit baris/ });
  await expect(creditCells).toHaveCount(2);
  await creditCells.last().press("Tab");
  await expect(page.getByRole("textbox", { name: /Kredit baris/ })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Posting Jurnal" })).toBeDisabled();
});
