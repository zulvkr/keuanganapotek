import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Copy, Trash2, Search, X, Save, BookTemplate } from "lucide-react";
import {
  inferTransactionGroup,
  TRANSACTION_GROUPS,
  type MetadataFieldDefinition,
  type TransactionGroup,
  type TransactionType,
} from "@keuangan-apotek/shared";
import { getAccounts, getTransactionTypes, queryKeys, type Account } from "../lib/queries";
import {
  createTransactionType,
  deleteTransactionType,
  invalidateAccountingQueries,
  updateTransactionType,
} from "../lib/mutations";
import { MetadataSchemaBuilder } from "../components/metadata/MetadataSchemaBuilder";
import { toast } from "../lib/toast";

function getNextTransactionCode(items: TransactionType[]): string {
  let maxNum = 0;
  for (const t of items) {
    const match = t.code.match(/TRX-(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  return `TRX-${String(maxNum + 1).padStart(2, "0")}`;
}

export default function MasterTransactionPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<TransactionGroup | "all">("all");
  const [editingType, setEditingType] = useState<TransactionType | null>(null);
  const [duplicatingFromName, setDuplicatingFromName] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form State
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formDebitId, setFormDebitId] = useState("");
  const [formCreditId, setFormCreditId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSchema, setFormSchema] = useState<MetadataFieldDefinition[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);

  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const accounts: Account[] = (accountsQuery.data ?? []).filter((a) => a.isActive);

  const typesQuery = useQuery({
    queryKey: queryKeys.transactionTypes(true),
    queryFn: () => getTransactionTypes({ includeInactive: true }),
  });
  const transactionTypes = typesQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: formCode.trim(),
        name: formName.trim(),
        debitAccountId: formDebitId,
        creditAccountId: formCreditId,
        description: formDescription.trim() || undefined,
        metadataSchema: formSchema,
        isActive: formIsActive,
      };

      if (editingType) {
        return updateTransactionType(editingType.id, payload);
      } else {
        return createTransactionType(payload);
      }
    },
    onSuccess: async () => {
      toast.success(
        editingType
          ? "Tipe transaksi berhasil diperbarui."
          : duplicatingFromName
            ? "Tipe transaksi hasil duplikasi berhasil dibuat."
            : "Tipe transaksi baru berhasil dibuat.",
      );
      closeForm();
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan tipe transaksi");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransactionType(id),
    onSuccess: async () => {
      toast.success("Tipe transaksi dinonaktifkan/dihapus.");
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus tipe transaksi");
    },
  });

  function openCreate() {
    setEditingType(null);
    setDuplicatingFromName(null);
    setFormCode(getNextTransactionCode(transactionTypes));
    setFormName("");
    setFormDebitId(accounts[0]?.id || "");
    setFormCreditId(accounts[1]?.id || "");
    setFormDescription("");
    setFormSchema([]);
    setFormIsActive(true);
    setIsCreating(true);
  }

  function openEdit(item: TransactionType) {
    setEditingType(item);
    setDuplicatingFromName(null);
    setFormCode(item.code);
    setFormName(item.name);
    setFormDebitId(item.debitAccountId);
    setFormCreditId(item.creditAccountId);
    setFormDescription(item.description || "");
    setFormSchema(item.metadataSchema || []);
    setFormIsActive(item.isActive);
    setIsCreating(true);
  }

  function openDuplicate(item: TransactionType) {
    setEditingType(null);
    setDuplicatingFromName(item.name);
    setFormCode(getNextTransactionCode(transactionTypes));
    setFormName(`${item.name} (Salinan)`);
    setFormDebitId(item.debitAccountId);
    setFormCreditId(item.creditAccountId);
    setFormDescription(item.description || "");
    setFormSchema(item.metadataSchema ? JSON.parse(JSON.stringify(item.metadataSchema)) : []);
    setFormIsActive(true);
    setIsCreating(true);
  }

  function closeForm() {
    setIsCreating(false);
    setEditingType(null);
    setDuplicatingFromName(null);
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const filteredTypes = transactionTypes.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q));
    if (!matchesSearch) return false;

    if (groupFilter !== "all") {
      const debitAcc = accountById.get(t.debitAccountId);
      const creditAcc = accountById.get(t.creditAccountId);
      const g = t.group || inferTransactionGroup(debitAcc, creditAcc);
      return g === groupFilter;
    }
    return true;
  });

  return (
    <div className="space-y-1.5 text-xs">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-slate-200 bg-white p-1 text-xs">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-slate-900 tracking-tight">Master Tipe Transaksi</h2>
          <span className="text-[11px] text-muted hidden sm:inline">
            Template jurnal berpasangan & skema metadata dinamis
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as TransactionGroup | "all")}
            className="h-6 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs outline-none focus:border-brand font-medium text-slate-700"
            title="Filter berdasarkan grup transaksi"
          >
            <option value="all">Semua Grup ({transactionTypes.length})</option>
            {TRANSACTION_GROUPS.map((grp) => {
              const count = transactionTypes.filter((t) => {
                const g =
                  t.group ||
                  inferTransactionGroup(
                    accountById.get(t.debitAccountId),
                    accountById.get(t.creditAccountId),
                  );
                return g === grp.key;
              }).length;
              return (
                <option key={grp.key} value={grp.key}>
                  {grp.label} ({count})
                </option>
              );
            })}
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-1.5 text-slate-400" size={12} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tipe transaksi..."
              className="h-6 rounded border border-slate-200 bg-white pl-6 pr-2 py-0.5 text-xs outline-none focus:border-brand"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            <Plus size={13} /> Tambah Tipe Transaksi
          </button>
        </div>
      </div>

      {/* Table list */}
      <div className="rounded border border-slate-200 bg-white overflow-hidden">
        <table className="w-full table-fixed text-left border-collapse text-xs">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700">
            <tr>
              <th className="px-2 py-1 w-16 border-r border-slate-200">Kode</th>
              <th className="px-2 py-1 w-[22%] border-r border-slate-200">Nama Transaksi</th>
              <th className="px-2 py-1 w-28 border-r border-slate-200">Grup Bisnis</th>
              <th className="px-2 py-1 w-[21%] border-r border-slate-200">Akun Debit (+)</th>
              <th className="px-2 py-1 w-[21%] border-r border-slate-200">Akun Kredit (-)</th>
              <th className="px-2 py-1 border-r border-slate-200">Skema Metadata</th>
              <th className="px-2 py-1 w-16 text-center border-r border-slate-200">Status</th>
              <th className="px-2 py-1 w-20 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {typesQuery.isLoading ? (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-muted">
                  Memuat tipe transaksi...
                </td>
              </tr>
            ) : filteredTypes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-6 text-center text-muted">
                  Tidak ada tipe transaksi yang cocok.
                </td>
              </tr>
            ) : (
              filteredTypes.map((item, itemIdx) => {
                const debitAcc = accountById.get(item.debitAccountId);
                const creditAcc = accountById.get(item.creditAccountId);
                const schemaFields = item.metadataSchema || [];

                return (
                  <tr
                    key={item.id}
                    className={`transition ${!item.isActive ? "opacity-60 bg-slate-50/30" : itemIdx % 2 === 0 ? "bg-white hover:bg-blue-50/40" : "bg-slate-50/60 hover:bg-blue-50/40"}`}
                  >
                    <td className="px-2 py-1 font-mono font-semibold text-brand tabular-nums border-r border-slate-100 whitespace-nowrap overflow-hidden text-ellipsis">
                      {item.code}
                    </td>
                    <td className="px-2 py-1 border-r border-slate-100 min-w-0 overflow-hidden">
                      <div className="font-semibold text-slate-900 truncate" title={item.name}>
                        {item.name}
                      </div>
                      {item.description && (
                        <div
                          className="text-[11px] text-slate-500 truncate"
                          title={item.description}
                        >
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1 border-r border-slate-100 whitespace-nowrap overflow-hidden">
                      {(() => {
                        const gKey = item.group || inferTransactionGroup(debitAcc, creditAcc);
                        const gConf = TRANSACTION_GROUPS.find((g) => g.key === gKey);
                        return gConf ? (
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border ${gConf.badgeClass}`}
                          >
                            {gConf.badgeLabel}
                          </span>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-2 py-1 border-r border-slate-100 min-w-0 overflow-hidden">
                      <div
                        className="inline-flex max-w-full items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-100"
                        title={debitAcc ? `${debitAcc.code} · ${debitAcc.name}` : undefined}
                      >
                        <span className="font-mono font-bold tabular-nums shrink-0">
                          {debitAcc?.code || "—"}
                        </span>
                        <span className="text-emerald-400 shrink-0">·</span>
                        <span className="truncate">{debitAcc?.name || "Akun tidak ditemukan"}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1 border-r border-slate-100 min-w-0 overflow-hidden">
                      <div
                        className="inline-flex max-w-full items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-100"
                        title={creditAcc ? `${creditAcc.code} · ${creditAcc.name}` : undefined}
                      >
                        <span className="font-mono font-bold tabular-nums shrink-0">
                          {creditAcc?.code || "—"}
                        </span>
                        <span className="text-amber-400 shrink-0">·</span>
                        <span className="truncate">
                          {creditAcc?.name || "Akun tidak ditemukan"}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1 border-r border-slate-100 min-w-0 overflow-hidden">
                      {schemaFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {schemaFields.map((f, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-slate-100 px-1 py-0 text-[10px] text-slate-600 truncate max-w-full"
                              title={`Tipe: ${f.type}${f.required ? " (Wajib)" : ""}`}
                            >
                              {f.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          Tanpa field metadata
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-center border-r border-slate-100 whitespace-nowrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                      >
                        {item.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-2 py-1 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-brand transition"
                          title="Edit tipe transaksi"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDuplicate(item)}
                          className="rounded p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition"
                          title="Duplikat / Salin tipe transaksi ini"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Hapus/nonaktifkan tipe transaksi ${item.name}?`)) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="Hapus tipe transaksi"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Editor Modal / Drawer */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand/10 text-brand">
                  <BookTemplate size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingType
                      ? "Edit Tipe Transaksi"
                      : duplicatingFromName
                        ? "Duplikat Tipe Transaksi"
                        : "Tambah Tipe Transaksi Baru"}
                  </h3>
                  <p className="text-xs text-muted">
                    {duplicatingFromName
                      ? `Menduplikasi dari "${duplicatingFromName}". Seluruh akun dan skema metadata telah disalin.`
                      : "Atur nama, akun berpasangan debit/kredit, dan susun skema metadata"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {duplicatingFromName && (
                <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900">
                  <Copy size={16} className="text-brand shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-semibold">Menduplikasi data dari:</span>{" "}
                    {duplicatingFromName}.
                    <p className="text-[11px] text-blue-700">
                      Akun debit, akun kredit, dan seluruh susunan skema metadata telah disalin
                      otomatis. Sesuaikan kode, nama, atau akun debit/kredit yang berbeda sebelum
                      menyimpan.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Kode Transaksi
                  </label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="TRX-01"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Nama Tipe Transaksi
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Penjualan Tunai Kasir"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-emerald-700">
                    Akun Debit (+) [Bertambah untuk Aset/Beban]
                  </label>
                  <select
                    value={formDebitId}
                    onChange={(e) => setFormDebitId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">-- Pilih Akun Debit --</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name} ({a.classification})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700">
                    Akun Kredit (-) [Bertambah untuk Kewajiban/Ekuitas/Pendapatan]
                  </label>
                  <select
                    value={formCreditId}
                    onChange={(e) => setFormCreditId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">-- Pilih Akun Kredit --</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.name} ({a.classification})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Inferred Group Preview */}
              {formDebitId && formCreditId && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Grup Transaksi Terdeteksi Otomatis:
                    </span>
                    {(() => {
                      const deb = accountById.get(formDebitId);
                      const cred = accountById.get(formCreditId);
                      const detectedGroup = inferTransactionGroup(deb, cred);
                      const conf = TRANSACTION_GROUPS.find((g) => g.key === detectedGroup);
                      return conf ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${conf.badgeClass}`}
                        >
                          {conf.label}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {(() => {
                      const deb = accountById.get(formDebitId);
                      const cred = accountById.get(formCreditId);
                      const detectedGroup = inferTransactionGroup(deb, cred);
                      const conf = TRANSACTION_GROUPS.find((g) => g.key === detectedGroup);
                      return conf?.description || "";
                    })()}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Keterangan / Deskripsi
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Deskripsi singkat jenis transaksi ini..."
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="rounded border-slate-300 text-brand focus:ring-blue-100"
                />
                <label
                  htmlFor="isActiveToggle"
                  className="text-xs font-medium text-slate-700 cursor-pointer"
                >
                  Aktifkan tipe transaksi ini untuk pemilihan di Buku Transaksi
                </label>
              </div>

              {/* Visual Metadata Schema Builder */}
              <div>
                <MetadataSchemaBuilder
                  schema={formSchema}
                  onChange={(newSchema) => setFormSchema(newSchema)}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  !formCode || !formName || !formDebitId || !formCreditId || saveMutation.isPending
                }
                onClick={() => saveMutation.mutate()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
              >
                <Save size={14} /> Simpan Tipe Transaksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
