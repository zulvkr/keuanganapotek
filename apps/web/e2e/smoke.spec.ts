import { expect, test } from "@playwright/test";

test("loads the foundation shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Ruang kerja akuntansi/i })).toBeVisible();
  await expect(page.getByText("Sistem Aktif")).toBeVisible();
});
