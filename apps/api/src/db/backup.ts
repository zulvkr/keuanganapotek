import { existsSync, mkdirSync } from "node:fs";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import Database from "better-sqlite3";
import { createSqliteClient } from "./client.js";

export type BackupResult = { source: string; destination: string; integrity: "ok" };

function absolute(value: string) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

/** Creates a standalone SQLite snapshot, including committed WAL content. */
export function backupDatabase(databasePath: string, destinationPath: string): BackupResult {
  const source = absolute(databasePath);
  const destination = absolute(destinationPath);
  if (source === destination) throw new Error("Lokasi backup harus berbeda dari database sumber");
  if (!existsSync(source)) throw new Error(`Database sumber tidak ditemukan: ${source}`);
  mkdirSync(dirname(destination), { recursive: true });
  if (existsSync(destination)) throw new Error(`File backup sudah ada: ${destination}`);

  const client = createSqliteClient(source);
  try {
    client.sqlite.pragma("wal_checkpoint(PASSIVE)");
    client.sqlite.prepare("VACUUM INTO ?").run(destination);
  } finally {
    client.sqlite.close();
  }

  const verification = new Database(destination, { readonly: true });
  try {
    const integrity = verification.pragma("integrity_check", { simple: true });
    const foreignKeys = verification.pragma("foreign_key_check") as unknown[];
    if (integrity !== "ok" || foreignKeys.length > 0) {
      throw new Error("Backup gagal melewati pemeriksaan integritas SQLite");
    }
  } finally {
    verification.close();
  }
  return { source, destination, integrity: "ok" };
}

function defaultDestination() {
  const stamp = new Date().toISOString().replaceAll(/[-:TZ.]/g, "").slice(0, 14);
  return resolve(process.cwd(), "backups", `keuangan-apotek-${stamp}.sqlite`);
}

const invokedFile = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (invokedFile.endsWith("/db/backup.ts") || invokedFile.endsWith("/db/backup.js")) {
  const source = process.env.DATABASE_PATH ?? "data/keuangan-apotek.sqlite";
  const destination = process.argv[2] ?? defaultDestination();
  const result = backupDatabase(source, destination);
  console.log(`Backup SQLite berhasil: ${basename(result.destination)} (integrity: ${result.integrity})`);
}
