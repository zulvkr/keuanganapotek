import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  nowIsoInstant,
  type ApiKeyItem,
  type AuthUser,
  type CreatedApiKeyResult,
  type UserRole,
} from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { apiKeys, users, type ApiKeyRow } from "../db/schema/index.js";
import { getUserById } from "./auth.service.js";

type Db = SqliteClient["db"];

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey.trim()).digest("hex");
}

function mapApiKeyRow(
  row: ApiKeyRow,
  user?: { name: string; username: string; role: string },
): ApiKeyItem {
  let scopes: string[] = [];
  try {
    scopes = JSON.parse(row.scopes || "[]");
  } catch {
    scopes = [];
  }

  return {
    id: row.id,
    userId: row.userId,
    userName: user?.name,
    userRole: user?.role as UserRole | undefined,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes,
    isActive: row.isActive,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function generateApiKey(
  db: Db,
  input: {
    userId: string;
    name: string;
    expiresAt?: string | null;
    scopes?: string[];
  },
): CreatedApiKeyResult {
  let userId = input.userId;
  let user = getUserById(db, userId);
  if (!user) {
    const firstAdmin = db.select().from(users).where(eq(users.role, "admin")).get();
    if (firstAdmin) {
      userId = firstAdmin.id;
      user = getUserById(db, userId);
    } else {
      const anyUser = db.select().from(users).get();
      if (anyUser) {
        userId = anyUser.id;
        user = getUserById(db, userId);
      }
    }
  }
  if (!user) {
    throw new Error("Pengguna tidak ditemukan");
  }

  const id = randomUUID();
  const rawKey = `ka_live_${randomBytes(24).toString("hex")}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = `${rawKey.slice(0, 12)}...${rawKey.slice(-4)}`;
  const now = nowIsoInstant();
  const scopes = input.scopes || ["read", "write"];

  const newRow: ApiKeyRow = {
    id,
    userId,
    name: input.name.trim(),
    keyHash,
    keyPrefix,
    scopes: JSON.stringify(scopes),
    isActive: true,
    lastUsedAt: null,
    expiresAt: input.expiresAt ? input.expiresAt.trim() : null,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(apiKeys).values(newRow).run();

  return {
    ...mapApiKeyRow(newRow, { name: user.name, username: user.username, role: user.role }),
    key: rawKey,
  };
}

export function verifyApiKey(db: Db, rawKey: string): AuthUser | null {
  if (!rawKey || !rawKey.startsWith("ka_")) {
    return null;
  }

  const keyHash = hashApiKey(rawKey);
  const row = db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
    .get();

  if (!row) {
    return null;
  }

  if (row.expiresAt) {
    const today = new Date().toISOString().slice(0, 10);
    if (row.expiresAt < today) {
      return null;
    }
  }

  // Update lastUsedAt
  const now = nowIsoInstant();
  db.update(apiKeys).set({ lastUsedAt: now, updatedAt: now }).where(eq(apiKeys.id, row.id)).run();

  const user = getUserById(db, row.userId);
  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

export function listApiKeys(db: Db, filterUserId?: string): ApiKeyItem[] {
  const query = db
    .select({
      apiKey: apiKeys,
      userName: users.name,
      userRole: users.role,
      userUsername: users.username,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .orderBy(desc(apiKeys.createdAt));

  const rows = filterUserId ? query.where(eq(apiKeys.userId, filterUserId)).all() : query.all();

  return rows.map((r) =>
    mapApiKeyRow(r.apiKey, {
      name: r.userName,
      username: r.userUsername,
      role: r.userRole,
    }),
  );
}

export function revokeApiKey(db: Db, id: string, authorizedUserId?: string, isAdmin = false): void {
  const existing = db.select().from(apiKeys).where(eq(apiKeys.id, id)).get();
  if (!existing) {
    throw new Error("API Key tidak ditemukan");
  }

  if (!isAdmin && authorizedUserId && existing.userId !== authorizedUserId) {
    throw new Error("Akses ditolak: Tidak dapat mencabut API Key milik pengguna lain");
  }

  db.delete(apiKeys).where(eq(apiKeys.id, id)).run();
}
