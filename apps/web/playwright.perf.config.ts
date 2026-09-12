import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.WEB_PORT ?? process.env.E2E_WEB_PORT ?? 5173);

export default defineConfig({
  testDir: "./src/__tests__/perf",
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${webPort}`, ...devices["Desktop Chrome"] },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${webPort}`,
    url: `http://127.0.0.1:${webPort}`,
    reuseExistingServer: !process.env.CI,
  },
});
