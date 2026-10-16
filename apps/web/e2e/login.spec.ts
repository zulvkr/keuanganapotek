import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("shows the login screen when unauthenticated and has no quick login buttons", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Keuangan Apotek" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Masuk ke Akun" })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();

  // Ensure quick login / autofill buttons do not exist
  await expect(page.getByText("Akun Bawaan Sistem")).toHaveCount(0);
  await expect(page.getByText("Beralih Pengguna Cepat")).toHaveCount(0);
  await expect(page.getByText("Simulasi Role Cepat")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /admin123/i })).toHaveCount(0);
});

test("shows error message when login fails", async ({ page }) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      json: { error: "Username atau password salah" },
    }),
  );

  await page.goto("/");
  await page.getByLabel("Username").fill("wronguser");
  await page.getByLabel("Password").fill("wrongpass");
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page.getByRole("alert").first()).toContainText("Username atau password salah");
});

test("logs in successfully and logs out back to login screen", async ({ page }) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        data: {
          token: "token-test-123",
          user: {
            id: "user-admin",
            username: "admin",
            name: "Apoteker Admin",
            role: "admin",
            allowedCoaCodes: [],
          },
        },
      },
    }),
  );
  await page.route("**/api/accounts/tree", (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/transactions*", (route) => route.fulfill({ json: { data: [] } }));
  await page.route("**/api/transaction-types*", (route) => route.fulfill({ json: { data: [] } }));

  await page.goto("/");
  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Masuk" }).click();

  // Wait for main dashboard to be displayed
  await expect(page.getByRole("heading", { name: "Buku Transaksi" })).toBeVisible();
  await expect(page.getByText("Sistem Aktif")).toBeVisible();

  // Check user dropdown does not have quick switch button
  await page.getByRole("button", { name: /Admin/i }).click();
  await expect(page.getByText("Beralih Pengguna Cepat")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Masuk sebagai/i })).toHaveCount(0);

  // Logout
  await page.getByRole("button", { name: "Keluar dari Akun" }).click();

  // Should return to login screen
  await expect(page.getByRole("heading", { name: "Masuk ke Akun" })).toBeVisible();
});
