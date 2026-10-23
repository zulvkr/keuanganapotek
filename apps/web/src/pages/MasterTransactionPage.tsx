import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  Search,
  X,
  Save,
  BookTemplate,
  Layers,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";
import {
  inferTransactionGroup,
  TRANSACTION_GROUPS,
  type MetadataFieldDefinition,
  type TransactionGroup,
  type TransactionGroupDetail,
  type TransactionType,
} from "@keuangan-apotek/shared";
import {
  getAccounts,
  getTransactionGroups,
  getTransactionTypes,
  queryKeys,
  type Account,
  type SaveTransactionTypeInput,
} from "../lib/queries";
import {
  createTransactionType,
  deleteTransactionType,
  invalidateAccountingQueries,
  resetTransactionGroup,
  updateTransactionGroup,
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
  const [formGroup, setFormGroup] = useState<TransactionGroup>("omzet");
  const [formDebitId, setFormDebitId] = useState("");
  const [formCreditId, setFormCreditId] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSchema, setFormSchema] = useState<MetadataFieldDefinition[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);

  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const accounts: Account[] = (accountsQuery.data ?? []).filter((a) => a.isActive);
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const typesQuery = useQuery({
    queryKey: queryKeys.transactionTypes(true),
    queryFn: () => getTransactionTypes({ includeInactive: true }),
  });
  const transactionTypes = typesQuery.data ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const isGroupStandard = formGroup !== "tidak_terkategori";
      const payload: SaveTransactionTypeInput = {
        code: formCode.trim(),
        name: formName.trim(),
        debitAccountId: formDebitId,
        creditAccountId: formCreditId,
        group: formGroup,
        description: formDescription.trim() || undefined,
        metadataSchema: isGroupStandard ? [] : formSchema,
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

  const groupsQuery = useQuery({
    queryKey: queryKeys.transactionGroups,
    queryFn: getTransactionGroups,
  });
  const transactionGroups: TransactionGroupDetail[] =
    groupsQuery.data && groupsQuery.data.length > 0 ? groupsQuery.data : TRANSACTION_GROUPS;
  const groupByKey = new Map(transactionGroups.map((g) => [g.key, g]));

  const [editingGroup, setEditingGroup] = useState<TransactionGroupDetail | null>(null);
  const [groupSchemaDraft, setGroupSchemaDraft] = useState<MetadataFieldDefinition[]>([]);

  const saveGroupMutation = useMutation({
    mutationFn: async () => {
      if (!editingGroup) return;
      return updateTransactionGroup(editingGroup.key, groupSchemaDraft);
    },
    onSuccess: async () => {
      toast.success(`Skema metadata grup ${editingGroup?.label} berhasil diperbarui.`);
      setEditingGroup(null);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui skema grup");
    },
  });

  const resetGroupMutation = useMutation({
    mutationFn: async (groupKey: string) => {
      return resetTransactionGroup(groupKey);
    },
    onSuccess: async () => {
      toast.success("Skema metadata grup berhasil dikembalikan ke default sistem.");
      setEditingGroup(null);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mereset skema grup");
    },
  });

  function openEditGroup(grp: TransactionGroupDetail) {
    setEditingGroup(grp);
    setGroupSchemaDraft(JSON.parse(JSON.stringify(grp.metadataSchema || [])));
  }

  function closeEditGroup() {
    setEditingGroup(null);
    setGroupSchemaDraft([]);
  }

  function openCreate(defaultGroup?: TransactionGroup) {
    setEditingType(null);
    setDuplicatingFromName(null);
    setFormCode(getNextTransactionCode(transactionTypes));
    setFormName("");
    setFormGroup(defaultGroup || "omzet");
    setFormDebitId(accounts[0]?.id || "");
    setFormCreditId(accounts[1]?.id || "");
    setFormDescription("");
    setFormSchema([]);
    setFormIsActive(true);
    setIsCreating(true);
  }

  function openEdit(item: TransactionType) {
    const debitAcc = accountById.get(item.debitAccountId);
    const creditAcc = accountById.get(item.creditAccountId);
    const grp = item.group || inferTransactionGroup(debitAcc, creditAcc);
    setEditingType(item);
    setDuplicatingFromName(null);
    setFormCode(item.code);
    setFormName(item.name);
    setFormGroup(grp);
    setFormDebitId(item.debitAccountId);
    setFormCreditId(item.creditAccountId);
    setFormDescription(item.description || "");
    setFormSchema(grp === "tidak_terkategori" ? item.metadataSchema || [] : []);
    setFormIsActive(item.isActive);
    setIsCreating(true);
  }

  function openDuplicate(item: TransactionType) {
    const debitAcc = accountById.get(item.debitAccountId);
    const creditAcc = accountById.get(item.creditAccountId);
    const grp = item.group || inferTransactionGroup(debitAcc, creditAcc);
    setEditingType(null);
    setDuplicatingFromName(item.name);
    setFormCode(getNextTransactionCode(transactionTypes));
    setFormName(`${item.name} (Salinan)`);
    setFormGroup(grp);
    setFormDebitId(item.debitAccountId);
    setFormCreditId(item.creditAccountId);
    setFormDescription(item.description || "");
    setFormSchema(
      grp === "tidak_terkategori"
        ? item.metadataSchema
          ? JSON.parse(JSON.stringify(item.metadataSchema))
          : []
        : [],
    );
    setFormIsActive(true);
    setIsCreating(true);
  }

  function closeForm() {
    setIsCreating(false);
    setEditingType(null);
    setDuplicatingFromName(null);
  }

  // Filter types by search and group
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
    <div className="space-y-3 text-xs">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-brand">
            <Layers size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Master Tipe Transaksi
            </h2>
            <p className="text-[11px] text-muted">
              Pengelompokan bisnis terstruktur & pewarisan skema metadata otomatis
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Group Filter */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as TransactionGroup | "all")}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs outline-none focus:border-brand font-medium text-slate-700 shadow-sm"
            title="Filter berdasarkan grup transaksi"
          >
            <option value="all">Semua Grup ({transactionTypes.length})</option>
            {transactionGroups.map((grp) => {
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

          {/* Search box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode atau nama..."
              className="h-8 rounded-lg border border-slate-200 bg-white pl-7 pr-2.5 py-1 text-xs outline-none focus:border-brand shadow-sm w-44 sm:w-56"
            />
          </div>

          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm transition"
          >
            <Plus size={14} /> Tambah Tipe Transaksi
          </button>
        </div>
      </div>

      {/* Loading & Empty state */}
      {typesQuery.isLoading && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-muted">
          Memuat master tipe transaksi...
        </div>
      )}

      {!typesQuery.isLoading && filteredTypes.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-muted">
          Tidak ada tipe transaksi yang cocok dengan kriteria pencarian atau filter grup.
        </div>
      )}

      {/* Visual Group Sections */}
      {!typesQuery.isLoading &&
        transactionGroups.map((grp) => {
          if (groupFilter !== "all" && grp.key !== groupFilter) {
            return null;
          }

          const itemsInGroup = filteredTypes.filter((t) => {
            const debitAcc = accountById.get(t.debitAccountId);
            const creditAcc = accountById.get(t.creditAccountId);
            const g = t.group || inferTransactionGroup(debitAcc, creditAcc);
            return g === grp.key;
          });

          // Jika ada filter search dan grup ini kosong, sembunyikan section
          if (itemsInGroup.length === 0 && search.trim() !== "") {
            return null;
          }

          const hasSharedSchema = grp.metadataSchema && grp.metadataSchema.length > 0;

          return (
            <div
              key={grp.key}
              className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Group Header Card */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold border ${grp.badgeClass}`}
                  >
                    {grp.badgeLabel}
                  </span>
                  <span className="font-bold text-slate-800 text-xs">{grp.label}</span>
                  <span className="text-[11px] text-slate-500 hidden md:inline">
                    · {grp.description}
                  </span>

                  {/* Field summary pills/chips for quick viewing */}
                  {hasSharedSchema && (
                    <div className="flex flex-wrap items-center gap-1 ml-1">
                      {grp.metadataSchema.map((f, fIdx) => (
                        <span
                          key={fIdx}
                          className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-700 font-mono border border-slate-200/80 shadow-2xs"
                          title={`Field: ${f.label} (${f.type})${f.required ? " - Wajib" : " - Opsional"}`}
                        >
                          {f.label}
                          {f.required && <span className="text-rose-500 font-bold">*</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {grp.key !== "tidak_terkategori" ? (
                    <button
                      type="button"
                      onClick={() => openEditGroup(grp)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition shadow-xs cursor-pointer ${
                        hasSharedSchema
                          ? "bg-blue-50 text-brand border-blue-200 hover:bg-blue-100/80 hover:border-blue-300"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                      title="Klik untuk melihat dan mengubah shared metadata grup ini"
                    >
                      <span>📋 Shared Metadata ({grp.metadataSchema?.length || 0})</span>
                      <Pencil size={11} className="text-blue-500" />
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Skema Bebas</span>
                  )}

                  <span
                    className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-700"
                    title={`Jumlah tipe transaksi di grup ${grp.label}`}
                  >
                    {itemsInGroup.length}
                  </span>

                  <button
                    type="button"
                    onClick={() => openCreate(grp.key)}
                    className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-semibold text-brand border border-blue-200 hover:bg-blue-50 transition shadow-xs"
                    title={`Tambah tipe transaksi baru di ${grp.label}`}
                  >
                    <Plus size={12} /> Tambah di Grup Ini
                  </button>
                </div>
              </div>

              {/* Group Transactions Table */}
              {itemsInGroup.length === 0 ? (
                <div className="px-3 py-4 text-center text-slate-400 text-xs italic">
                  Belum ada tipe transaksi di grup ini. Klik &quot;+ Tambah di Grup Ini&quot; untuk
                  membuat.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-left border-collapse text-xs">
                    <thead className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th className="px-2.5 py-1.5 w-20 border-r border-slate-200">Kode</th>
                        <th className="px-2.5 py-1.5 w-[26%] border-r border-slate-200">
                          Nama Transaksi
                        </th>
                        <th className="px-2.5 py-1.5 w-[22%] border-r border-slate-200">
                          Akun Debit (+)
                        </th>
                        <th className="px-2.5 py-1.5 w-[22%] border-r border-slate-200">
                          Akun Kredit (-)
                        </th>
                        <th className="px-2.5 py-1.5 border-r border-slate-200">Skema Metadata</th>
                        <th className="px-2 py-1.5 w-16 text-center border-r border-slate-200">
                          Status
                        </th>
                        <th className="px-2 py-1.5 w-20 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {itemsInGroup.map((item, itemIdx) => {
                        const debitAcc = accountById.get(item.debitAccountId);
                        const creditAcc = accountById.get(item.creditAccountId);
                        const localSchema = item.metadataSchema || [];

                        return (
                          <tr
                            key={item.id}
                            className={`transition ${!item.isActive ? "opacity-60 bg-slate-50/30" : itemIdx % 2 === 0 ? "bg-white hover:bg-blue-50/30" : "bg-slate-50/40 hover:bg-blue-50/30"}`}
                          >
                            <td className="px-2.5 py-1.5 font-mono font-bold text-brand tabular-nums border-r border-slate-100 whitespace-nowrap overflow-hidden text-ellipsis">
                              {item.code}
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-slate-100 min-w-0 overflow-hidden">
                              <div
                                className="font-semibold text-slate-900 truncate"
                                title={item.name}
                              >
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
                            <td className="px-2.5 py-1.5 border-r border-slate-100 min-w-0 overflow-hidden">
                              <div
                                className="inline-flex max-w-full items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-100"
                                title={debitAcc ? `${debitAcc.code} · ${debitAcc.name}` : undefined}
                              >
                                <span className="font-mono font-bold tabular-nums shrink-0">
                                  {debitAcc?.code || "—"}
                                </span>
                                <span className="text-emerald-400 shrink-0">·</span>
                                <span className="truncate">
                                  {debitAcc?.name || "Akun tidak ditemukan"}
                                </span>
                              </div>
                            </td>
                            <td className="px-2.5 py-1.5 border-r border-slate-100 min-w-0 overflow-hidden">
                              <div
                                className="inline-flex max-w-full items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-100"
                                title={
                                  creditAcc ? `${creditAcc.code} · ${creditAcc.name}` : undefined
                                }
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
                            <td className="px-2.5 py-1.5 border-r border-slate-100 min-w-0 overflow-hidden">
                              {grp.key !== "tidak_terkategori" ? (
                                hasSharedSchema ? (
                                  <button
                                    type="button"
                                    onClick={() => openEditGroup(grp)}
                                    className="inline-flex items-center gap-1 rounded bg-blue-50/80 px-1.5 py-0.5 text-[10px] text-blue-700 border border-blue-100 hover:bg-blue-100/90 transition cursor-pointer"
                                    title={`Skema seragam grup: ${grp.metadataSchema!.map((f) => f.label).join(", ")}. Klik untuk melihat atau mengubah.`}
                                  >
                                    <CheckCircle2 size={11} className="text-blue-600 shrink-0" />
                                    <span>Mewarisi Grup ({grp.metadataSchema!.length} field)</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openEditGroup(grp)}
                                    className="text-slate-400 hover:text-brand italic text-[11px] underline cursor-pointer"
                                    title="Klik untuk mengatur metadata grup ini"
                                  >
                                    Atur metadata grup
                                  </button>
                                )
                              ) : localSchema.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                                    Bebas ({localSchema.length})
                                  </span>
                                  {localSchema.slice(0, 2).map((f, idx) => (
                                    <span
                                      key={idx}
                                      className="rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-600 truncate max-w-[120px]"
                                      title={`Tipe: ${f.type}${f.required ? " (Wajib)" : ""}`}
                                    >
                                      {f.label}
                                    </span>
                                  ))}
                                  {localSchema.length > 2 && (
                                    <span className="text-[10px] text-slate-400">
                                      +{localSchema.length - 2}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">
                                  Tanpa metadata
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center border-r border-slate-100 whitespace-nowrap">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${item.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
                              >
                                {item.isActive ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
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
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

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
                      ? `Menduplikasi dari "${duplicatingFromName}". Akun dan pengaturan telah disalin.`
                      : "Tentukan grup bisnis, akun berpasangan debit/kredit, dan skema metadata"}
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
                      Grup bisnis, akun debit, akun kredit, dan susunan metadata telah disalin
                      otomatis. Sesuaikan kode, nama, atau akun debit/kredit yang berbeda sebelum
                      menyimpan.
                    </p>
                  </div>
                </div>
              )}

              {/* Group Business Selection Card */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-800">
                      Grup Bisnis Transaksi
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Menentukan pengelompokan laporan, sinkronisasi POS, dan skema metadata bawaan.
                    </p>
                  </div>
                  <select
                    value={formGroup}
                    onChange={(e) => {
                      const nextGroup = e.target.value as TransactionGroup;
                      setFormGroup(nextGroup);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-brand shadow-xs"
                  >
                    {transactionGroups.map((grp) => (
                      <option key={grp.key} value={grp.key}>
                        {grp.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Banner Shared Metadata dari Grup */}
                {(() => {
                  const grpConf = groupByKey.get(formGroup);
                  if (!grpConf) return null;
                  const hasGroupSchema =
                    grpConf.metadataSchema && grpConf.metadataSchema.length > 0;

                  return (
                    <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-2 pt-2 border-t border-blue-100/70">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 font-bold border ${grpConf.badgeClass}`}
                      >
                        {grpConf.badgeLabel}
                      </span>
                      {hasGroupSchema ? (
                        <span className="text-emerald-700 font-medium">
                          ✨ Mewarisi skema grup:{" "}
                          {grpConf.metadataSchema!.map((f) => f.label).join(", ")}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">
                          Grup ini tidak memerlukan metadata tambahan.
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Code & Name */}
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

              {/* Debit & Credit Accounts */}
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

              {/* Shared Metadata vs Custom Override Schema */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Pengaturan Skema Metadata</h4>
                    <p className="text-[11px] text-slate-500">
                      {formGroup !== "tidak_terkategori"
                        ? "Seluruh tipe transaksi dalam satu grup bisnis memiliki skema metadata yang seragam."
                        : "Grup Tidak Terkategori memiliki skema metadata bebas yang dapat dikustomisasi per tipe transaksi."}
                    </p>
                  </div>
                </div>

                {formGroup !== "tidak_terkategori" ? (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-blue-600 shrink-0" />
                      <p className="text-xs font-semibold text-blue-900">
                        Skema Seragam Grup: {groupByKey.get(formGroup)?.label}
                      </p>
                    </div>
                    <p className="text-[11px] text-blue-700 mt-1">
                      {(() => {
                        const grpConf = groupByKey.get(formGroup);
                        if (grpConf?.metadataSchema && grpConf.metadataSchema.length > 0) {
                          return `Field seragam grup: ${grpConf.metadataSchema.map((f) => `${f.label}${f.required ? " (Wajib)" : " (Opsional)"}`).join(", ")}. Field opsional dapat dikosongkan saat input transaksi.`;
                        }
                        return "Grup ini tidak memerlukan input metadata tambahan.";
                      })()}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 rounded-lg bg-indigo-50 p-2.5 text-[11px] text-indigo-800 border border-indigo-200">
                      <span className="font-semibold">Skema Bebas / Fleksibel:</span> Tipe transaksi
                      di grup Tidak Terkategori bebas menentukan field metadata sendiri atau
                      dikosongkan jika tanpa metadata.
                    </div>
                    <MetadataSchemaBuilder
                      schema={formSchema}
                      onChange={(newSchema) => setFormSchema(newSchema)}
                    />
                  </div>
                )}
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

      {/* Group Metadata Editor Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-brand">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Pengaturan Shared Metadata: {editingGroup.label}
                  </h3>
                  <p className="text-xs text-muted">
                    Skema seragam untuk seluruh tipe transaksi di bawah grup{" "}
                    {editingGroup.badgeLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditGroup}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs text-blue-900 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-brand shrink-0" />
                  <span className="font-bold">Konsep Pewarisan Skema Grup</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Semua tipe transaksi dalam grup <strong>{editingGroup.label}</strong> akan secara
                  otomatis mewarisi field yang ditentukan di sini. Perubahan akan langsung tercermin
                  saat input di Buku Transaksi / Transaksi Harian.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Daftar Field Metadata ({groupSchemaDraft.length} field)
                </label>
                <MetadataSchemaBuilder
                  schema={groupSchemaDraft}
                  onChange={(newSchema) => setGroupSchemaDraft(newSchema)}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50/50">
              <button
                type="button"
                disabled={resetGroupMutation.isPending || saveGroupMutation.isPending}
                onClick={() => {
                  if (
                    confirm(
                      `Kembalikan susunan metadata grup "${editingGroup.label}" ke standar default sistem?`,
                    )
                  ) {
                    resetGroupMutation.mutate(editingGroup.key);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 transition"
              >
                <RotateCcw size={13} /> Reset ke Default Sistem
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeEditGroup}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={saveGroupMutation.isPending || resetGroupMutation.isPending}
                  onClick={() => saveGroupMutation.mutate()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  <Save size={14} /> Simpan Perubahan Skema
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
