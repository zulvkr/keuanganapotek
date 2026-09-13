import { type InferRequestType, type InferResponseType } from "hono/client";
import { api, requestJson, rpc } from "./api";

type ResponseData<T> = T extends { data: infer D } ? D : never;

export const queryKeys = {
  accounts: ["accounts"] as const,
  openingBalanceMeta: ["opening-balance", "meta"] as const,
  openingBalances: (cutoffDate: string) => ["opening-balance", cutoffDate] as const,
  journals: (filters: { startDate?: string; endDate?: string }) => ["journals", filters] as const,
  journal: (id: string) => ["journal", id] as const,
  posClearings: ["pos-clearings"] as const,
  paymentMethods: ["pos-payment-methods"] as const,
  cashiers: ["cashiers"] as const,
  shifts: ["shifts"] as const,
  pbfInvoices: ["pbf-invoices"] as const,
  consignmentItems: ["consignment-items"] as const,
  cashBankTransfers: ["cash-bank", "transfers"] as const,
  cashBankSummary: ["cash-bank", "summary"] as const,
  bankRecon: (bankAccountId: string) => ["bank-recon", bankAccountId] as const,
  incomeReport: (filters: IncomeReportFilters) => ["reports", "income", filters] as const,
  balanceReport: (asOfDate: string) => ["reports", "balance", asOfDate] as const,
  trialReport: (filters: TrialReportFilters) => ["reports", "trial", filters] as const,
  drillDown: (accountId: string, period: ReportPeriod) =>
    ["reports", "drill-down", accountId, period] as const,
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
export type PosPaymentMethod = ResponseData<
  InferResponseType<(typeof api.api)["pos-payment-methods"]["$get"]>
>[number];
export type Cashier = ResponseData<InferResponseType<(typeof api.api.cashiers)["$get"]>>[number];
export type Shift = ResponseData<InferResponseType<(typeof api.api.shifts)["$get"]>>[number];
export type PosClearing = ResponseData<
  InferResponseType<(typeof api.api)["pos-clearings"]["$get"]>
>[number];
export type PbfInvoice = ResponseData<
  InferResponseType<(typeof api.api)["pbf-invoices"]["$get"]>
>[number];
export type ConsignmentItem = ResponseData<
  InferResponseType<(typeof api.api.consignment.items)["$get"]>
>[number];
export type CashBankTransfer = ResponseData<
  InferResponseType<(typeof api.api)["cash-bank"]["transfers"]["$get"]>
>[number];
export type CashBankSummary = ResponseData<
  InferResponseType<(typeof api.api)["cash-bank"]["summary"]["$get"]>
>;
export type ReconData = {
  account: { id: string; code: string; name: string };
  statements: Array<{
    id: string;
    statementDate: string;
    description: string | null;
    debit: number;
    credit: number;
    isMatched: boolean;
    matchId: string | null;
    journalLineId: string | null;
    matchType: string | null;
  }>;
  internal: Array<{
    journalLineId: string;
    journalId: string;
    entryDate: string;
    description: string;
    referenceNo: string | null;
    debit: number;
    credit: number;
    isMatched: boolean;
    matchId: string | null;
    matchType: string | null;
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
  compareStartDate: string;
  compareEndDate: string;
};
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
    rows: Array<{ accountId: string; code: string; name: string; balance: number }>;
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

export type SavePaymentMethod = InferRequestType<
  (typeof api.api)["pos-payment-methods"]["$post"]
>["json"];
export type SaveCashier = InferRequestType<(typeof api.api.cashiers)["$post"]>["json"];
export type SaveShift = InferRequestType<(typeof api.api.shifts)["$post"]>["json"];
export type SaveAccount = InferRequestType<(typeof api.api.accounts)["$post"]>["json"];
export type JournalInput = InferRequestType<(typeof api.api.journals.general)["$post"]>["json"];
export type PosClearingInput = InferRequestType<(typeof api.api)["pos-clearings"]["$post"]>["json"];
export type PbfInvoiceInput = InferRequestType<(typeof api.api)["pbf-invoices"]["$post"]>["json"];
export type ConsignmentVendorInput = InferRequestType<
  (typeof api.api.consignment.vendors)["$post"]
>["json"];
export type ConsignmentItemInput = InferRequestType<
  (typeof api.api.consignment.items)["$post"]
>["json"];
export type ConsignmentSettlementInput = InferRequestType<
  (typeof api.api.consignment.settlements)["$post"]
>["json"];
export type CashBankTransferInput = InferRequestType<
  (typeof api.api)["cash-bank"]["transfers"]["$post"]
>["json"];
export type BankReconImportInput =
  | { bankAccountId: string; csv: string }
  | {
      bankAccountId: string;
      rows: Array<{
        statementDate: string;
        description?: string;
        debit?: string | number;
        credit?: string | number;
      }>;
    };
export type BankReconMatchInput = { bankStatementId: string; journalLineId: string };

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

export function getPaymentMethods() {
  return rpc(() => api.api["pos-payment-methods"].$get()).then((response) => response.data);
}

export function getCashiers() {
  return rpc(() => api.api.cashiers.$get()).then((response) => response.data);
}

export function getShifts() {
  return rpc(() => api.api.shifts.$get()).then((response) => response.data);
}

export function getPosClearings() {
  return rpc(() => api.api["pos-clearings"].$get()).then((response) => response.data);
}

export function getPbfInvoices() {
  return rpc(() => api.api["pbf-invoices"].$get()).then((response) => response.data);
}

export function getConsignmentItems() {
  return rpc(() => api.api.consignment.items.$get()).then((response) => response.data);
}

export function getCashBankTransfers() {
  return rpc(() => api.api["cash-bank"].transfers.$get()).then((response) => response.data);
}

export function getCashBankSummary() {
  return rpc(() => api.api["cash-bank"].summary.$get()).then((response) => response.data);
}

export function getBankRecon(bankAccountId: string) {
  return requestJson<ReconData>(`/api/bank-recon?${new URLSearchParams({ bankAccountId })}`);
}

export function getIncomeReport(filters: IncomeReportFilters) {
  return requestJson<IncomeReport>(`/api/reports/income-statement?${new URLSearchParams(filters)}`);
}

export function getBalanceReport(asOfDate: string) {
  return requestJson<BalanceReport>(
    `/api/reports/balance-sheet?${new URLSearchParams({ asOfDate })}`,
  );
}

export function getTrialReport(filters: TrialReportFilters) {
  return requestJson<TrialReport>(`/api/reports/trial-balance?${new URLSearchParams(filters)}`);
}

export function getDrillDown(accountId: string, period: ReportPeriod) {
  return requestJson<DrillDown>(
    `/api/reports/accounts/${encodeURIComponent(accountId)}/journal-drill-down?${new URLSearchParams(period)}`,
  );
}
