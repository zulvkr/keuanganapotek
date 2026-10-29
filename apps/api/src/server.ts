import { serve } from "@hono/node-server";
import { createApiApp } from "./app.js";
import { createSqliteClient } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { getOpeningBalanceCutoff } from "./services/opening-balance.service.js";
import { seedAccounts, seedOpeningBalances, seedTransactionTypes, seedUsers } from "./db/seed.js";

const client = createSqliteClient();
runMigrations(client.sqlite);

const shouldSeedCoa =
  process.env.SEED_DEFAULT_COA === "true" ||
  process.env.SEED_DEFAULT_ACCOUNTS === "true" ||
  process.env.NODE_ENV === "test";

if (shouldSeedCoa) {
  seedAccounts(client);
  seedTransactionTypes(client);
  if (!getOpeningBalanceCutoff(client.db)) {
    await seedOpeningBalances(client);
  }
}

if (process.env.SEED_DEFAULT_USERS === "true") {
  seedUsers(client);
}
const app = createApiApp(client);

const port = Number(process.env.API_PORT ?? 3000);
const hostname = process.env.HOST ?? "0.0.0.0";

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`API listening on http://${info.address}:${info.port}`);
});
