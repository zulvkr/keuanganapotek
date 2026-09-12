import { Hono } from "hono";
import type { Context } from "hono";
import type { MiddlewareHandler } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  AccountSchema,
  JournalEntrySchema,
  LockOpeningBalanceSchema,
  nowIsoInstant,
  SaveOpeningBalancesSchema,
  CashBankTransferSchema,
  ConsignmentItemSchema,
  ConsignmentSettlementSchema,
  ConsignmentVendorSchema,
  PbfInvoiceSchema,
  PosClearingSchema,
  PosPaymentMethodSchema,
  AccountJournalDrillDownQuerySchema,
  BalanceSheetQuerySchema,
  IncomeStatementQuerySchema,
  ReportPeriodSchema,
  TrialBalanceQuerySchema,
  LockPeriodSchema,
  UnlockPeriodSchema,
  BankReconMatchSchema,
  BankStatementImportSchema,
} from "@keuangan-apotek/shared";
import type { SourceModule } from "@keuangan-apotek/shared";
import type { SqliteClient } from "./db/client.js";
import { accounts } from "./db/schema/index.js";
import {
  autoBalanceOpeningBalances,
  calculateOpeningBalanceTotals,
  getOpeningBalances,
  getOpeningBalanceCutoff,
  listAccounts,
  lockOpeningBalance,
  saveOpeningBalances,
} from "./services/opening-balance.service.js";
import {
  createJournalEntry,
  deleteJournal,
  getJournalById,
  listJournals,
  updateJournal,
} from "./services/ledger.service.js";
import type { HealthResponse } from "@keuangan-apotek/shared";
import {
  createCashBankTransfer,
  createConsignmentItem,
  createConsignmentVendor,
  createPbfInvoice,
  createPosClearing,
  generatePosJournal,
  getCashBankSummary,
  listPosPaymentMethods,
  listCashBankTransfers,
  listConsignmentItems,
  listPbfInvoices,
  listPosClearings,
  savePosPaymentMethod,
  settleConsignment,
} from "./services/operational.service.js";
import {
  autoMatch,
  getReconData,
  importBankStatementCsv,
  importBankStatements,
  manualMatch,
  removeMatch,
} from "./services/recon.service.js";
import {
  getAccountJournalDrillDown,
  getBalanceSheet,
  getIncomeStatement,
  getTrialBalance,
} from "./services/reports.service.js";
import { listAuditLogs } from "./services/audit.service.js";
import { listPeriodLocks, lockPeriod, unlockPeriod } from "./services/period-lock.service.js";

function healthHandler(context: Context) {
  const response: HealthResponse = {
    status: "ok",
    service: "api",
    timestamp: nowIsoInstant(),
  };
  return context.json(response);
}

/** Lightweight health-check app kept for existing API consumers and tests. */
export const app = new Hono().get("/health", healthHandler);

/** Runtime Zod validation also becomes the JSON input contract exposed by Hono RPC. */
type JsonValidator<S extends z.ZodTypeAny> = MiddlewareHandler<
  any,
  any,
  { in: { json: z.input<S> }; out: { json: z.output<S> } },
  Response
>;

function validateJson<S extends z.ZodTypeAny>(
  schema: S,
  invalidStatus: 400 | 403 = 400,
): JsonValidator<S> {
  return validator("json", (value, context) => {
    const parsed = schema.safeParse(value);
    return parsed.success
      ? parsed.data
      : context.json({ error: parsed.error.flatten() }, invalidStatus);
  }) as unknown as JsonValidator<S>;
}

function validateQuery<S extends z.ZodType>(schema: S) {
  return validator("query", (value, context) => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : context.json({ error: parsed.error.flatten() }, 400);
  }) as unknown as MiddlewareHandler<
    any,
    any,
    { in: { query: z.input<S> }; out: { query: z.output<S> } },
    any
  >;
}

const OpeningBalancesQuerySchema = z.object({ cutoffDate: z.string().min(1) });
const JournalListQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sourceModule: z.string().optional(),
});
const BankReconQuerySchema = z.object({ bankAccountId: z.string().min(1) });
const ReportQuerySchema = z.object({
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  compareStartDate: z.string().optional(),
  compareEndDate: z.string().optional(),
  comparePeriodStart: z.string().optional(),
  comparePeriodEnd: z.string().optional(),
  asOfDate: z.string().optional(),
  accountId: z.string().optional(),
});

const BankReconImportRequestSchema = z.union([
  z.object({ bankAccountId: z.string().min(1), csv: z.string() }),
  BankStatementImportSchema,
]);

function errorResponse(context: Context, error: unknown) {
  const message = error instanceof Error ? error.message : "Permintaan tidak valid";
  const status = message.startsWith("PERIOD_LOCKED")
    ? (403 as const)
    : message.includes("tidak ditemukan")
      ? (404 as const)
      : message.includes("sudah dikunci") ||
          message.includes("hanya boleh memiliki satu") ||
          message.includes("sistem") ||
          message.includes("grup")
        ? (409 as const)
        : (400 as const);
  return context.json({ error: message }, status);
}

const sourceModules: SourceModule[] = [
  "GENERAL",
  "OPENING_BALANCE",
  "POS_CLEARING",
  "PBF_INVOICE",
  "CONSIGNMENT",
  "CASH_BANK",
];

/** Creates the Phase 1 API with a caller-owned database connection. */
export function createApiApp(client: SqliteClient) {
  function readPeriod(
    context: Context,
    startKeys: string[] = ["startDate"],
    endKeys: string[] = ["endDate"],
  ) {
    const startDate = startKeys.map((key) => context.req.query(key)).find(Boolean);
    const endDate = endKeys.map((key) => context.req.query(key)).find(Boolean);
    return ReportPeriodSchema.safeParse({ startDate, endDate });
  }

  const drillDownHandler = (context: Context) => {
    const accountId = context.req.param("id") ?? context.req.query("accountId");
    const period = readPeriod(context);
    const parsed = AccountJournalDrillDownQuerySchema.safeParse({
      accountId,
      period: period.success ? period.data : undefined,
    });
    if (!parsed.success) return context.json({ error: parsed.error.flatten() }, 400);
    try {
      return context.json({ data: getAccountJournalDrillDown(client.db, parsed.data) });
    } catch (error) {
      return errorResponse(context, error);
    }
  };

  const reportRoutes = new Hono()
    .get("/income-statement", validateQuery(ReportQuerySchema), (context) => {
      const period = readPeriod(context, ["periodStart", "startDate"], ["periodEnd", "endDate"]);
      if (!period.success) return context.json({ error: period.error.flatten() }, 400);
      const compareStart =
        context.req.query("compareStartDate") ?? context.req.query("comparePeriodStart");
      const compareEnd =
        context.req.query("compareEndDate") ?? context.req.query("comparePeriodEnd");
      const comparePeriod =
        compareStart || compareEnd
          ? ReportPeriodSchema.safeParse({ startDate: compareStart, endDate: compareEnd })
          : undefined;
      if (comparePeriod && !comparePeriod.success)
        return context.json({ error: comparePeriod.error.flatten() }, 400);
      const parsed = IncomeStatementQuerySchema.safeParse({
        period: period.data,
        comparePeriod: comparePeriod?.data,
      });
      if (!parsed.success) return context.json({ error: parsed.error.flatten() }, 400);
      return context.json({ data: getIncomeStatement(client.db, parsed.data) });
    })
    .get("/balance-sheet", validateQuery(ReportQuerySchema), (context) => {
      const parsed = BalanceSheetQuerySchema.safeParse({ asOfDate: context.req.query("asOfDate") });
      if (!parsed.success) return context.json({ error: parsed.error.flatten() }, 400);
      return context.json({ data: getBalanceSheet(client.db, parsed.data.asOfDate) });
    })
    .get("/trial-balance", validateQuery(ReportQuerySchema), (context) => {
      const parsed = TrialBalanceQuerySchema.safeParse({
        startDate: context.req.query("startDate"),
        endDate: context.req.query("endDate"),
      });
      if (!parsed.success) return context.json({ error: parsed.error.flatten() }, 400);
      return context.json({ data: getTrialBalance(client.db, parsed.data) });
    })
    .get("/accounts/:id/journal-drill-down", validateQuery(ReportQuerySchema), drillDownHandler)
    .get("/account-journal-drill-down", validateQuery(ReportQuerySchema), drillDownHandler);

  const routes = new Hono()
    .use("/api/*", cors({ origin: (origin) => origin || "*" }))
    .get("/health", healthHandler)
    .route("/api/reports", reportRoutes)

    .get("/api/accounts/tree", async (context) =>
      context.json({ data: await listAccounts(client.db) }),
    )

    .post("/api/accounts", validateJson(AccountSchema), async (context) => {
      const account = context.req.valid("json");
      const id = account.id ?? randomUUID();
      try {
        const existing = client.db
          .select({ isGroup: accounts.isGroup })
          .from(accounts)
          .where(eq(accounts.id, id))
          .get();
        if (existing?.isGroup)
          throw new Error("Akun grup sistem bersifat tetap dan tidak dapat diubah");
        client.db
          .insert(accounts)
          .values({
            id,
            code: account.code,
            name: account.name,
            parentId: account.parentId ?? null,
            classification: account.classification,
            normalBalance: account.normalBalance,
            level: account.level,
            isGroup: false,
            isActive: account.isActive,
          })
          .onConflictDoUpdate({
            target: accounts.id,
            set: {
              code: account.code,
              name: account.name,
              parentId: account.parentId ?? null,
              classification: account.classification,
              normalBalance: account.normalBalance,
              level: account.level,
              isActive: account.isActive,
              updatedAt: nowIsoInstant(),
            },
          })
          .run();
        return context.json({ data: { ...account, id, isGroup: false } });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .delete("/api/accounts/:id", async (context) => {
      try {
        const account = client.db
          .select({ isGroup: accounts.isGroup })
          .from(accounts)
          .where(eq(accounts.id, context.req.param("id")))
          .get();
        if (account?.isGroup) throw new Error("Akun grup sistem tidak boleh dihapus");
        const result = client.db
          .delete(accounts)
          .where(eq(accounts.id, context.req.param("id")))
          .run();
        if (result.changes === 0) return context.json({ error: "Akun tidak ditemukan" }, 404);
        return context.body(null, 204);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/opening-balances", validateQuery(OpeningBalancesQuerySchema), async (context) => {
      const cutoffDate = context.req.valid("query").cutoffDate;
      try {
        return context.json({ data: await getOpeningBalances(client.db, cutoffDate) });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/opening-balances/meta", (context) =>
      context.json({ data: { cutoffDate: getOpeningBalanceCutoff(client.db) } }),
    )

    .post(
      "/api/opening-balances/auto-balance",
      validateJson(SaveOpeningBalancesSchema),
      async (context) => {
        const parsed = { data: context.req.valid("json") };
        const equity = client.db
          .select({ id: accounts.id })
          .from(accounts)
          .where(eq(accounts.code, "3101"))
          .get();
        if (!equity)
          return context.json({ error: "Akun 3101 Ekuitas Saldo Awal belum tersedia" }, 500);
        const lines = autoBalanceOpeningBalances(parsed.data.lines, equity.id);
        return context.json({
          data: {
            cutoffDate: parsed.data.cutoffDate,
            lines,
            totals: calculateOpeningBalanceTotals(lines),
          },
        });
      },
    )

    .post(
      "/api/opening-balances/save",
      validateJson(SaveOpeningBalancesSchema),
      async (context) => {
        const parsed = { data: context.req.valid("json") };
        try {
          await saveOpeningBalances(client.db, parsed.data);
          return context.json({ data: { saved: true, cutoffDate: parsed.data.cutoffDate } });
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    .post("/api/opening-balances/lock", validateJson(LockOpeningBalanceSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        const journal = await lockOpeningBalance(client.db, parsed.data.cutoffDate);
        return context.json({ data: { locked: true, journal } });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/period-locks", (context) => context.json({ data: listPeriodLocks(client.db) }))

    .post("/api/period-locks", validateJson(LockPeriodSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        return context.json({ data: lockPeriod(client.db, parsed.data) }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .post(
      "/api/period-locks/:lockedThrough/unlock",
      validateJson(UnlockPeriodSchema, 403),
      async (context) => {
        const parsed = { data: context.req.valid("json") };
        try {
          return context.json({
            data: unlockPeriod(client.db, context.req.param("lockedThrough")!, parsed.data.actor),
          });
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    .get("/api/audit-logs", (context) =>
      context.json({
        data: listAuditLogs(client.db, {
          entityType: context.req.query("entityType"),
          entityId: context.req.query("entityId"),
        }),
      }),
    )

    .get("/api/journals", validateQuery(JournalListQuerySchema), (context) => {
      const startDate = context.req.query("startDate");
      const endDate = context.req.query("endDate");
      const sourceModule = context.req.query("sourceModule");
      if (sourceModule && !sourceModules.includes(sourceModule as SourceModule))
        return context.json({ error: "sourceModule tidak valid" }, 400);
      if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
        return context.json({ error: "startDate tidak valid" }, 400);
      if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate))
        return context.json({ error: "endDate tidak valid" }, 400);
      if (startDate && endDate && startDate > endDate)
        return context.json({ error: "Rentang tanggal tidak valid" }, 400);
      return context.json({
        data: listJournals(client.db, {
          startDate,
          endDate,
          sourceModule: sourceModule as SourceModule | undefined,
        }),
      });
    })

    .get("/api/journals/:id", (context) => {
      const journal = getJournalById(client.db, context.req.param("id"));
      return journal
        ? context.json({ data: journal })
        : context.json({ error: "Jurnal tidak ditemukan" }, 404);
    })

    .post("/api/journals/general", validateJson(JournalEntrySchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        return context.json(
          {
            data: createJournalEntry(client.db, {
              ...parsed.data,
              sourceModule: "GENERAL",
              createdBy: context.req.header("x-user-id") ?? "system",
            }),
          },
          201,
        );
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .put("/api/journals/:id", validateJson(JournalEntrySchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        return context.json({
          data: updateJournal(client.db, context.req.param("id")!, {
            ...parsed.data,
            sourceModule: "GENERAL",
            createdBy: context.req.header("x-user-id") ?? "system",
          }),
        });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .delete("/api/journals/:id", (context) => {
      try {
        deleteJournal(client.db, context.req.param("id"));
        return context.body(null, 204);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/pos-clearings", (context) => context.json({ data: listPosClearings(client.db) }))
    .post("/api/pos-payment-methods", validateJson(PosPaymentMethodSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        return context.json({ data: savePosPaymentMethod(client.db, parsed.data) });
      } catch (error) {
        return errorResponse(context, error);
      }
    })
    .get("/api/pos-payment-methods", (context) => {
      try {
        return context.json({ data: listPosPaymentMethods(client.db) });
      } catch (error) {
        return errorResponse(context, error);
      }
    })
    .post("/api/pos-clearings", validateJson(PosClearingSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        return context.json({ data: createPosClearing(client.db, parsed.data) }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })
    .post("/api/pos-clearings/:id/generate-journal", (context) => {
      try {
        return context.json({ data: generatePosJournal(client.db, context.req.param("id")) });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/pbf-invoices", (context) => context.json({ data: listPbfInvoices(client.db) }))
    .post("/api/pbf-invoices", validateJson(PbfInvoiceSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        return context.json({ data: createPbfInvoice(client.db, parsed.data) }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/consignment/items", (context) =>
      context.json({ data: listConsignmentItems(client.db) }),
    )
    .post("/api/consignment/vendors", validateJson(ConsignmentVendorSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        return context.json({ data: createConsignmentVendor(client.db, parsed.data) }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })
    .post("/api/consignment/items", validateJson(ConsignmentItemSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        return context.json({ data: createConsignmentItem(client.db, parsed.data) }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })
    .post(
      "/api/consignment/settlements",
      validateJson(ConsignmentSettlementSchema),
      async (context) => {
        const parsed = { data: context.req.valid("json") };
        try {
          return context.json({ data: settleConsignment(client.db, parsed.data) }, 201);
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    .get("/api/cash-bank/transfers", (context) =>
      context.json({ data: listCashBankTransfers(client.db) }),
    )
    .get("/api/cash-bank/summary", (context) =>
      context.json({ data: getCashBankSummary(client.db) }),
    )
    .post("/api/cash-bank/transfers", validateJson(CashBankTransferSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        return context.json({ data: createCashBankTransfer(client.db, parsed.data) }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/bank-recon", validateQuery(BankReconQuerySchema), (context) => {
      const bankAccountId = context.req.valid("query").bankAccountId;
      try {
        return context.json({ data: getReconData(client.db, bankAccountId) });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .post("/api/bank-recon/import", validateJson(BankReconImportRequestSchema), async (context) => {
      try {
        const body = context.req.valid("json");
        const result =
          "csv" in body
            ? importBankStatementCsv(client.db, body.bankAccountId, body.csv)
            : importBankStatements(client.db, body);
        return context.json({ data: result }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .post(
      "/api/bank-recon/auto-match",
      validateJson(z.object({ bankAccountId: z.string().min(1) })),
      async (context) => {
        try {
          const body = context.req.valid("json");
          return context.json({ data: autoMatch(client.db, body.bankAccountId) });
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    .post("/api/bank-recon/matches", validateJson(BankReconMatchSchema), async (context) => {
      try {
        return context.json({ data: manualMatch(client.db, context.req.valid("json")) }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .delete("/api/bank-recon/matches/:id", (context) => {
      try {
        return context.json({ data: removeMatch(client.db, context.req.param("id")) });
      } catch (error) {
        return errorResponse(context, error);
      }
    });

  routes.notFound((context) => context.json({ error: "Not found" }, 404));
  return routes;
}

export type AppType = ReturnType<typeof createApiApp>;
/** @deprecated Use AppType. Kept as a source-compatible alias for consumers. */
export type ApiApp = AppType;
