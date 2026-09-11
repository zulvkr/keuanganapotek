import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

export function createSqliteClient(databasePath = process.env.DATABASE_PATH ?? "data/keuangan-apotek.sqlite") {
  const resolvedPath = databasePath === ":memory:"
    ? databasePath
    : isAbsolute(databasePath)
      ? databasePath
      : resolve(process.cwd(), databasePath);

  if (resolvedPath !== ":memory:") {
    mkdirSync(dirname(resolvedPath), { recursive: true });
  }

  const sqlite = new Database(resolvedPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");

  return {
    sqlite,
    db: drizzle(sqlite),
  };
}

export type SqliteClient = ReturnType<typeof createSqliteClient>;
