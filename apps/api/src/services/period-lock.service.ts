import { randomUUID } from "node:crypto";
import { asc, eq, gte } from "drizzle-orm";
import { nowIsoInstant } from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { periodLocks } from "../db/schema/index.js";
import { recordAudit } from "./audit.service.js";

type Db = SqliteClient["db"];
type Executor = Pick<Db, "select" | "insert" | "delete">;
export type PeriodLockRole = "OWNER" | "APOTEKER_PENGELOLA";

export const PERIOD_LOCKED = "PERIOD_LOCKED";

export function assertPeriodUnlocked(db: Executor, entryDate: string): void {
  const lock = db
    .select({ lockedThrough: periodLocks.lockedThrough })
    .from(periodLocks)
    .where(gte(periodLocks.lockedThrough, entryDate))
    .orderBy(asc(periodLocks.lockedThrough))
    .limit(1)
    .get();
  if (lock) throw new Error(`${PERIOD_LOCKED}: Periode sampai ${lock.lockedThrough} sudah dikunci`);
}

export function listPeriodLocks(db: Db) {
  return db.select().from(periodLocks).orderBy(asc(periodLocks.lockedThrough)).all();
}

export function lockPeriod(
  db: Db,
  input: { lockedThrough: string; actor: string; role: PeriodLockRole },
) {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(periodLocks)
      .where(eq(periodLocks.lockedThrough, input.lockedThrough))
      .get();
    if (existing) return existing;
    const row = {
      id: randomUUID(),
      lockedThrough: input.lockedThrough,
      lockedBy: input.actor,
      lockedByRole: input.role,
      lockedAt: nowIsoInstant(),
    } as const;
    tx.insert(periodLocks).values(row).run();
    recordAudit(tx, {
      entityType: "PERIOD",
      entityId: row.id,
      action: "LOCK",
      actor: input.actor,
      after: row,
    });
    return row;
  });
}

export function unlockPeriod(db: Db, lockedThrough: string, actor: string) {
  return db.transaction((tx) => {
    const existing = tx
      .select()
      .from(periodLocks)
      .where(eq(periodLocks.lockedThrough, lockedThrough))
      .get();
    if (!existing) throw new Error("Periode terkunci tidak ditemukan");
    tx.delete(periodLocks).where(eq(periodLocks.id, existing.id)).run();
    recordAudit(tx, {
      entityType: "PERIOD",
      entityId: existing.id,
      action: "UNLOCK",
      actor,
      before: existing,
    });
    return existing;
  });
}
