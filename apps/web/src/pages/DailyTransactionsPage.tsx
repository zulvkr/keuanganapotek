import { useState, useMemo, Fragment } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Trash2, Calendar, RotateCcw, Tag, CheckCircle2, Pencil } from "lucide-react";
import {
  parseRupiahToSen,
  senToRupiah,
  todayIsoDate,
  type TransactionWithBalances,
} from "@keuangan-apotek/shared";
import {
  getAccounts,
  getTransactionTypes,
  getTransactions,
  getTransactionsSummary,
  queryKeys,
  type Account,
} from "../lib/queries";
import {
  createTransaction,
  deleteTransaction,
  invalidateAccountingQueries,
  updateTransaction,
} from "../lib/mutations";
import { DynamicMetadataForm } from "../components/metadata/DynamicMetadataForm";

const CASH_BANK_COLS = [
  { code: "1101", short: "1101 Tukaran", full: "Uang tukaran kasir permanen" },
  { code: "1102", short: "1102 Tunai Kasir", full: "Tunai Kasir" },
  { code: "1103", short: "1103 Bank Jago", full: "Bank Jago Syariah" },
  { code: "1104", short: "1104 Shopee", full: "Saldo Penjual Shopee" },
  { code: "1105", short: "1105 Blibli", full: "Saldo Penjual Blibli" },
  { code: "1106", short: "1106 Grab", full: "Saldo Grab Merchant" },
  { code: "1107", short: "1107 QRIS DANA", full: "Saldo QRIS DANA" },
  { code: "1108", short: "1108 Sav. Gaji", full: "Saving Gaji" },
  { code: "1109", short: "1109 Sav. Sewa", full: "Saving Sewa" },
] as const;

function formatSen(value: number): string {
  const rupiah = senToRupiah(value);
  const fixed = rupiah.toFixed(2);
  const [whole, fraction] = fixed.split(".");
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}

function formatAmountInput(value: string): string {
  try {
    const sen = parseRupiahToSen(value || "0");
    const fixed = senToRupiah(sen).toFixed(2);
    const [whole, fraction] = fixed.split(".");
    return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
  } catch {
    return value;
  }
}

type DraftRow = {
  isNew?: boolean;
  id: string;
  transactionDate: string;
  transactionTypeId: string;
  amount: string;
  memo: string;
  metadata: Record<string, any>;
};

export default function DailyTransactionsPage() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [message, setMessage] = useState("");

  // New rows drafts
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  // Row currently being edited inline
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowState, setEditingRowState] = useState<DraftRow | null>(null);

  // Active popover for metadata editing
  const [activeMetadataRowIndex, setActiveMetadataRowIndex] = useState<{
    isDraft: boolean;
    idOrIndex: string | number;
  } | null>(null);

  // Queries
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const accounts: Account[] = accountsQuery.data ?? [];
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const typesQuery = useQuery({
    queryKey: queryKeys.transactionTypes(),
    queryFn: () => getTransactionTypes(),
  });
  const transactionTypes = typesQuery.data ?? [];
  const typeById = useMemo(
    () => new Map(transactionTypes.map((t) => [t.id, t])),
    [transactionTypes],
  );

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    queryFn: () =>
      getTransactions({
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      }),
  });
  const transactionsList: TransactionWithBalances[] = transactionsQuery.data ?? [];

  const summaryQuery = useQuery({
    queryKey: queryKeys.transactionsSummary,
    queryFn: getTransactionsSummary,
  });
  const summary = summaryQuery.data;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (draft: DraftRow) =>
      createTransaction({
        transactionDate: draft.transactionDate,
        transactionTypeId: draft.transactionTypeId,
        amount: draft.amount || "0",
        memo: draft.memo || undefined,
        metadata: draft.metadata,
      }),
    onSuccess: async (_, draft) => {
      setMessage("Transaksi berhasil disimpan.");
      setDraftRows((prev) => prev.filter((r) => r.id !== draft.id));
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan transaksi");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: DraftRow }) =>
      updateTransaction(id, {
        transactionDate: draft.transactionDate,
        transactionTypeId: draft.transactionTypeId,
        amount: draft.amount || "0",
        memo: draft.memo || undefined,
        metadata: draft.metadata,
      }),
    onSuccess: async () => {
      setMessage("Transaksi berhasil diperbarui.");
      setEditingRowId(null);
      setEditingRowState(null);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "Gagal memperbarui transaksi");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: async () => {
      setMessage("Transaksi berhasil dihapus.");
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "Gagal menghapus transaksi");
    },
  });

  function addNewRow() {
    const defaultType = transactionTypes[0];
    const newDraft: DraftRow = {
      isNew: true,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      transactionDate: todayIsoDate(),
      transactionTypeId: defaultType ? defaultType.id : "",
      amount: "",
      memo: "",
      metadata: {},
    };
    setDraftRows((prev) => [newDraft, ...prev]);
  }

  function startEditExisting(tx: TransactionWithBalances) {
    setEditingRowId(tx.id);
    setEditingRowState({
      id: tx.id,
      transactionDate: tx.transactionDate,
      transactionTypeId: tx.transactionTypeId,
      amount: senToRupiah(tx.amount).toFixed(2),
      memo: tx.memo || "",
      metadata: tx.metadata || {},
    });
  }

  function cancelEditExisting() {
    setEditingRowId(null);
    setEditingRowState(null);
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900 shadow-sm">
          <CheckCircle2 size={16} className="text-brand shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Top 9 Cash & Bank Summary Cards */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Saldo Akhir Kas & Bank (Live Ending Balance)
          </h3>
          <span className="text-[11px] text-muted">9 Akun Kas & Setara Kas</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
          {CASH_BANK_COLS.map(({ code, short }) => {
            const accSummary = summary?.accounts.find((a) => a.code === code);
            const balance = accSummary?.balance ?? 0;
            const isNegative = balance < 0;

            return (
              <div
                key={code}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-blue-200 transition"
              >
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 truncate" title={short}>
                    {short}
                  </p>
                  <p
                    className={`mt-1 font-mono text-sm font-bold tabular-nums truncate ${isNegative ? "text-red-600" : "text-slate-900"}`}
                  >
                    Rp {formatSen(balance)}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Normal: D</span>
                  <span className={balance > 0 ? "text-emerald-600 font-semibold" : ""}>
                    {balance > 0 ? "Surplus" : balance < 0 ? "Defisit" : "Rp 0"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Filter and Action Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs tabular-nums outline-none focus:border-brand"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs tabular-nums outline-none focus:border-brand"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                title="Reset filter tanggal"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={addNewRow}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
        >
          <Plus size={15} /> Baris Baru
        </button>
      </div>

      {/* Spreadsheet Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-3 w-32 border-r border-slate-200">Tanggal</th>
                <th className="px-3 py-3 min-w-[210px] border-r border-slate-200">
                  Tipe Transaksi
                </th>
                <th className="px-3 py-3 w-40 border-r border-slate-200">Akun Debit (+)</th>
                <th className="px-3 py-3 w-40 border-r border-slate-200">Akun Kredit (-)</th>
                <th className="px-3 py-3 w-36 text-right border-r border-slate-200">
                  Nominal (Rp)
                </th>
                <th className="px-3 py-3 min-w-[160px] border-r border-slate-200">Keterangan</th>
                <th className="px-3 py-3 min-w-[140px] border-r border-slate-200">Metadata</th>

                {/* 9 Cash & Bank Columns Header */}
                {CASH_BANK_COLS.map(({ code, short }) => (
                  <th
                    key={code}
                    className="px-2.5 py-3 w-32 text-right border-r border-slate-200 bg-slate-100/60 font-mono"
                    title={short}
                  >
                    {short}
                  </th>
                ))}

                <th className="px-3 py-3 w-20 text-center sticky right-0 bg-slate-50 shadow-l">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {/* Draft Rows being newly added */}
              {draftRows.map((draft) => {
                const selectedType = typeById.get(draft.transactionTypeId);
                const debitAcc = selectedType ? accountById.get(selectedType.debitAccountId) : null;
                const creditAcc = selectedType
                  ? accountById.get(selectedType.creditAccountId)
                  : null;
                const schema = selectedType?.metadataSchema || [];
                const filledKeys = Object.keys(draft.metadata).filter(
                  (k) => draft.metadata[k] !== undefined && draft.metadata[k] !== "",
                );
                const isMetadataOpen =
                  activeMetadataRowIndex?.isDraft && activeMetadataRowIndex.idOrIndex === draft.id;

                return (
                  <Fragment key={draft.id}>
                    <tr
                      className={`border-b transition ${
                        isMetadataOpen
                          ? "bg-blue-50/70 border-blue-200"
                          : "bg-blue-50/40 border-blue-100"
                      }`}
                    >
                      {/* Date */}
                      <td className="px-2 py-2 border-r border-slate-200">
                        <input
                          type="date"
                          value={draft.transactionDate}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((r) =>
                                r.id === draft.id ? { ...r, transactionDate: e.target.value } : r,
                              ),
                            )
                          }
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand"
                        />
                      </td>

                      {/* Transaction Type */}
                      <td className="px-2 py-2 border-r border-slate-200">
                        <select
                          value={draft.transactionTypeId}
                          onChange={(e) => {
                            const newTypeId = e.target.value;
                            setDraftRows((prev) =>
                              prev.map((r) =>
                                r.id === draft.id
                                  ? { ...r, transactionTypeId: newTypeId, metadata: {} }
                                  : r,
                              ),
                            );
                          }}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand font-medium"
                        >
                          {transactionTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.code} · {t.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Debit Account (Locked / Read-only) */}
                      <td className="px-2.5 py-2 border-r border-slate-200 bg-slate-50/50">
                        <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-100 truncate w-full">
                          {debitAcc ? `${debitAcc.code} · ${debitAcc.name}` : "—"}
                        </span>
                      </td>

                      {/* Credit Account (Locked / Read-only) */}
                      <td className="px-2.5 py-2 border-r border-slate-200 bg-slate-50/50">
                        <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-100 truncate w-full">
                          {creditAcc ? `${creditAcc.code} · ${creditAcc.name}` : "—"}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-2 py-2 border-r border-slate-200">
                        <input
                          type="text"
                          placeholder="0,00"
                          value={draft.amount}
                          onBlur={(e) => {
                            const formatted = formatAmountInput(e.target.value);
                            setDraftRows((prev) =>
                              prev.map((r) =>
                                r.id === draft.id ? { ...r, amount: formatted } : r,
                              ),
                            );
                          }}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((r) =>
                                r.id === draft.id ? { ...r, amount: e.target.value } : r,
                              ),
                            )
                          }
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs tabular-nums outline-none focus:border-brand"
                        />
                      </td>

                      {/* Memo */}
                      <td className="px-2 py-2 border-r border-slate-200">
                        <input
                          type="text"
                          placeholder="Keterangan..."
                          value={draft.memo}
                          onChange={(e) =>
                            setDraftRows((prev) =>
                              prev.map((r) =>
                                r.id === draft.id ? { ...r, memo: e.target.value } : r,
                              ),
                            )
                          }
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand"
                        />
                      </td>

                      {/* Metadata Trigger */}
                      <td className="px-2 py-2 border-r border-slate-200">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveMetadataRowIndex(
                              isMetadataOpen ? null : { isDraft: true, idOrIndex: draft.id },
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-brand hover:bg-blue-100 transition"
                        >
                          <Tag size={12} />
                          {filledKeys.length > 0 ? (
                            <span>{filledKeys.length} field</span>
                          ) : (
                            <span>+ Metadata</span>
                          )}
                        </button>
                      </td>

                      {/* 9 columns in draft are displayed as '-' until saved */}
                      {CASH_BANK_COLS.map(({ code }) => (
                        <td
                          key={code}
                          className="px-2.5 py-2 text-right border-r border-slate-200 bg-slate-50/40 text-slate-400 font-mono"
                        >
                          —
                        </td>
                      ))}

                      {/* Actions */}
                      <td className="px-2 py-2 text-center sticky right-0 bg-blue-50/90 shadow-l">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            disabled={createMutation.isPending || !draft.transactionTypeId}
                            onClick={() => createMutation.mutate(draft)}
                            className="rounded-lg bg-brand p-1.5 text-white hover:bg-blue-700 disabled:opacity-50 transition"
                            title="Simpan baris transaksi"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDraftRows((prev) => prev.filter((r) => r.id !== draft.id))
                            }
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Batal"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Inline Sub-row for Draft Metadata */}
                    {isMetadataOpen && (
                      <tr
                        key={`${draft.id}-metadata`}
                        className="bg-blue-50/20 border-b border-blue-200"
                      >
                        <td
                          colSpan={17}
                          className="px-6 py-4 bg-slate-50/70 border-b border-slate-200"
                        >
                          <div className="sticky left-4 max-w-2xl">
                            <DynamicMetadataForm
                              schema={schema}
                              initialValues={draft.metadata}
                              onSave={(newMeta) => {
                                setDraftRows((prev) =>
                                  prev.map((r) =>
                                    r.id === draft.id ? { ...r, metadata: newMeta } : r,
                                  ),
                                );
                                setActiveMetadataRowIndex(null);
                              }}
                              onCancel={() => setActiveMetadataRowIndex(null)}
                              title={`Metadata: ${selectedType?.name || "Transaksi"} (Baris Baru)`}
                              className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-4 shadow-sm border border-blue-200"
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

              {/* Transactions List */}
              {transactionsQuery.isLoading ? (
                <tr>
                  <td colSpan={17} className="px-4 py-12 text-center text-muted">
                    Memuat transaksi...
                  </td>
                </tr>
              ) : transactionsList.length === 0 && draftRows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-4 py-12 text-center text-muted">
                    Belum ada transaksi. Klik <strong>+ Baris Baru</strong> untuk menambah transaksi
                    pertama Anda.
                  </td>
                </tr>
              ) : (
                transactionsList.map((tx) => {
                  const isEditing = editingRowId === tx.id;
                  const currentDraft = isEditing ? editingRowState! : null;

                  const selectedType = typeById.get(
                    isEditing ? currentDraft!.transactionTypeId : tx.transactionTypeId,
                  );
                  const schema = selectedType?.metadataSchema || [];
                  const filledKeys = Object.keys(
                    isEditing ? currentDraft!.metadata : tx.metadata,
                  ).filter(
                    (k) =>
                      (isEditing ? currentDraft!.metadata : tx.metadata)[k] !== undefined &&
                      (isEditing ? currentDraft!.metadata : tx.metadata)[k] !== "",
                  );

                  const isMetadataOpen =
                    !activeMetadataRowIndex?.isDraft && activeMetadataRowIndex?.idOrIndex === tx.id;

                  return (
                    <Fragment key={tx.id}>
                      <tr
                        className={`hover:bg-slate-50/70 transition ${
                          isEditing ? "bg-amber-50/30" : ""
                        } ${isEditing && isMetadataOpen ? "bg-amber-50/50" : ""}`}
                      >
                        {/* Tanggal */}
                        <td className="px-2 py-2.5 border-r border-slate-200 tabular-nums">
                          {isEditing ? (
                            <input
                              type="date"
                              value={currentDraft!.transactionDate}
                              onChange={(e) =>
                                setEditingRowState((prev) =>
                                  prev ? { ...prev, transactionDate: e.target.value } : null,
                                )
                              }
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand"
                            />
                          ) : (
                            tx.transactionDate
                          )}
                        </td>

                        {/* Tipe Transaksi */}
                        <td className="px-2 py-2.5 border-r border-slate-200">
                          {isEditing ? (
                            <select
                              value={currentDraft!.transactionTypeId}
                              onChange={(e) => {
                                const newTypeId = e.target.value;
                                setEditingRowState((prev) =>
                                  prev ? { ...prev, transactionTypeId: newTypeId } : null,
                                );
                              }}
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand font-medium"
                            >
                              {transactionTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.code} · {t.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="font-semibold text-slate-900">
                              {tx.transactionTypeName || "Tipe Transaksi"}
                            </div>
                          )}
                        </td>

                        {/* Akun Debit (Locked) */}
                        <td className="px-2.5 py-2.5 border-r border-slate-200">
                          <span className="inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-100 truncate w-full">
                            {tx.debitAccountCode
                              ? `${tx.debitAccountCode} · ${tx.debitAccountName}`
                              : "—"}
                          </span>
                        </td>

                        {/* Akun Kredit (Locked) */}
                        <td className="px-2.5 py-2.5 border-r border-slate-200">
                          <span className="inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-100 truncate w-full">
                            {tx.creditAccountCode
                              ? `${tx.creditAccountCode} · ${tx.creditAccountName}`
                              : "—"}
                          </span>
                        </td>

                        {/* Nominal */}
                        <td className="px-2 py-2.5 text-right font-mono tabular-nums border-r border-slate-200">
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentDraft!.amount}
                              onBlur={(e) => {
                                const formatted = formatAmountInput(e.target.value);
                                setEditingRowState((prev) =>
                                  prev ? { ...prev, amount: formatted } : null,
                                );
                              }}
                              onChange={(e) =>
                                setEditingRowState((prev) =>
                                  prev ? { ...prev, amount: e.target.value } : null,
                                )
                              }
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-right font-mono text-xs tabular-nums outline-none focus:border-brand"
                            />
                          ) : (
                            <span className="font-bold text-slate-800">
                              Rp {formatSen(tx.amount)}
                            </span>
                          )}
                        </td>

                        {/* Keterangan */}
                        <td className="px-2 py-2.5 border-r border-slate-200 text-slate-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={currentDraft!.memo}
                              onChange={(e) =>
                                setEditingRowState((prev) =>
                                  prev ? { ...prev, memo: e.target.value } : null,
                                )
                              }
                              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand"
                            />
                          ) : (
                            tx.memo || "—"
                          )}
                        </td>

                        {/* Metadata Chip and Trigger */}
                        <td className="px-2 py-2.5 border-r border-slate-200">
                          {isEditing ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveMetadataRowIndex(
                                  isMetadataOpen ? null : { isDraft: false, idOrIndex: tx.id },
                                )
                              }
                              className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-brand hover:bg-blue-100 transition"
                            >
                              <Tag size={12} />
                              {filledKeys.length > 0 ? (
                                <span>{filledKeys.length} field</span>
                              ) : (
                                <span>+ Metadata</span>
                              )}
                            </button>
                          ) : filledKeys.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {filledKeys.slice(0, 2).map((key) => {
                                const fDef = schema.find((f) => f.key === key);
                                const label = fDef?.label || key;
                                const rawVal = tx.metadata[key];
                                const val =
                                  typeof rawVal === "boolean"
                                    ? rawVal
                                      ? "Ya"
                                      : "Tidak"
                                    : Array.isArray(rawVal)
                                      ? rawVal.join(", ")
                                      : String(rawVal ?? "");
                                return (
                                  <span
                                    key={key}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700"
                                    title={`${label}: ${val}`}
                                  >
                                    {label}: {val.length > 14 ? `${val.slice(0, 12)}…` : val}
                                  </span>
                                );
                              })}
                              {filledKeys.length > 2 && (
                                <span className="rounded bg-slate-200 px-1 py-0.5 text-[9px] text-slate-600">
                                  +{filledKeys.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* 9 Cash & Bank Running Balances & Mutation Indicator */}
                        {CASH_BANK_COLS.map(({ code }) => {
                          const balance = tx.runningBalances[code] ?? 0;
                          const mutation = tx.mutations[code] ?? 0;

                          return (
                            <td
                              key={code}
                              className="px-2.5 py-2 text-right border-r border-slate-200 font-mono text-[11px] tabular-nums"
                            >
                              <div className="font-semibold text-slate-800">
                                Rp {formatSen(balance)}
                              </div>
                              {mutation !== 0 && (
                                <div
                                  className={`text-[10px] font-bold ${mutation > 0 ? "text-emerald-600" : "text-red-500"}`}
                                >
                                  {mutation > 0 ? `+${formatSen(mutation)}` : formatSen(mutation)}
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Action buttons */}
                        <td className="px-2 py-2 text-center sticky right-0 bg-white/95 shadow-l">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateMutation.mutate({ id: tx.id, draft: currentDraft! })
                                }
                                className="rounded-lg bg-brand p-1.5 text-white hover:bg-blue-700 transition"
                                title="Simpan perubahan"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditExisting}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"
                                title="Batal"
                              >
                                <RotateCcw size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditExisting(tx)}
                                className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-brand transition"
                                title="Edit transaksi"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Hapus transaksi ini? Jurnal terkait juga akan dihapus.",
                                    )
                                  ) {
                                    deleteMutation.mutate(tx.id);
                                  }
                                }}
                                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                                title="Hapus transaksi"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* Expandable Inline Sub-row for Existing Transaction Metadata */}
                      {isEditing && isMetadataOpen && (
                        <tr
                          key={`${tx.id}-metadata`}
                          className="bg-amber-50/20 border-b border-amber-200"
                        >
                          <td
                            colSpan={17}
                            className="px-6 py-4 bg-slate-50/70 border-b border-slate-200"
                          >
                            <div className="sticky left-4 max-w-2xl">
                              <DynamicMetadataForm
                                schema={schema}
                                initialValues={currentDraft ? currentDraft.metadata : tx.metadata}
                                onSave={(newMeta) => {
                                  setEditingRowState((prev) =>
                                    prev ? { ...prev, metadata: newMeta } : null,
                                  );
                                  setActiveMetadataRowIndex(null);
                                }}
                                onCancel={() => setActiveMetadataRowIndex(null)}
                                title={`Metadata: ${selectedType?.name || "Transaksi"}`}
                                className="w-full max-w-2xl space-y-4 rounded-xl bg-white p-4 shadow-sm border border-amber-200"
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
