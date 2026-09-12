import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { nowIsoInstant } from "@keuangan-apotek/shared";
import type { SqliteClient } from "../db/client.js";
import { auditLogs } from "../db/schema/index.js";

type Db = SqliteClient["db"];
type Executor = Pick<Db, "select" | "insert">;

export function recordAudit(
  db: Executor,
  input: {
    entityType: string;
    entityId: string;
    action: "CREATE" | "UPDATE" | "DELETE" | "LOCK" | "UNLOCK";
    actor?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  db.insert(auditLogs)
    .values({
      id: randomUUID(),
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actor: input.actor ?? "system",
      beforeData: input.before === undefined ? null : JSON.stringify(input.before),
      afterData: input.after === undefined ? null : JSON.stringify(input.after),
      occurredAt: nowIsoInstant(),
    })
    .run();
}

export function listAuditLogs(db: Db, filters: { entityType?: string; entityId?: string } = {}) {
  const conditions = [];
  if (filters.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
  return db
    .select()
    .from(auditLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.occurredAt), asc(auditLogs.id))
    .all()
    .map((row) => ({
      ...row,
      before: row.beforeData ? (JSON.parse(row.beforeData) as unknown) : null,
      after: row.afterData ? (JSON.parse(row.afterData) as unknown) : null,
    }));
}
