import { type InferRequestType, type InferResponseType } from "hono/client";
import { api, requestJson, rpc } from "./api";
import type {
  ApiKeyItem,
  AuthUser,
  CashFlowReport,
  MetadataFieldDefinition,
  TransactionGroup,
  TransactionType,
  TransactionWithBalances,
  TransactionsSummary,
} from "@keuangan-apotek/shared";

type ResponseData<T> = T extends { data: infer D } ? D : never;

export const queryKeys = {
  accounts: ["accounts"] as const,
  openingBalanceMeta: ["opening-balance", "meta"] as const,
  openingBalances: (cutoffDate: string) => ["opening-balance", cutoffDate] as const,
  journals: (filters: { startDate?: string; endDate?: string }) => ["journals", filters] as const,
  journal: (id: string) => ["journal", id] as const,
  transactionTypes: (includeInactive?: boolean) =>
    ["transaction-types", includeInactive ?? false] as const,
  transactions: (filters?: { startDate?: string; endDate?: string }) =>
    ["transactions", filters ?? {}] as const,
  transactionsSummary: ["transactions", "summary"] as const,
  incomeReport: (filters: IncomeReportFilters) => ["reports", "income", filters] as const,
  balanceReport: (asOfDate: string) => ["reports", "balance", asOfDate] as const,
  trialReport: (filters: TrialReportFilters) => ["reports", "trial", filters] as const,
  cashFlowReport: (filters: ReportPeriod) => ["reports", "cash-flow", filters] as const,
  drillDown: (accountId: string, period: ReportPeriod) =>
    ["reports", "drill-down", accountId, period] as const,
  users: ["users"] as const,
  apiKeys: ["api-keys"] as const,
};

export type Account = ResponseData<
  InferResponseType<(typeof api.api.accounts.tree)["$get"]>
>[number];

export type JournalSummary = {
  id: string;
  journalNo: string;
  entryDate: string;
  referenceNo: string | null;
  memo: string | null;
  sourceModule: string;
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
  lines: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    description: string | null;
    debit: number;
    credit: number;
  }>;
};

export type JournalDetail = {
  journal: JournalSummary;
  lines: Array<{
    accountId: string;
    accountCode: string;
    accountName: string;
    description: string | null;
    debit: number;
    credit: number;
  }>;
};

export type OpeningBalanceMeta = { cutoffDate: string | null };

export type OpeningBalance = {
  accountId: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  isGroup: boolean;
  isLocked: boolean;
  notes: string | null;
};

export type ReportPeriod = { startDate: string; endDate: string };

export type IncomeReportFilters = {
  periodStart: string;
  periodEnd: string;
  compareStartDate?: string;
  compareEndDate?: string;
};

export type { CashFlowReport };
export type TrialReportFilters = ReportPeriod;

type ReportTotal = {
  amount: number;
  compareAmount: number;
  variance: number;
  growthPercent: number | null;
};

export type IncomeReport = {
  period: ReportPeriod;
  comparePeriod: ReportPeriod | null;
  sections: Array<{
    key: string;
    label: string;
    rows: Array<{
      accountId: string;
      code: string;
      name: string;
      classification: string;
      amount: number;
      compareAmount: number;
      variance: number;
      growthPercent: number | null;
    }>;
    total: ReportTotal;
  }>;
  revenue: ReportTotal;
  cogs: ReportTotal;
  grossProfit: ReportTotal;
  operatingExpenses: ReportTotal;
  nonOperatingExpenses: ReportTotal;
  netProfit: ReportTotal;
};

export type BalanceReport = {
  asOfDate: string;
  sections: Array<{
    key: string;
    label: string;
    rows: Array<{
      accountId: string;
      code: string;
      name: string;
      classification?: string;
      normalBalance?: string;
      balance: number;
    }>;
    total: number;
  }>;
  currentEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  difference: number;
  isBalanced: boolean;
};

export type TrialReport = {
  period: ReportPeriod;
  rows: Array<{
    accountId: string;
    code: string;
    name: string;
    classification: string;
    debitBalance: number;
    creditBalance: number;
    endingBalance: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  difference: number;
  isBalanced: boolean;
};

export type DrillDown = {
  account: { code: string; name: string };
  entries: Array<{
    lineId: string;
    journalNo: string;
    entryDate: string;
    referenceNo: string | null;
    memo: string | null;
    sourceModule: string;
    description: string | null;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
};

export type SaveAccount = InferRequestType<(typeof api.api.accounts)["$post"]>["json"];
export type JournalInput = InferRequestType<(typeof api.api.journals.general)["$post"]>["json"];

export type SaveTransactionTypeInput = {
  code: string;
  name: string;
  group?: TransactionGroup;
  debitAccountId: string;
  creditAccountId: string;
  description?: string;
  metadataSchema?: MetadataFieldDefinition[];
  isActive?: boolean;
};

export type SaveTransactionInput = {
  transactionDate: string;
  transactionTypeId: string;
  amount: string | number;
  memo?: string;
  metadata?: Record<string, any>;
};

export function getAccounts() {
  return rpc(() => api.api.accounts.tree.$get()).then((response) => response.data);
}

export function getOpeningBalanceMeta(): Promise<OpeningBalanceMeta> {
  return requestJson<OpeningBalanceMeta>("/api/opening-balances/meta");
}

export function getOpeningBalances(cutoffDate: string): Promise<OpeningBalance[]> {
  return requestJson<OpeningBalance[]>(
    `/api/opening-balances?${new URLSearchParams({ cutoffDate })}`,
  );
}

export function getJournals(filters: { startDate?: string; endDate?: string }) {
  const query = new URLSearchParams(filters).toString();
  return requestJson<JournalSummary[]>(`/api/journals${query ? `?${query}` : ""}`);
}

export function getJournal(id: string) {
  return requestJson<JournalDetail>(`/api/journals/${encodeURIComponent(id)}`);
}

export function getTransactionTypes(options: { includeInactive?: boolean } = {}) {
  const query = options.includeInactive ? "?includeInactive=true" : "";
  return requestJson<TransactionType[]>(`/api/transaction-types${query}`);
}

export function getTransactionType(id: string) {
  return requestJson<TransactionType>(`/api/transaction-types/${encodeURIComponent(id)}`);
}

export function getTransactions(filters: { startDate?: string; endDate?: string } = {}) {
  const query = new URLSearchParams(filters).toString();
  return requestJson<TransactionWithBalances[]>(`/api/transactions${query ? `?${query}` : ""}`);
}

export function getTransactionsSummary() {
  return requestJson<TransactionsSummary>("/api/transactions/summary");
}

export function getIncomeReport(filters: IncomeReportFilters) {
  const params: Record<string, string> = {
    periodStart: filters.periodStart,
    periodEnd: filters.periodEnd,
  };
  if (filters.compareStartDate) params.compareStartDate = filters.compareStartDate;
  if (filters.compareEndDate) params.compareEndDate = filters.compareEndDate;
  return requestJson<IncomeReport>(`/api/reports/income-statement?${new URLSearchParams(params)}`);
}

export function getBalanceReport(asOfDate: string) {
  return requestJson<BalanceReport>(
    `/api/reports/balance-sheet?${new URLSearchParams({ asOfDate })}`,
  );
}

export function getTrialReport(filters: TrialReportFilters) {
  return requestJson<TrialReport>(`/api/reports/trial-balance?${new URLSearchParams(filters)}`);
}

export function getCashFlowReport(filters: ReportPeriod) {
  return requestJson<CashFlowReport>(`/api/reports/cash-flow?${new URLSearchParams(filters)}`);
}

export function getDrillDown(accountId: string, period: ReportPeriod) {
  return requestJson<DrillDown>(
    `/api/reports/accounts/${encodeURIComponent(accountId)}/journal-drill-down?${new URLSearchParams(period)}`,
  );
}

export function getUsers(): Promise<AuthUser[]> {
  return requestJson<AuthUser[]>("/api/auth/users");
}

export function getApiKeys(): Promise<ApiKeyItem[]> {
  return requestJson<ApiKeyItem[]>("/api/api-keys");
}
