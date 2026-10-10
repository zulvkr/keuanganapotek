export type SourceModule = "GENERAL" | "OPENING_BALANCE" | "TRANSACTION";

export type MetadataFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "multi-select"
  | "boolean";

export type MetadataFieldDefinition = {
  key: string;
  label: string;
  type: MetadataFieldType;
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  options?: string[];
  width?: "full" | "half";
  helpText?: string;
};

export type TransactionType = {
  id: string;
  name: string;
  code: string;
  debitAccountId: string;
  creditAccountId: string;
  description?: string | null;
  metadataSchema: MetadataFieldDefinition[];
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
  memo?: string | null;
  metadata: Record<string, any>;
  journalId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionWithBalances = TransactionRecord & {
  transactionTypeName?: string;
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
