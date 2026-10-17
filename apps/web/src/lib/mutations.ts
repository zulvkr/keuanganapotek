import { api, requestJson, rpc } from "./api";
import type { QueryClient } from "@tanstack/react-query";
import type {
  JournalInput,
  SaveAccount,
  SaveTransactionInput,
  SaveTransactionTypeInput,
} from "./queries";
import type { AuthUser, TransactionRecord, TransactionType } from "@keuangan-apotek/shared";

export function invalidateAccountingQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["settings"] }),
    queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    queryClient.invalidateQueries({ queryKey: ["journals"] }),
    queryClient.invalidateQueries({ queryKey: ["reports"] }),
    queryClient.invalidateQueries({ queryKey: ["opening-balance"] }),
    queryClient.invalidateQueries({ queryKey: ["transaction-types"] }),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
  ]);
}

export function saveAccount(input: SaveAccount) {
  return rpc(() => api.api.accounts.$post({ json: input }));
}

export function deleteAccount(id: string) {
  return requestJson<null>(`/api/accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function createJournal(input: JournalInput) {
  return rpc(() => api.api.journals.general.$post({ json: input }));
}

export function updateJournal(id: string, input: JournalInput) {
  return requestJson(`/api/journals/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteJournal(id: string) {
  return requestJson<null>(`/api/journals/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function createTransactionType(input: SaveTransactionTypeInput) {
  return requestJson<TransactionType>("/api/transaction-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateTransactionType(id: string, input: Partial<SaveTransactionTypeInput>) {
  return requestJson<TransactionType>(`/api/transaction-types/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteTransactionType(id: string) {
  return requestJson<null>(`/api/transaction-types/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function createTransaction(input: SaveTransactionInput) {
  return requestJson<TransactionRecord>("/api/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateTransaction(id: string, input: Partial<SaveTransactionInput>) {
  return requestJson<TransactionRecord>(`/api/transactions/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteTransaction(id: string) {
  return requestJson<null>(`/api/transactions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function autoBalanceOpeningBalances(input: {
  cutoffDate: string;
  lines: Array<{ accountId: string; debitAmount: string; creditAmount: string; notes?: string }>;
}) {
  return requestJson<{ cutoffDate: string; lines: unknown[]; totals: unknown }>(
    "/api/opening-balances/auto-balance",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
}

export function saveOpeningBalances(input: {
  cutoffDate: string;
  lines: Array<{ accountId: string; debitAmount: string; creditAmount: string; notes?: string }>;
}) {
  return requestJson<{ saved: boolean; cutoffDate: string }>("/api/opening-balances/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function moveOpeningBalanceDate(input: { fromDate: string; toDate: string }) {
  return requestJson<{
    moved: boolean;
    cutoffDate: string;
    journal: { journalNo: string };
  }>("/api/opening-balances/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function lockOpeningBalances(cutoffDate: string) {
  return requestJson<{ locked: boolean; journal: { journalNo: string } }>(
    "/api/opening-balances/lock",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cutoffDate }),
    },
  );
}

export function createUser(input: {
  username: string;
  password: string;
  name: string;
  role: "admin" | "asisten";
  allowedCoaCodes?: string[];
}) {
  return requestJson<AuthUser>("/api/auth/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function updateUser(
  id: string,
  input: {
    name?: string;
    password?: string;
    role?: "admin" | "asisten";
    allowedCoaCodes?: string[];
    isActive?: boolean;
  },
) {
  return requestJson<AuthUser>(`/api/auth/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deleteUser(id: string) {
  return requestJson<null>(`/api/auth/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function saveUserPermissions(id: string, allowedCoaCodes: string[]) {
  return requestJson<AuthUser>(`/api/auth/users/${encodeURIComponent(id)}/permissions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ allowedCoaCodes }),
  });
}

export function createApiKey(input: { name: string; expiresAt?: string | null }) {
  return requestJson<{
    id: string;
    key: string;
    name: string;
    keyPrefix: string;
    isActive: boolean;
    createdAt: string;
  }>("/api/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function revokeApiKey(id: string) {
  return requestJson<null>(`/api/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" });
}
