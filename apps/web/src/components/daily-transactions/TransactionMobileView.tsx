import React from "react";
import {
  type TransactionType,
  TRANSACTION_GROUPS,
  inferTransactionGroup,
} from "@keuangan-apotek/shared";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Account } from "../../lib/queries";
import { formatSen, type DraftRow } from "./daily-transaction.types";
import { MetadataCellDisplay } from "./MetadataCellDisplay";
import { TransactionTypeInfoTooltip } from "./TransactionTypeInfoTooltip";

export type TransactionMobileViewProps = {
  filteredTransactionsList: any[];
  draftRows: DraftRow[];
  isLoading: boolean;
  selectedAccounts: Account[];
  selectedTxIds: Set<string>;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  typeById: Map<string, TransactionType>;
  accountById: Map<string, Account>;
  accountRunningMaps: Map<string, Map<string, { balance: number; mutation: number }>>;
  isSubmitting: boolean;
  groupPillsNode: React.ReactNode;
  onClearAccountFilters: () => void;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onToggleRowSelect: (id: string) => void;
  onSaveDraft: (draft: DraftRow) => void;
  onDeleteDraft: (id: string) => void;
  onOpenNewTransaction: () => void;
  onOpenEditTransaction: (tx: any) => void;
  onDeleteTransaction: (id: string) => void;
};

export function TransactionMobileView({
  filteredTransactionsList,
  draftRows,
  isLoading,
  selectedAccounts,
  selectedTxIds,
  isAllSelected,
  isSomeSelected,
  typeById,
  accountById,
  accountRunningMaps,
  isSubmitting,
  groupPillsNode,
  onClearAccountFilters,
  onToggleSelectAll,
  onClearSelection,
  onToggleRowSelect,
  onSaveDraft,
  onDeleteDraft,
  onOpenNewTransaction,
  onOpenEditTransaction,
  onDeleteTransaction,
}: TransactionMobileViewProps) {
  return (
    <div className="space-y-2">
      {/* Mobile Group Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto max-w-full rounded border border-slate-200 bg-white p-1 text-xs no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5 ml-1 shrink-0">
          Grup:
        </span>
        {groupPillsNode}
      </div>

      {/* Unsaved Drafts */}
      {draftRows.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-900">
              Draft Belum Disimpan ({draftRows.length})
            </span>
            <span className="text-[10px] text-blue-700">Simpan baris di bawah</span>
          </div>
          {draftRows.map((draft) => (
            <div
              key={draft.id}
              className="rounded-md border border-blue-200 bg-white p-2.5 shadow-2xs space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{draft.transactionDate}</span>
                <span className="font-bold text-slate-900 font-mono">
                  Rp {draft.amount || "0,00"}
                </span>
              </div>
              <div className="text-[11px] text-slate-600 truncate">
                {typeById.get(draft.transactionTypeId)?.name || "Pilih Tipe Transaksi"}
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={isSubmitting || !draft.transactionTypeId}
                  onClick={() => onSaveDraft(draft)}
                  className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteDraft(draft.id)}
                  className="rounded p-1 text-slate-400 hover:text-red-600 transition"
                  title="Hapus draft"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-muted">
          Memuat transaksi...
        </div>
      ) : filteredTransactionsList.length === 0 && draftRows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center space-y-2.5">
          <p className="text-muted text-xs">
            {selectedAccounts.length > 0 ? (
              <>
                Tidak ada transaksi terkait akun{" "}
                <strong>
                  {selectedAccounts.map((a) => `${a.code} · ${a.name}`).join(" atau ")}
                </strong>{" "}
                pada periode ini.
              </>
            ) : (
              "Belum ada transaksi pada periode ini."
            )}
          </p>
          <div className="flex justify-center gap-2">
            {selectedAccounts.length > 0 && (
              <button
                type="button"
                onClick={onClearAccountFilters}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hapus Filter Akun
              </button>
            )}
            <button
              type="button"
              onClick={onOpenNewTransaction}
              className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
            >
              <Plus size={13} /> Tambah Transaksi
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between pb-1 px-0.5 text-xs">
            <button
              type="button"
              onClick={onToggleSelectAll}
              className="inline-flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-medium py-1"
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeSelected;
                }}
                onChange={onToggleSelectAll}
                className="rounded border-slate-300 text-brand focus:ring-brand/20 cursor-pointer h-3.5 w-3.5 pointer-events-none"
              />
              <span>
                {isAllSelected
                  ? "Batalkan Pilih Semua"
                  : `Pilih Semua (${filteredTransactionsList.length})`}
              </span>
            </button>
            {selectedTxIds.size > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Batal ({selectedTxIds.size})
              </button>
            )}
          </div>

          {filteredTransactionsList.map((tx) => {
            const selectedType = typeById.get(tx.transactionTypeId);
            const schema = selectedType?.metadataSchema || [];
            const txGroup =
              tx.group ||
              inferTransactionGroup(
                accountById.get(tx.debitAccountId) ?? {
                  code: tx.debitAccountCode,
                  name: tx.debitAccountName,
                },
                accountById.get(tx.creditAccountId) ?? {
                  code: tx.creditAccountCode,
                  name: tx.creditAccountName,
                },
              );
            const gConf = TRANSACTION_GROUPS.find((g) => g.key === txGroup);

            return (
              <div
                key={tx.id}
                className={`rounded-lg border p-3 shadow-2xs space-y-2 transition ${
                  selectedTxIds.has(tx.id)
                    ? "border-brand/50 bg-blue-50/50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {/* Card Top: Checkbox, Date, PIC, and Group Badge */}
                <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      aria-label={`Pilih transaksi ${tx.id}`}
                      checked={selectedTxIds.has(tx.id)}
                      onChange={() => onToggleRowSelect(tx.id)}
                      className="rounded border-slate-300 text-brand focus:ring-brand/20 cursor-pointer h-4 w-4"
                    />
                    <span className="font-bold text-slate-800 text-xs tabular-nums">
                      {tx.transactionDate}
                    </span>
                    {tx.pic && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono font-semibold text-slate-700">
                        {tx.pic}
                      </span>
                    )}
                  </div>
                  {gConf && (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0 text-[10px] font-semibold border shrink-0 ${gConf.badgeClass}`}
                    >
                      {gConf.badgeLabel}
                    </span>
                  )}
                </div>

                {/* Card Main: Transaction Type & Amount */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-slate-900 text-xs truncate">
                        {tx.transactionTypeName || "Tipe Transaksi"}
                      </p>
                      <TransactionTypeInfoTooltip
                        debitCode={tx.debitAccountCode}
                        debitName={tx.debitAccountName}
                        creditCode={tx.creditAccountCode}
                        creditName={tx.creditAccountName}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {tx.debitAccountCode} &rarr; {tx.creditAccountCode}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-900 font-mono tabular-nums">
                      Rp {formatSen(tx.amount)}
                    </p>
                  </div>
                </div>

                {/* Metadata Tags if any */}
                {tx.metadata && Object.keys(tx.metadata).length > 0 && (
                  <div className="pt-0.5">
                    <MetadataCellDisplay
                      metadata={tx.metadata}
                      schema={schema}
                      isEditing={false}
                      onOpenEditor={() => {}}
                    />
                  </div>
                )}

                {/* Running Balances for filtered accounts if any */}
                {selectedAccounts.length > 0 && (
                  <div className="rounded bg-blue-50/60 border border-blue-100 p-2 space-y-1 text-xs">
                    {selectedAccounts.map((acc) => {
                      const item = accountRunningMaps.get(acc.id)?.get(tx.id);
                      const balance = item?.balance ?? 0;
                      const mutation = item?.mutation ?? 0;
                      return (
                        <div
                          key={acc.id}
                          className="flex items-center justify-between font-mono text-[11px]"
                        >
                          <span className="text-slate-600 truncate">
                            {acc.code} · {acc.name}:
                          </span>
                          <span className="font-bold text-slate-900 ml-2 shrink-0">
                            Rp {formatSen(balance)}{" "}
                            {mutation !== 0 && (
                              <span className={mutation > 0 ? "text-emerald-600" : "text-red-500"}>
                                ({mutation > 0 ? `+${formatSen(mutation)}` : formatSen(mutation)})
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onOpenEditTransaction(tx)}
                    className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                  >
                    <Pencil size={11} className="text-slate-500" />
                    <span>Ubah</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTransaction(tx.id)}
                    className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition"
                  >
                    <Trash2 size={11} className="text-rose-500" />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
