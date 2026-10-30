import { useState } from "react";
import { createPortal } from "react-dom";
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
  ArrowUp,
  ArrowDown,
  Settings2,
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
  createTransactionGroup,
  createTransactionType,
  deleteTransactionGroup,
  deleteTransactionType,
  invalidateAccountingQueries,
  reorderTransactionGroups,
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

  // State for Group Manager Modal
  const [showGroupManagerModal, setShowGroupManagerModal] = useState(false);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupKey, setNewGroupKey] = useState("");
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newGroupBadge, setNewGroupBadge] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupClass, setNewGroupClass] = useState(
    "bg-purple-50 text-purple-800 border-purple-200",
  );

  // State for Editing Group Identity
  const [groupToEdit, setGroupToEdit] = useState<TransactionGroupDetail | null>(null);
  const [editGroupLabel, setEditGroupLabel] = useState("");
  const [editGroupBadge, setEditGroupBadge] = useState("");
  const [editGroupDesc, setEditGroupDesc] = useState("");
  const [editGroupClass, setEditGroupClass] = useState("");

  const saveGroupMutation = useMutation({
    mutationFn: async () => {
      if (!editingGroup) return;
      return updateTransactionGroup(editingGroup.key, { metadataSchema: groupSchemaDraft });
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

  const createGroupMutation = useMutation({
    mutationFn: async (data: {
      key: string;
      label: string;
      badgeLabel: string;
      description: string;
      badgeClass: string;
    }) => createTransactionGroup(data),
    onSuccess: async () => {
      toast.success("Grup transaksi baru berhasil dibuat.");
      setShowAddGroupModal(false);
      setNewGroupKey("");
      setNewGroupLabel("");
      setNewGroupBadge("");
      setNewGroupDesc("");
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal membuat grup transaksi");
    },
  });

  const updateGroupInfoMutation = useMutation({
    mutationFn: async (data: {
      key: string;
      label: string;
      badgeLabel: string;
      description: string;
      badgeClass: string;
    }) =>
      updateTransactionGroup(data.key, {
        label: data.label,
        badgeLabel: data.badgeLabel,
        description: data.description,
        badgeClass: data.badgeClass,
      }),
    onSuccess: async () => {
      toast.success("Informasi grup transaksi berhasil diperbarui.");
      setGroupToEdit(null);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui grup transaksi");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: async (groupKey: string) => deleteTransactionGroup(groupKey),
    onSuccess: async (res) => {
      toast.success(
        `Grup berhasil dihapus. ${res.affectedTypesCount} tipe transaksi dialihkan ke "Tidak Terkategori".`,
      );
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus grup transaksi");
    },
  });

  const reorderGroupsMutation = useMutation({
    mutationFn: async (keys: string[]) => reorderTransactionGroups(keys),
    onSuccess: async () => {
      toast.success("Urutan grup transaksi berhasil diperbarui.");
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah urutan grup");
    },
  });

  function moveGroup(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= transactionGroups.length) return;
    const nextList = [...transactionGroups];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIndex, 0, moved!);
    const keys = nextList.map((g) => g.key);
    reorderGroupsMutation.mutate(keys);
  }

  function openEditGroupInfo(grp: TransactionGroupDetail) {
    setGroupToEdit(grp);
    setEditGroupLabel(grp.label);
    setEditGroupBadge(grp.badgeLabel || grp.label);
    setEditGroupDesc(grp.description || "");
    setEditGroupClass(grp.badgeClass || "bg-purple-50 text-purple-800 border-purple-200");
  }

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
            onClick={() => setShowGroupManagerModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
            title="Kelola daftar grup, urutan, dan grup kustom"
          >
            <Settings2 size={13} className="text-slate-500" />
            <span>Kelola Grup</span>
          </button>

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
                                    <span>{grp.metadataSchema!.length} field</span>
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
      {/* Modal Kelola Seluruh Grup Transaksi */}
      {showGroupManagerModal &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-blue-100 text-brand">
                    <Settings2 size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Kelola Grup Transaksi</h3>
                    <p className="text-[11px] text-slate-500">
                      Atur urutan tampilan, edit informasi grup, atau buat grup kustom baru
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGroupManagerModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-600">
                    Daftar Grup ({transactionGroups.length} grup)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddGroupModal(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
                  >
                    <Plus size={13} /> Tambah Grup Kustom
                  </button>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  {transactionGroups.map((grp, idx) => {
                    const isSystem = grp.isSystem;
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
                      <div
                        key={grp.key}
                        className="flex items-center justify-between gap-3 p-3 hover:bg-slate-50/70 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Reorder Buttons */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={idx === 0 || reorderGroupsMutation.isPending}
                              onClick={() => moveGroup(idx, "up")}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
                              title="Pindahkan ke atas"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={
                                idx === transactionGroups.length - 1 ||
                                reorderGroupsMutation.isPending
                              }
                              onClick={() => moveGroup(idx, "down")}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
                              title="Pindahkan ke bawah"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${grp.badgeClass}`}
                              >
                                {grp.badgeLabel || grp.label}
                              </span>
                              <span className="font-bold text-slate-800 text-xs truncate">
                                {grp.label}
                              </span>
                              {isSystem ? (
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-semibold text-slate-500">
                                  Sistem
                                </span>
                              ) : (
                                <span className="rounded bg-purple-100 px-1.5 py-0.2 text-[9px] font-semibold text-purple-700">
                                  Kustom
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {grp.description || "Tidak ada deskripsi"} · {count} tipe transaksi
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditGroupInfo(grp)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:text-brand text-slate-600 transition"
                            title="Edit identitas & warna grup"
                          >
                            <Pencil size={13} />
                          </button>
                          {!isSystem && (
                            <button
                              type="button"
                              disabled={deleteGroupMutation.isPending}
                              onClick={() => {
                                if (
                                  confirm(
                                    `Hapus grup "${grp.label}"? Seluruh tipe transaksi di dalamnya akan otomatis dialihkan ke "Tidak Terkategori".`,
                                  )
                                ) {
                                  deleteGroupMutation.mutate(grp.key);
                                }
                              }}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition"
                              title="Hapus grup kustom ini"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-100 px-5 py-3 bg-slate-50/50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGroupManagerModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition shadow-xs"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal Tambah Grup Kustom */}
      {showAddGroupModal &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="text-sm font-bold text-slate-900">Tambah Grup Transaksi Baru</h4>
                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Kunci Slug (ID Grup) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupKey}
                    onChange={(e) =>
                      setNewGroupKey(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]/g, "_")
                          .replace(/_+/g, "_"),
                      )
                    }
                    placeholder="misal: promo_event"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-brand"
                  />
                  <span className="text-[10px] text-slate-400">
                    Hanya huruf kecil, angka, dan garis bawah.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Nama / Label Grup <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupLabel}
                    onChange={(e) => {
                      setNewGroupLabel(e.target.value);
                      if (!newGroupBadge) setNewGroupBadge(e.target.value);
                    }}
                    placeholder="misal: Promosi & Event"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Label Singkat Badge
                  </label>
                  <input
                    type="text"
                    value={newGroupBadge}
                    onChange={(e) => setNewGroupBadge(e.target.value)}
                    placeholder="misal: Promo"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Deskripsi Grup
                  </label>
                  <textarea
                    rows={2}
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Penjelasan tujuan grup transaksi ini..."
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Pilihan Warna Badge
                  </label>
                  <select
                    value={newGroupClass}
                    onChange={(e) => setNewGroupClass(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand bg-white"
                  >
                    <option value="bg-purple-50 text-purple-800 border-purple-200">
                      Ungu / Purple
                    </option>
                    <option value="bg-indigo-50 text-indigo-800 border-indigo-200">
                      Indigo / Nila
                    </option>
                    <option value="bg-cyan-50 text-cyan-800 border-cyan-200">
                      Cyan / Biru Laut
                    </option>
                    <option value="bg-emerald-50 text-emerald-800 border-emerald-200">
                      Hijau / Emerald
                    </option>
                    <option value="bg-amber-50 text-amber-800 border-amber-200">
                      Kuning / Amber
                    </option>
                    <option value="bg-rose-50 text-rose-800 border-rose-200">Merah / Rose</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddGroupModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={
                    !newGroupKey.trim() || !newGroupLabel.trim() || createGroupMutation.isPending
                  }
                  onClick={() =>
                    createGroupMutation.mutate({
                      key: newGroupKey.trim(),
                      label: newGroupLabel.trim(),
                      badgeLabel: newGroupBadge.trim() || newGroupLabel.trim(),
                      description: newGroupDesc.trim(),
                      badgeClass: newGroupClass,
                    })
                  }
                  className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {createGroupMutation.isPending ? "Menyimpan..." : "Buat Grup"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal Edit Informasi Grup */}
      {groupToEdit &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="text-sm font-bold text-slate-900">
                  Ubah Identitas Grup: {groupToEdit.label}
                </h4>
                <button
                  type="button"
                  onClick={() => setGroupToEdit(null)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Label Nama Grup <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editGroupLabel}
                    onChange={(e) => setEditGroupLabel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Label Singkat Badge
                  </label>
                  <input
                    type="text"
                    value={editGroupBadge}
                    onChange={(e) => setEditGroupBadge(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    rows={2}
                    value={editGroupDesc}
                    onChange={(e) => setEditGroupDesc(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Pilihan Warna Badge
                  </label>
                  <select
                    value={editGroupClass}
                    onChange={(e) => setEditGroupClass(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand bg-white"
                  >
                    <option value="bg-emerald-50 text-emerald-800 border-emerald-200">
                      Hijau / Emerald
                    </option>
                    <option value="bg-rose-50 text-rose-800 border-rose-200">Merah / Rose</option>
                    <option value="bg-sky-50 text-sky-800 border-sky-200">Biru / Sky</option>
                    <option value="bg-amber-50 text-amber-800 border-amber-200">
                      Kuning / Amber
                    </option>
                    <option value="bg-purple-50 text-purple-800 border-purple-200">
                      Ungu / Purple
                    </option>
                    <option value="bg-teal-50 text-teal-800 border-teal-200">Toska / Teal</option>
                    <option value="bg-slate-100 text-slate-700 border-slate-200">
                      Abu-abu / Slate
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGroupToEdit(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!editGroupLabel.trim() || updateGroupInfoMutation.isPending}
                  onClick={() =>
                    updateGroupInfoMutation.mutate({
                      key: groupToEdit.key,
                      label: editGroupLabel.trim(),
                      badgeLabel: editGroupBadge.trim() || editGroupLabel.trim(),
                      description: editGroupDesc.trim(),
                      badgeClass: editGroupClass,
                    })
                  }
                  className="rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateGroupInfoMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
