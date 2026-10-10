import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, X, Save, CheckCircle2, BookTemplate } from "lucide-react";
import type { MetadataFieldDefinition, TransactionType } from "@keuangan-apotek/shared";
import { getAccounts, getTransactionTypes, queryKeys, type Account } from "../lib/queries";
import {
  createTransactionType,
  deleteTransactionType,
  invalidateAccountingQueries,
  updateTransactionType,
} from "../lib/mutations";
import { MetadataSchemaBuilder } from "../components/metadata/MetadataSchemaBuilder";

export default function MasterTransactionPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingType, setEditingType] = useState<TransactionType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState("");

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
      setMessage(
        editingType
          ? "Tipe transaksi berhasil diperbarui."
          : "Tipe transaksi baru berhasil dibuat.",
      );
      closeForm();
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "Gagal menyimpan tipe transaksi");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransactionType(id),
    onSuccess: async () => {
      setMessage("Tipe transaksi dinonaktifkan/dihapus.");
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "Gagal menghapus tipe transaksi");
    },
  });

  function openCreate() {
    setEditingType(null);
    setFormCode(`TRX-${String(transactionTypes.length + 1).padStart(2, "0")}`);
    setFormName("");
    setFormDebitId(accounts[0]?.id || "");
    setFormCreditId(accounts[1]?.id || "");
    setFormDescription("");
    setFormSchema([]);
    setFormIsActive(true);
    setIsCreating(true);
    setMessage("");
  }

  function openEdit(item: TransactionType) {
    setEditingType(item);
    setFormCode(item.code);
    setFormName(item.name);
    setFormDebitId(item.debitAccountId);
    setFormCreditId(item.creditAccountId);
    setFormDescription(item.description || "");
    setFormSchema(item.metadataSchema || []);
    setFormIsActive(item.isActive);
    setIsCreating(true);
    setMessage("");
  }

  function closeForm() {
    setIsCreating(false);
    setEditingType(null);
  }

  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const filteredTypes = transactionTypes.filter((t) => {
    const q = search.toLowerCase();
    return (
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900 shadow-sm">
          <CheckCircle2 size={16} className="text-brand shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Master Tipe Transaksi</h2>
          <p className="text-xs text-muted">
            Kelola template transaksi apotek, pasangan akun Debit & Kredit, serta skema metadata
            dinamis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={15} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari tipe transaksi..."
              className="rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <Plus size={15} /> Tambah Tipe Transaksi
          </button>
        </div>
      </div>

      {/* Table list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5 w-24">Kode</th>
                <th className="px-4 py-3.5 min-w-[200px]">Nama Transaksi</th>
                <th className="px-4 py-3.5 min-w-[200px]">Akun Debit (+)</th>
                <th className="px-4 py-3.5 min-w-[200px]">Akun Kredit (-)</th>
                <th className="px-4 py-3.5 min-w-[150px]">Skema Metadata</th>
                <th className="px-4 py-3.5 w-24 text-center">Status</th>
                <th className="px-4 py-3.5 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {typesQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Memuat tipe transaksi...
                  </td>
                </tr>
              ) : filteredTypes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Tidak ada tipe transaksi yang cocok.
                  </td>
                </tr>
              ) : (
                filteredTypes.map((item) => {
                  const debitAcc = accountById.get(item.debitAccountId);
                  const creditAcc = accountById.get(item.creditAccountId);
                  const schemaFields = item.metadataSchema || [];

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition ${!item.isActive ? "opacity-60 bg-slate-50/30" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-brand">{item.code}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        {item.description && (
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 border border-emerald-100">
                          <span className="font-mono font-bold">{debitAcc?.code || "—"}</span> ·{" "}
                          {debitAcc?.name || "Akun tidak ditemukan"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800 border border-amber-100">
                          <span className="font-mono font-bold">{creditAcc?.code || "—"}</span> ·{" "}
                          {creditAcc?.name || "Akun tidak ditemukan"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {schemaFields.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {schemaFields.map((f, idx) => (
                              <span
                                key={idx}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                                title={`Tipe: ${f.type}${f.required ? " (Wajib)" : ""}`}
                              >
                                {f.label}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Tanpa field metadata</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                        >
                          {item.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="rounded p-1.5 text-slate-400 hover:bg-blue-50 hover:text-brand transition"
                            title="Edit tipe transaksi"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Hapus/nonaktifkan tipe transaksi ${item.name}?`)) {
                                deleteMutation.mutate(item.id);
                              }
                            }}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Hapus tipe transaksi"
                          >
                            <Trash2 size={14} />
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
                    {editingType ? "Edit Tipe Transaksi" : "Tambah Tipe Transaksi Baru"}
                  </h3>
                  <p className="text-xs text-muted">
                    Atur nama, akun berpasangan debit/kredit, dan susun skema metadata
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
