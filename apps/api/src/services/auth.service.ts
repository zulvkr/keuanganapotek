import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import {
  DEFAULT_ASSISTANT_ALLOWED_COA_CODES,
  nowIsoInstant,
  type AuthUser,
  type SetupInput,
  type UserRole,
} from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { users, type UserRow } from "../db/schema/index.js";

type Db = SqliteClient["db"];

const AUTH_SECRET = process.env.AUTH_SECRET || "keuangan-apotek-auth-token-secret-key-2026";

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, "hex");
    return timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

export function createToken(payload: { id: string; username: string; role: UserRole }): string {
  const data = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }),
  ).toString("base64url");
  const sig = createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(
  token: string,
): { id: string; username: string; role: UserRole } | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expectedSig = createHmac("sha256", AUTH_SECRET).update(data).digest("base64url");
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return {
      id: payload.id,
      username: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

function mapUserRowToAuthUser(row: UserRow): AuthUser {
  let allowedCoaCodes: string[] = [];
  try {
    allowedCoaCodes = JSON.parse(row.allowedCoaCodes || "[]");
  } catch {
    allowedCoaCodes = [];
  }

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role as UserRole,
    allowedCoaCodes,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function getUserByUsername(db: Db, username: string): UserRow | undefined {
  return db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).get();
}

export function getUserById(db: Db, id: string): AuthUser | undefined {
  const row = db.select().from(users).where(eq(users.id, id)).get();
  return row ? mapUserRowToAuthUser(row) : undefined;
}

export function getUserCount(db: Db): number {
  const rows = db.select({ id: users.id }).from(users).all();
  return rows.length;
}

export function listUsers(db: Db): AuthUser[] {
  const rows = db.select().from(users).orderBy(asc(users.username)).all();
  return rows.map(mapUserRowToAuthUser);
}

export function initialSetup(db: Db, input: SetupInput): { user: AuthUser; token: string } {
  const count = getUserCount(db);
  if (count > 0) {
    throw new Error("Sistem sudah diinisialisasi");
  }

  const admin = createUser(db, {
    username: input.admin.username,
    password: input.admin.password,
    name: input.admin.name,
    role: "admin",
    allowedCoaCodes: [],
  });

  if (input.createAssistant && input.assistant?.username && input.assistant?.password) {
    createUser(db, {
      username: input.assistant.username,
      password: input.assistant.password,
      name: input.assistant.name || "Asisten Apotek (Kasir)",
      role: "asisten",
      allowedCoaCodes: DEFAULT_ASSISTANT_ALLOWED_COA_CODES,
    });
  }

  const token = createToken({
    id: admin.id,
    username: admin.username,
    role: admin.role,
  });

  return { user: admin, token };
}

export function authenticateUser(
  db: Db,
  username: string,
  pass: string,
): { user: AuthUser; token: string } {
  const row = getUserByUsername(db, username);
  if (!row) {
    throw new Error("Username atau password salah");
  }
  if (!row.isActive) {
    throw new Error("Akun pengguna non-aktif");
  }
  const valid = verifyPassword(pass, row.passwordHash, row.salt);
  if (!valid) {
    throw new Error("Username atau password salah");
  }
  const user = mapUserRowToAuthUser(row);
  const token = createToken({ id: user.id, username: user.username, role: user.role });
  return { user, token };
}

export function createUser(
  db: Db,
  input: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    allowedCoaCodes?: string[];
  },
): AuthUser {
  const normalizedUsername = input.username.trim().toLowerCase();
  const existing = getUserByUsername(db, normalizedUsername);
  if (existing) {
    throw new Error(`Username ${normalizedUsername} sudah digunakan`);
  }

  const { hash, salt } = hashPassword(input.password);
  const id = randomUUID();
  const now = nowIsoInstant();
  const allowed =
    input.role === "admin"
      ? []
      : input.allowedCoaCodes && input.allowedCoaCodes.length > 0
        ? input.allowedCoaCodes
        : DEFAULT_ASSISTANT_ALLOWED_COA_CODES;

  const newRow = {
    id,
    username: normalizedUsername,
    passwordHash: hash,
    salt,
    name: input.name.trim(),
    role: input.role,
    allowedCoaCodes: JSON.stringify(allowed),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(users).values(newRow).run();
  return mapUserRowToAuthUser(newRow);
}

export function updateUser(
  db: Db,
  id: string,
  input: {
    name?: string;
    password?: string;
    role?: UserRole;
    allowedCoaCodes?: string[];
    isActive?: boolean;
  },
): AuthUser {
  const existing = db.select().from(users).where(eq(users.id, id)).get();
  if (!existing) {
    throw new Error("Pengguna tidak ditemukan");
  }

  const now = nowIsoInstant();
  let hash = existing.passwordHash;
  let salt = existing.salt;
  if (input.password && input.password.trim()) {
    const creds = hashPassword(input.password);
    hash = creds.hash;
    salt = creds.salt;
  }

  const updatedRole = input.role ?? (existing.role as UserRole);
  const updatedAllowed =
    input.allowedCoaCodes !== undefined
      ? JSON.stringify(input.allowedCoaCodes)
      : existing.allowedCoaCodes;

  const updated = {
    name: input.name !== undefined ? input.name.trim() : existing.name,
    passwordHash: hash,
    salt,
    role: updatedRole,
    allowedCoaCodes: updatedAllowed,
    isActive: input.isActive !== undefined ? input.isActive : existing.isActive,
    updatedAt: now,
  };

  db.update(users).set(updated).where(eq(users.id, id)).run();

  return mapUserRowToAuthUser({
    ...existing,
    ...updated,
  });
}

export function deleteUser(db: Db, id: string): void {
  const existing = db.select().from(users).where(eq(users.id, id)).get();
  if (!existing) {
    throw new Error("Pengguna tidak ditemukan");
  }
  if (existing.username === "admin") {
    throw new Error("Akun admin utama tidak boleh dihapus");
  }
  db.delete(users).where(eq(users.id, id)).run();
}

export function updateUserPermissions(db: Db, id: string, allowedCoaCodes: string[]): AuthUser {
  const existing = db.select().from(users).where(eq(users.id, id)).get();
  if (!existing) {
    throw new Error("Pengguna tidak ditemukan");
  }
  const now = nowIsoInstant();
  db.update(users)
    .set({
      allowedCoaCodes: JSON.stringify(allowedCoaCodes),
      updatedAt: now,
    })
    .where(eq(users.id, id))
    .run();

  return mapUserRowToAuthUser({
    ...existing,
    allowedCoaCodes: JSON.stringify(allowedCoaCodes),
    updatedAt: now,
  });
}
