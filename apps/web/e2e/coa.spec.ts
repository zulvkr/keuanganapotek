import { expect, test } from "@playwright/test";

test("deletes a leaf CoA account without recursively triggering the mutation", async ({ page }) => {
  let accounts = [{
    id: "coa-9999",
    code: "9999",
    name: "Akun Uji",
    parentId: null,
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    level: 1,
    isGroup: false,
    isActive: true,
  }];

  await page.route("**/api/accounts/tree", (route) => route.fulfill({ json: { data: accounts } }));
  await page.route("**/api/opening-balances/meta", (route) => route.fulfill({ json: { data: { cutoffDate: null } } }));
  await page.route("**/api/opening-balances?*", (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/accounts/coa-9999", (route) => {
    accounts = [];
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Bagan Akun" }).click();
  await expect(page.getByRole("heading", { name: "Bagan Akun & Saldo Awal" })).toBeVisible();

  const deleteRequest = page.waitForRequest((request) => request.method() === "DELETE" && request.url().endsWith("/api/accounts/coa-9999"));
  await page.getByRole("button", { name: "Hapus 9999" }).click();
  await deleteRequest;
  await expect(page.getByRole("button", { name: "Hapus 9999" })).toHaveCount(0);
});
