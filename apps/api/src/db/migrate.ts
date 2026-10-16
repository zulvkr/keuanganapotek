import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { createSqliteClient } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getMigrationsFolder(): string {
  const candidates = [
    resolve(__dirname, "migrations"),
    resolve(__dirname, "../src/db/migrations"),
    resolve(__dirname, "../../src/db/migrations"),
    resolve(process.cwd(), "apps/api/src/db/migrations"),
    resolve(process.cwd(), "src/db/migrations"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return resolve(__dirname, "migrations");
}

export function runMigrations(sqlite: Database.Database): void {
  sqlite.pragma("foreign_keys = ON");
  const folder = getMigrationsFolder();

  // Baseline support: If the database already had tables created before Drizzle migrator was introduced
  const tables = (
    sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{
      name: string;
    }>
  ).map((r) => r.name);

  if (tables.includes("accounts")) {
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash text NOT NULL,
        created_at numeric
      )`,
    );
    const existing = sqlite.prepare("SELECT COUNT(*) as count FROM __drizzle_migrations").get() as {
      count: number;
    };
    if (existing.count === 0) {
      const files = readMigrationFiles({ migrationsFolder: folder });
      const first = files[0];
      if (first) {
        sqlite
          .prepare("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)")
          .run(first.hash, first.folderMillis);
      }
    }
  }

  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: folder });
}

const invokedFile = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (invokedFile.endsWith("/db/migrate.ts") || invokedFile.endsWith("/db/migrate.js")) {
  const client = createSqliteClient();
  runMigrations(client.sqlite);
  client.sqlite.close();
  console.log("Database migrations applied successfully via Drizzle ORM.");
}
