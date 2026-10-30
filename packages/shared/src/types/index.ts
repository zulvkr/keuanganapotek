export type SourceModule = "GENERAL" | "OPENING_BALANCE" | "TRANSACTION";

export * from "./metadata.js";
export * from "./transaction-group.js";
import type { TransactionGroup } from "./transaction-group.js";
import type { CustomFieldContract, MetadataFieldDefinition } from "./metadata.js";

export type TransactionType = {
  id: string;
  name: string;
  code: string;
  debitAccountId: string;
  creditAccountId: string;
  group?: TransactionGroup;
  category?: string;
  posSyncCategory?: string;
  description?: string | null;
  metadataSchema: MetadataFieldDefinition[];
  customFields?: CustomFieldContract[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TransactionRecord = {
  id: string;
  transactionDate: string;
  transactionTypeId: string;
  amount: number;
  debitAccountId: string;
  creditAccountId: string;
  pic?: string | null;
  metadata: Record<string, any>;
  journalId?: string | null;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
};

export type TransactionWithBalances = TransactionRecord & {
  transactionTypeName?: string;
  group?: TransactionGroup;
  debitAccountCode?: string;
  debitAccountName?: string;
  creditAccountCode?: string;
  creditAccountName?: string;
  runningBalances: Record<string, number>;
  mutations: Record<string, number>;
};

export type CashBankAccountSummary = {
  code: string;
  name: string;
  balance: number;
};

export type TransactionsSummary = {
  accounts: CashBankAccountSummary[];
  totalTransactions: number;
  totalAmount: number;
};

export type HealthResponse = {
  status: "ok";
  service: "api";
  timestamp: string;
};

export type UserRole = "admin" | "asisten" | "kasir" | "auditor";

export type AuthUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  allowedCoaCodes: string[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type SetupStatusResponse = {
  isSetupRequired: boolean;
  userCount: number;
};

export const SENSITIVE_COA_CODES = [
  "1108", // Saving Gaji
  "6102", // Beban gaji
  "3101", // Akun Modal
  "3201", // Laba ditahan
] as const;

export const DEFAULT_ASSISTANT_ALLOWED_COA_CODES: string[] = [
  "1101", // Uang tukaran kasir permanen
  "1102", // Tunai Kasir
  "1103", // Bank Jago Syariah
  "1106", // Saldo Grab Merchant
  "1107", // Saldo QRIS DANA
  "1109", // Saving Sewa
  "1201", // Dana Pending + Saldo Shopee
  "1203", // Dana Pending + Saldo Blibli
  "1204", // Kasbon Pelanggan / Pasien
  "1205", // Piutang supplier
  "1301", // Stok Barang
  "1401", // Saldo sewa dibayar dimuka
  "1601", // Aset tetap, dalam biaya
  "1699", // Akumulasi Penyusutan Aset Tetap
  "2102", // Hutang Dagang
  "2104", // Hutang konsinyasi
  "4101", // Omset
  "4201", // Pendapatan lain-lain
  "5101", // HPP
  "5102", // HPP konsinyasi
  "6101", // Beban admin transaksi
  "6103", // Beban Listrik, Air, Internet
  "6104", // Beban Perlengkapan Toko
  "6105", // Beban Promosi
  "6106", // Amortisasi sewa bangunan bulanan
  "6107", // Beban lain-lain
  "6201", // Penyusutan Aset Tetap
  "6301", // Beban Pajak
];

export type CashFlowItem = {
  accountId?: string;
  code?: string;
  name: string;
  amount: number;
};

export type CashFlowCategory = {
  key: string;
  label: string;
  inflows: CashFlowItem[];
  outflows: CashFlowItem[];
  totalInflow: number;
  totalOutflow: number;
  netAmount: number;
};

export type CashAccountFlowSummary = {
  accountId: string;
  code: string;
  name: string;
  beginningBalance: number;
  inflow: number;
  outflow: number;
  netMovement: number;
  endingBalance: number;
};

export type CashFlowReport = {
  period: { startDate: string; endDate: string };
  operating: CashFlowCategory;
  investing: CashFlowCategory;
  financing: CashFlowCategory;
  netCashFlow: number;
  beginningCash: number;
  endingCash: number;
  cashAccounts: CashAccountFlowSummary[];
};

export type ApiKeyItem = {
  id: string;
  userId: string;
  userName?: string;
  userRole?: UserRole;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatedApiKeyResult = ApiKeyItem & {
  key: string;
};
