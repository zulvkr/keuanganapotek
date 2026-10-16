import { DEFAULT_ASSISTANT_ALLOWED_COA_CODES, type AuthUser } from "@keuangan-apotek/shared";
import type { SqliteClient } from "../client.js";
import { createUser, getUserById, getUserByUsername } from "../../services/auth.service.js";

export function seedUsers(client: SqliteClient): { admin: AuthUser; asisten: AuthUser } {
  const adminExisting = getUserByUsername(client.db, "admin");
  let adminUser: AuthUser;
  if (!adminExisting) {
    adminUser = createUser(client.db, {
      username: "admin",
      password: "admin123",
      name: "Apoteker Admin (Owner)",
      role: "admin",
      allowedCoaCodes: [],
    });
  } else {
    adminUser = getUserById(client.db, adminExisting.id)!;
  }

  const asistenExisting = getUserByUsername(client.db, "asisten");
  let asistenUser: AuthUser;
  if (!asistenExisting) {
    asistenUser = createUser(client.db, {
      username: "asisten",
      password: "asisten123",
      name: "Asisten Apotek (Kasir)",
      role: "asisten",
      allowedCoaCodes: DEFAULT_ASSISTANT_ALLOWED_COA_CODES,
    });
  } else {
    asistenUser = getUserById(client.db, asistenExisting.id)!;
  }

  return { admin: adminUser, asisten: asistenUser };
}
