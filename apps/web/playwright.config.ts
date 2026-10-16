import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.WEB_PORT ?? process.env.E2E_WEB_PORT ?? 5173);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: "on-first-retry",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://127.0.0.1:${webPort}`,
          localStorage: [
            {
              name: "ka_auth_token",
              value: "test-token-admin",
            },
            {
              name: "ka_auth_user",
              value: JSON.stringify({
                id: "user-admin",
                username: "admin",
                name: "Apoteker Admin (Owner)",
                role: "admin",
                allowedCoaCodes: [],
              }),
            },
          ],
        },
      ],
    },
  },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${webPort}`,
    url: `http://127.0.0.1:${webPort}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
