import { api, requestJson, rpc } from "./api";
import type { QueryClient } from "@tanstack/react-query";
import type {
  BankReconImportInput,
  BankReconMatchInput,
  CashBankTransferInput,
  ConsignmentItemInput,
  ConsignmentSettlementInput,
  ConsignmentVendorInput,
  JournalInput,
  PbfInvoiceInput,
  PosClearingInput,
  SaveAccount,
  SavePaymentMethod,
} from "./queries";

export function invalidateAccountingQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["settings"] }),
    queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    queryClient.invalidateQueries({ queryKey: ["journals"] }),
    queryClient.invalidateQueries({ queryKey: ["reports"] }),
    queryClient.invalidateQueries({ queryKey: ["opening-balance"] }),
    queryClient.invalidateQueries({ queryKey: ["bank-recon"] }),
    queryClient.invalidateQueries({ queryKey: ["pos-clearings"] }),
    queryClient.invalidateQueries({ queryKey: ["pbf-invoices"] }),
    queryClient.invalidateQueries({ queryKey: ["consignment-items"] }),
    queryClient.invalidateQueries({ queryKey: ["cash-bank"] }),
  ]);
}

export function savePaymentMethod(input: SavePaymentMethod) {
  return rpc(() => api.api["pos-payment-methods"].$post({ json: input }));
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

export function createPosClearing(input: PosClearingInput) {
  return rpc(() => api.api["pos-clearings"].$post({ json: input }));
}

export function updatePosClearing(id: string, input: PosClearingInput) {
  return requestJson(`/api/pos-clearings/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function deletePosClearing(id: string) {
  return requestJson<null>(`/api/pos-clearings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function generatePosJournal(id: string) {
  return requestJson(`/api/pos-clearings/${encodeURIComponent(id)}/generate-journal`, {
    method: "POST",
  });
}

export function createPbfInvoice(input: PbfInvoiceInput) {
  return rpc(() => api.api["pbf-invoices"].$post({ json: input }));
}

export function createConsignmentVendor(input: ConsignmentVendorInput) {
  return rpc(() => api.api.consignment.vendors.$post({ json: input }));
}

export function createConsignmentItem(input: ConsignmentItemInput) {
  return rpc(() => api.api.consignment.items.$post({ json: input }));
}

export function settleConsignment(input: ConsignmentSettlementInput) {
  return rpc(() => api.api.consignment.settlements.$post({ json: input }));
}

export function createCashBankTransfer(input: CashBankTransferInput) {
  return rpc(() => api.api["cash-bank"].transfers.$post({ json: input }));
}

export function importBankRecon(input: BankReconImportInput) {
  return requestJson<{ imported: unknown[] }>("/api/bank-recon/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function autoMatchBankRecon(bankAccountId: string) {
  return requestJson<{ matchedCount: number }>("/api/bank-recon/auto-match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bankAccountId }),
  });
}

export function matchBankRecon(input: BankReconMatchInput) {
  return requestJson("/api/bank-recon/matches", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function unmatchBankRecon(id: string) {
  return requestJson<null>(`/api/bank-recon/matches/${encodeURIComponent(id)}`, {
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
