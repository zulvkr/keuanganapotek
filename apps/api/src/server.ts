import { serve } from "@hono/node-server";
import { createApiApp } from "./app.js";
import { createSqliteClient } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";
import { seedAccounts } from "./db/seed.js";

const client = createSqliteClient();
runMigrations(client.sqlite);
seedAccounts(client);
const app = createApiApp(client);

const port = Number(process.env.API_PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
