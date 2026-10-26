import { Hono } from "hono";
import type { Context } from "hono";
import type { MiddlewareHandler } from "hono";
import { validator } from "hono/validator";
import { z } from "zod";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { eq, or, sql } from "drizzle-orm";
import {
  AccountSchema,
  JournalEntrySchema,
  LockOpeningBalanceSchema,
  MoveOpeningBalanceSchema,
  nowIsoInstant,
  SaveOpeningBalancesSchema,
  TransactionTypeSchema,
  TransactionGroupSchema,
  UpdateTransactionGroupSchema,
  TransactionEntrySchema,
  BulkDeleteTransactionsSchema,
  BulkUpdateTransactionsSchema,
  AccountJournalDrillDownQuerySchema,
  BalanceSheetQuerySchema,
  IncomeStatementQuerySchema,
  ReportPeriodSchema,
  TrialBalanceQuerySchema,
  LoginInputSchema,
  CreateUserInputSchema,
  UpdateUserInputSchema,
  UpdatePermissionsInputSchema,
  SetupInputSchema,
  CreateApiKeyInputSchema,
  DEFAULT_ASSISTANT_ALLOWED_COA_CODES,
  type AuthUser,
  type SourceModule,
  type HealthResponse,
} from "@keuangan-apotek/shared";
import type { SqliteClient } from "./db/client.js";
import {
  accounts,
  journalLines,
  journals,
  transactions,
  transactionTypes,
} from "./db/schema/index.js";
import {
  autoBalanceOpeningBalances,
  calculateOpeningBalanceTotals,
  getOpeningBalances,
  getOpeningBalanceCutoff,
  listAccounts,
  lockOpeningBalance,
  moveLockedOpeningBalance,
  saveOpeningBalances,
} from "./services/opening-balance.service.js";
import {
  createJournalEntry,
  deleteJournal,
  getJournalById,
  listJournals,
  updateJournal,
} from "./services/ledger.service.js";
import {
  createTransaction,
  createTransactionType,
  deleteTransaction,
  deleteTransactionType,
  bulkDeleteTransactions,
  bulkUpdateTransactions,
  getTransactionTypeById,
  getTransactionsSummary,
  listTransactionGroups,
  listTransactionTypes,
  listTransactions,
  resetTransactionGroupSchema,
  updateTransaction,
  updateTransactionGroupSchema,
  updateTransactionType,
} from "./services/transaction.service.js";
import {
  getAccountJournalDrillDown,
  getBalanceSheet,
  getCashFlowStatement,
  getIncomeStatement,
  getTrialBalance,
} from "./services/reports.service.js";
import { listAuditLogs } from "./services/audit.service.js";
import {
  authenticateUser,
  createUser,
  deleteUser,
  getUserById,
  getUserByUsername,
  getUserCount,
  initialSetup,
  listUsers,
  updateUser,
  updateUserPermissions,
  verifyToken,
} from "./services/auth.service.js";
import {
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  verifyApiKey,
} from "./services/api-key.service.js";
import { getOpenApiSpec, getSwaggerHtml } from "./docs/openapi.js";
import { getLlmsTxt, getLlmsFullTxt } from "./docs/llms.js";

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
const TransactionListQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
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

function errorResponse(context: Context, error: unknown) {
  const message = error instanceof Error ? error.message : "Permintaan tidak valid";
  const lower = message.toLowerCase();
  const status = lower.includes("api key tidak valid")
    ? (401 as const)
    : lower.includes("akses ditolak")
      ? (403 as const)
      : lower.includes("tidak ditemukan")
        ? (404 as const)
        : lower.includes("sudah dikunci") ||
            lower.includes("sudah diinisialisasi") ||
            lower.includes("hanya boleh memiliki satu") ||
            lower.includes("sistem") ||
            lower.includes("grup") ||
            lower.includes("tidak dapat dihapus")
          ? (409 as const)
          : (400 as const);
  return context.json({ error: message }, status);
}

const sourceModules: SourceModule[] = ["GENERAL", "OPENING_BALANCE", "TRANSACTION"];

/** Creates the API with a caller-owned database connection. */
export function createApiApp(client: SqliteClient) {
  function getAuthUser(context: Context): AuthUser {
    const apiKeyHeader = context.req.header("x-api-key");
    if (apiKeyHeader) {
      const apiKeyUser = verifyApiKey(client.db, apiKeyHeader.trim());
      if (apiKeyUser && apiKeyUser.isActive) return apiKeyUser;
      throw new Error("API Key tidak valid atau telah dicabut");
    }

    const authHeader = context.req.header("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token.startsWith("ka_")) {
        const apiKeyUser = verifyApiKey(client.db, token);
        if (apiKeyUser && apiKeyUser.isActive) return apiKeyUser;
        throw new Error("API Key tidak valid atau telah dicabut");
      }
      const verified = verifyToken(token);
      if (verified) {
        const user = getUserById(client.db, verified.id);
        if (user && user.isActive) return user;
      }
    }

    const roleHeader = context.req.header("x-user-role");
    if (roleHeader === "asisten") {
      const asisten = getUserByUsername(client.db, "asisten");
      if (asisten) {
        let allowedCoaCodes: string[] = [];
        try {
          allowedCoaCodes = JSON.parse(asisten.allowedCoaCodes || "[]");
        } catch {
          allowedCoaCodes = DEFAULT_ASSISTANT_ALLOWED_COA_CODES;
        }
        return {
          id: asisten.id,
          username: asisten.username,
          name: asisten.name,
          role: "asisten",
          allowedCoaCodes,
        };
      }
      return {
        id: "asisten-user",
        username: "asisten",
        name: "Asisten Apotek",
        role: "asisten",
        allowedCoaCodes: DEFAULT_ASSISTANT_ALLOWED_COA_CODES,
      };
    }

    return {
      id: "admin-default",
      username: "admin",
      name: "Apoteker Admin",
      role: "admin",
      allowedCoaCodes: [],
    };
  }

  function requireAdmin(context: Context): boolean {
    const user = getAuthUser(context);
    return user.role === "admin";
  }

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
    const user = getAuthUser(context);
    if (user.role === "asisten") {
      return context.json(
        { error: "Akses ditolak: Laporan drill-down hanya dapat diakses oleh Admin" },
        403,
      );
    }
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
    .use("*", async (context, next) => {
      const user = getAuthUser(context);
      if (user.role === "asisten") {
        return context.json(
          { error: "Akses ditolak: Laporan Keuangan hanya dapat diakses oleh Admin" },
          403,
        );
      }
      await next();
    })
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
    .get("/cash-flow", validateQuery(ReportQuerySchema), (context) => {
      const period = readPeriod(context, ["startDate", "periodStart"], ["endDate", "periodEnd"]);
      if (!period.success) return context.json({ error: period.error.flatten() }, 400);
      return context.json({ data: getCashFlowStatement(client.db, period.data) });
    })
    .get("/accounts/:id/journal-drill-down", validateQuery(ReportQuerySchema), drillDownHandler)
    .get("/account-journal-drill-down", validateQuery(ReportQuerySchema), drillDownHandler);

  const routes = new Hono()
    .use("/api/*", cors({ origin: (origin) => origin || "*" }))
    .use("/api/*", async (context, next) => {
      const path = context.req.path;
      if (
        path.startsWith("/api/auth/login") ||
        path.startsWith("/api/auth/setup") ||
        path === "/api/openapi.json" ||
        path === "/api/docs" ||
        path.startsWith("/api/docs/")
      ) {
        return next();
      }
      try {
        getAuthUser(context);
      } catch (error) {
        return errorResponse(context, error);
      }
      await next();
    })
    .get("/health", healthHandler)
    .get("/openapi.json", (context) => context.json(getOpenApiSpec()))
    .get("/api/openapi.json", (context) => context.json(getOpenApiSpec()))
    .get("/docs", (context) => context.html(getSwaggerHtml("/api/openapi.json")))
    .get("/api/docs", (context) => context.html(getSwaggerHtml("/api/openapi.json")))
    .get("/llms.txt", (context) => context.text(getLlmsTxt()))
    .get("/.well-known/llms.txt", (context) => context.text(getLlmsTxt()))
    .get("/api/docs/llms.txt", (context) => context.text(getLlmsTxt()))
    .get("/llms-full.txt", (context) => context.text(getLlmsFullTxt()))
    .route("/api/reports", reportRoutes)

    // Auth endpoints
    .get("/api/auth/setup-status", (context) => {
      const count = getUserCount(client.db);
      return context.json({
        data: {
          isSetupRequired: count === 0,
          userCount: count,
        },
      });
    })

    .post("/api/auth/setup", validateJson(SetupInputSchema), async (context) => {
      try {
        const body = context.req.valid("json");
        const result = initialSetup(client.db, body);
        return context.json({ data: result }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .post("/api/auth/login", validateJson(LoginInputSchema), async (context) => {
      try {
        const body = context.req.valid("json");
        const result = authenticateUser(client.db, body.username, body.password);
        return context.json({ data: result });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/auth/me", (context) => {
      const user = getAuthUser(context);
      if (!user) {
        return context.json({ error: "Belum terautentikasi" }, 401);
      }
      return context.json({ data: { user } });
    })

    .get("/api/auth/users", (context) => {
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat melihat pengguna" },
          403,
        );
      }
      return context.json({ data: listUsers(client.db) });
    })

    .post("/api/auth/users", validateJson(CreateUserInputSchema), async (context) => {
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat membuat pengguna baru" },
          403,
        );
      }
      try {
        const body = context.req.valid("json");
        const created = createUser(client.db, body);
        return context.json({ data: created }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .put("/api/auth/users/:id", validateJson(UpdateUserInputSchema), async (context) => {
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat mengubah pengguna" },
          403,
        );
      }
      try {
        const body = context.req.valid("json");
        const updated = updateUser(client.db, context.req.param("id")!, body);
        return context.json({ data: updated });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .delete("/api/auth/users/:id", (context) => {
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat menghapus pengguna" },
          403,
        );
      }
      try {
        deleteUser(client.db, context.req.param("id")!);
        return context.body(null, 204);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .put(
      "/api/auth/users/:id/permissions",
      validateJson(UpdatePermissionsInputSchema),
      async (context) => {
        if (!requireAdmin(context)) {
          return context.json(
            { error: "Akses ditolak: Hanya Admin yang dapat mengatur hak akses CoA" },
            403,
          );
        }
        try {
          const body = context.req.valid("json");
          const updated = updateUserPermissions(
            client.db,
            context.req.param("id")!,
            body.allowedCoaCodes,
          );
          return context.json({ data: updated });
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    // API Keys endpoints
    .get("/api/api-keys", (context) => {
      const user = getAuthUser(context);
      if (!user) {
        return context.json({ error: "Belum terautentikasi" }, 401);
      }
      const filterUserId = user.role === "admin" ? undefined : user.id;
      return context.json({ data: listApiKeys(client.db, filterUserId) });
    })

    .post("/api/api-keys", validateJson(CreateApiKeyInputSchema), async (context) => {
      const user = getAuthUser(context);
      if (!user) {
        return context.json({ error: "Belum terautentikasi" }, 401);
      }
      try {
        const body = context.req.valid("json");
        const created = generateApiKey(client.db, {
          userId: user.id,
          name: body.name,
          expiresAt: body.expiresAt,
        });
        return context.json({ data: created }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .delete("/api/api-keys/:id", (context) => {
      const user = getAuthUser(context);
      if (!user) {
        return context.json({ error: "Belum terautentikasi" }, 401);
      }
      try {
        revokeApiKey(client.db, context.req.param("id")!, user.id, user.role === "admin");
        return context.body(null, 204);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/accounts/tree", async (context) => {
      const user = getAuthUser(context);
      const accountsList = await listAccounts(client.db);
      if (user.role === "asisten") {
        const allowedSet = new Set(user.allowedCoaCodes);
        return context.json({
          data: accountsList.filter((a) => a.isGroup || allowedSet.has(a.code)),
        });
      }
      return context.json({ data: accountsList });
    })

    .post("/api/accounts", validateJson(AccountSchema), async (context) => {
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat menambah atau mengubah akun CoA" },
          403,
        );
      }
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
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat menghapus akun CoA" },
          403,
        );
      }
      try {
        const account = client.db
          .select({
            id: accounts.id,
            code: accounts.code,
            name: accounts.name,
            isGroup: accounts.isGroup,
          })
          .from(accounts)
          .where(eq(accounts.id, context.req.param("id")))
          .get();
        if (!account) return context.json({ error: "Akun tidak ditemukan" }, 404);
        if (account.isGroup) throw new Error("Akun grup sistem tidak boleh dihapus");
        if (account.code === "3201" || account.name.trim().toLowerCase() === "laba ditahan") {
          throw new Error("Akun Laba Ditahan sistem tidak boleh dihapus");
        }

        // Check child accounts (sub-akun)
        const childAccounts = client.db
          .select({ code: accounts.code, name: accounts.name })
          .from(accounts)
          .where(eq(accounts.parentId, account.id))
          .all();
        if (childAccounts.length > 0) {
          const list = childAccounts.map((c) => `${c.code} (${c.name})`).join(", ");
          throw new Error(
            `Akun [${account.code}] tidak dapat dihapus karena masih menjadi induk dari sub-akun: ${list}. Hapus atau pindahkan sub-akun tersebut terlebih dahulu.`,
          );
        }

        // Check Master Transaction Types
        const relatedTypes = client.db
          .select({ code: transactionTypes.code, name: transactionTypes.name })
          .from(transactionTypes)
          .where(
            or(
              eq(transactionTypes.debitAccountId, account.id),
              eq(transactionTypes.creditAccountId, account.id),
            ),
          )
          .all();
        if (relatedTypes.length > 0) {
          const list = relatedTypes.map((t) => `${t.code} (${t.name})`).join(", ");
          throw new Error(
            `Akun [${account.code}] ${account.name} tidak dapat dihapus karena masih digunakan di Master Tipe Transaksi: ${list}. Silakan buka menu Master Transaksi untuk menghapus atau mengganti akun pada tipe transaksi tersebut terlebih dahulu.`,
          );
        }

        // Check Daily Transactions
        const relatedTransactions = client.db
          .select({ count: sql<number>`count(*)` })
          .from(transactions)
          .where(
            or(
              eq(transactions.debitAccountId, account.id),
              eq(transactions.creditAccountId, account.id),
            ),
          )
          .get();
        if (relatedTransactions && relatedTransactions.count > 0) {
          throw new Error(
            `Akun [${account.code}] tidak dapat dihapus karena memiliki riwayat ${relatedTransactions.count} data di Transaksi Harian. Hapus transaksi terkait terlebih dahulu jika ingin menghapus akun ini.`,
          );
        }

        // Check Journal Lines (Jurnal Umum / Saldo Awal)
        const relatedJournals = client.db
          .select({
            journalNo: journals.journalNo,
            sourceModule: journals.sourceModule,
          })
          .from(journalLines)
          .innerJoin(journals, eq(journals.id, journalLines.journalId))
          .where(eq(journalLines.accountId, account.id))
          .groupBy(journals.id)
          .all();
        if (relatedJournals.length > 0) {
          const hasOpening = relatedJournals.some((j) => j.sourceModule === "OPENING_BALANCE");
          const nos = relatedJournals
            .slice(0, 3)
            .map((j) => j.journalNo)
            .join(", ");
          const more =
            relatedJournals.length > 3 ? ` dan ${relatedJournals.length - 3} lainnya` : "";
          if (hasOpening) {
            throw new Error(
              `Akun [${account.code}] tidak dapat dihapus karena masih tercatat pada Jurnal Saldo Awal (${nos}${more}). Silakan nol-kan saldo awal akun ini di menu Saldo Awal terlebih dahulu.`,
            );
          }
          throw new Error(
            `Akun [${account.code}] tidak dapat dihapus karena masih tercatat pada ${relatedJournals.length} Jurnal Umum (${nos}${more}). Silakan hapus atau ubah jurnal tersebut di menu Jurnal Umum terlebih dahulu.`,
          );
        }

        const result = client.db
          .delete(accounts)
          .where(eq(accounts.id, context.req.param("id")))
          .run();
        if (result.changes === 0) return context.json({ error: "Akun tidak ditemukan" }, 404);
        return context.body(null, 204);
      } catch (error) {
        if (error instanceof Error && error.message.toLowerCase().includes("foreign key")) {
          return errorResponse(
            context,
            new Error(
              "Akun tidak dapat dihapus karena masih terikat dengan data lain di sistem (Master Transaksi, Jurnal, atau Sub-akun).",
            ),
          );
        }
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
        if (!equity) return context.json({ error: "Akun 3101 Akun Modal belum tersedia" }, 500);
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

    .post("/api/opening-balances/move", validateJson(MoveOpeningBalanceSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        const moved = moveLockedOpeningBalance(client.db, parsed.data.fromDate, parsed.data.toDate);
        return context.json({
          data: {
            moved: true,
            cutoffDate: moved.cutoffDate,
            journal: { journalNo: moved.journalNo },
          },
        });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .post("/api/opening-balances/lock", validateJson(LockOpeningBalanceSchema), async (context) => {
      const parsed = { data: context.req.valid("json") };
      try {
        const journal = await lockOpeningBalance(client.db, parsed.data.cutoffDate);
        return context.json({ data: { locked: true, journal } });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .get("/api/audit-logs", (context) =>
      context.json({
        data: listAuditLogs(client.db, {
          entityType: context.req.query("entityType"),
          entityId: context.req.query("entityId"),
        }),
      }),
    )

    .get("/api/journals", validateQuery(JournalListQuerySchema), (context) => {
      const user = getAuthUser(context);
      if (user.role === "asisten") {
        return context.json(
          { error: "Akses ditolak: Jurnal Umum hanya dapat diakses oleh Admin" },
          403,
        );
      }
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
      const user = getAuthUser(context);
      if (user.role === "asisten") {
        return context.json(
          { error: "Akses ditolak: Jurnal Umum hanya dapat diakses oleh Admin" },
          403,
        );
      }
      const journal = getJournalById(client.db, context.req.param("id"));
      return journal
        ? context.json({ data: journal })
        : context.json({ error: "Jurnal tidak ditemukan" }, 404);
    })

    .post("/api/journals/general", validateJson(JournalEntrySchema), async (context) => {
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat membuat Jurnal Umum" },
          403,
        );
      }
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
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat mengubah Jurnal Umum" },
          403,
        );
      }
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
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat menghapus Jurnal Umum" },
          403,
        );
      }
      try {
        deleteJournal(client.db, context.req.param("id"));
        return context.body(null, 204);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    // Transaction Groups endpoints
    .get("/api/transaction-groups", (context) => {
      return context.json({ data: listTransactionGroups(client.db) });
    })

    .put(
      "/api/transaction-groups/:groupKey",
      validateJson(UpdateTransactionGroupSchema),
      async (context) => {
        if (!requireAdmin(context)) {
          return context.json(
            { error: "Akses ditolak: Hanya Admin yang dapat mengubah skema metadata grup" },
            403,
          );
        }
        const groupKeyParam = context.req.param("groupKey");
        const parsedKey = TransactionGroupSchema.safeParse(groupKeyParam);
        if (!parsedKey.success) {
          return context.json({ error: `Grup transaksi ${groupKeyParam} tidak valid` }, 400);
        }
        try {
          const body = context.req.valid("json");
          const user = getAuthUser(context);
          const updated = updateTransactionGroupSchema(
            client.db,
            parsedKey.data,
            body.metadataSchema,
            user.username,
          );
          return context.json({ data: updated });
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    .post("/api/transaction-groups/:groupKey/reset", async (context) => {
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat mereset skema metadata grup" },
          403,
        );
      }
      const groupKeyParam = context.req.param("groupKey");
      const parsedKey = TransactionGroupSchema.safeParse(groupKeyParam);
      if (!parsedKey.success) {
        return context.json({ error: `Grup transaksi ${groupKeyParam} tidak valid` }, 400);
      }
      try {
        const user = getAuthUser(context);
        const reset = resetTransactionGroupSchema(client.db, parsedKey.data, user.username);
        return context.json({ data: reset });
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    // Transaction Types endpoints
    .get("/api/transaction-types", (context) => {
      const user = getAuthUser(context);
      const allowedCodes = user.role === "asisten" ? user.allowedCoaCodes : undefined;
      const includeInactive = context.req.query("includeInactive") === "true";
      return context.json({
        data: listTransactionTypes(client.db, { includeInactive }, allowedCodes),
      });
    })

    .get("/api/transaction-types/:id", (context) => {
      const item = getTransactionTypeById(client.db, context.req.param("id"));
      if (!item) return context.json({ error: "Tipe transaksi tidak ditemukan" }, 404);
      const user = getAuthUser(context);
      if (user.role === "asisten") {
        const allowedSet = new Set(user.allowedCoaCodes);
        const debitAcc = client.db
          .select()
          .from(accounts)
          .where(eq(accounts.id, item.debitAccountId))
          .get();
        const creditAcc = client.db
          .select()
          .from(accounts)
          .where(eq(accounts.id, item.creditAccountId))
          .get();
        if (
          !debitAcc ||
          !creditAcc ||
          !allowedSet.has(debitAcc.code) ||
          !allowedSet.has(creditAcc.code)
        ) {
          return context.json({ error: "Akses ditolak: Tipe transaksi ini tidak diizinkan" }, 403);
        }
      }
      return context.json({ data: item });
    })

    .post("/api/transaction-types", validateJson(TransactionTypeSchema), async (context) => {
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat membuat master tipe transaksi" },
          403,
        );
      }
      try {
        const body = context.req.valid("json");
        return context.json({ data: createTransactionType(client.db, body) }, 201);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .put(
      "/api/transaction-types/:id",
      validateJson(TransactionTypeSchema.partial()),
      async (context) => {
        if (!requireAdmin(context)) {
          return context.json(
            { error: "Akses ditolak: Hanya Admin yang dapat mengubah master tipe transaksi" },
            403,
          );
        }
        try {
          const body = context.req.valid("json");
          return context.json({
            data: updateTransactionType(client.db, context.req.param("id")!, body),
          });
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    .delete("/api/transaction-types/:id", (context) => {
      if (!requireAdmin(context)) {
        return context.json(
          { error: "Akses ditolak: Hanya Admin yang dapat menghapus master tipe transaksi" },
          403,
        );
      }
      try {
        deleteTransactionType(client.db, context.req.param("id")!);
        return context.body(null, 204);
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    // Transactions endpoints
    .get("/api/transactions/summary", (context) => {
      const user = getAuthUser(context);
      const allowedCodes = user.role === "asisten" ? user.allowedCoaCodes : undefined;
      return context.json({ data: getTransactionsSummary(client.db, allowedCodes) });
    })

    .get("/api/transactions", validateQuery(TransactionListQuerySchema), (context) => {
      const user = getAuthUser(context);
      const allowedCodes = user.role === "asisten" ? user.allowedCoaCodes : undefined;
      const startDate = context.req.query("startDate");
      const endDate = context.req.query("endDate");
      return context.json({
        data: listTransactions(client.db, { startDate, endDate }, allowedCodes),
      });
    })

    .post("/api/transactions", validateJson(TransactionEntrySchema), async (context) => {
      try {
        const user = getAuthUser(context);
        const allowedCodes = user.role === "asisten" ? user.allowedCoaCodes : undefined;
        const body = context.req.valid("json");
        const idempotencyKey =
          body.idempotencyKey || context.req.header("x-idempotency-key") || undefined;
        return context.json(
          { data: createTransaction(client.db, { ...body, idempotencyKey }, allowedCodes) },
          201,
        );
      } catch (error) {
        return errorResponse(context, error);
      }
    })

    .put(
      "/api/transactions/:id",
      validateJson(TransactionEntrySchema.partial()),
      async (context) => {
        try {
          const user = getAuthUser(context);
          const allowedCodes = user.role === "asisten" ? user.allowedCoaCodes : undefined;
          const body = context.req.valid("json");
          return context.json({
            data: updateTransaction(client.db, context.req.param("id")!, body, allowedCodes),
          });
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    .post(
      "/api/transactions/bulk-delete",
      validateJson(BulkDeleteTransactionsSchema),
      (context) => {
        try {
          const user = getAuthUser(context);
          const allowedCodes = user.role === "asisten" ? user.allowedCoaCodes : undefined;
          const body = context.req.valid("json");
          const result = bulkDeleteTransactions(client.db, body.ids, allowedCodes);
          return context.json({ data: result });
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    .post(
      "/api/transactions/bulk-update",
      validateJson(BulkUpdateTransactionsSchema),
      (context) => {
        try {
          const user = getAuthUser(context);
          const allowedCodes = user.role === "asisten" ? user.allowedCoaCodes : undefined;
          const body = context.req.valid("json");
          const result = bulkUpdateTransactions(client.db, body, allowedCodes);
          return context.json({ data: result });
        } catch (error) {
          return errorResponse(context, error);
        }
      },
    )

    .delete("/api/transactions/:id", (context) => {
      try {
        const user = getAuthUser(context);
        const allowedCodes = user.role === "asisten" ? user.allowedCoaCodes : undefined;
        deleteTransaction(client.db, context.req.param("id")!, allowedCodes);
        return context.body(null, 204);
      } catch (error) {
        return errorResponse(context, error);
      }
    });

  routes.notFound((context) => context.json({ error: "Not found" }, 404));
  return routes;
}

export type AppType = ReturnType<typeof createApiApp>;
export type ApiApp = AppType;
