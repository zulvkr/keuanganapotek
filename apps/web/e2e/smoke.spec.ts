import { expect, test } from "@playwright/test";

test("loads the foundation shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Buku Transaksi" })).toBeVisible();
  await expect(page.getByText("Sistem Aktif")).toBeVisible();
});
