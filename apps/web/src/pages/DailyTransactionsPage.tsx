import { useState, useMemo, Fragment } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Check,
  Trash2,
  Calendar,
  RotateCcw,
  Tag,
  Pencil,
  Info,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Shield,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import {
  parseRupiahToSen,
  senToRupiah,
  todayIsoDate,
  type TransactionWithBalances,
  type MetadataFieldDefinition,
  type TransactionGroup,
  TRANSACTION_GROUPS,
  TRANSACTION_GROUP_LABELS,
  inferTransactionGroup,
} from "@keuangan-apotek/shared";
import {
  getAccounts,
  getTransactionTypes,
  getTransactions,
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
import { NeracaSummaryTable } from "../components/daily-transactions/NeracaSummaryTable";
import { toast } from "../lib/toast";

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

const MONTH_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatMonthYearId(yearMonth: string): string {
  const parts = yearMonth.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  if (!y || !m || m < 1 || m > 12) return yearMonth;
  return `${MONTH_NAMES_ID[m - 1]} ${y}`;
}

function getMonthRange(yearMonth: string): { startDate: string; endDate: string } {
  const parts = yearMonth.split("-").map(Number);
  const year = parts[0] ?? new Date().getFullYear();
  const month = parts[1] ?? new Date().getMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function stepMonth(yearMonth: string, offset: number): string {
  const parts = yearMonth.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? new Date().getMonth() + 1;
  const totalMonths = y * 12 + (m - 1) + offset;
  const nextYear = Math.floor(totalMonths / 12);
  const nextMonth = (totalMonths % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
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

function TransactionTypeInfoTooltip({
  debitCode,
  debitName,
  creditCode,
  creditName,
}: {
  debitCode?: string;
  debitName?: string;
  creditCode?: string;
  creditName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({
        fallbackAxisSideDirection: "start",
      }),
      shift({ padding: 8 }),
    ],
  });

  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  return (
    <>
      <span
        ref={refs.setReference}
        {...getReferenceProps()}
        className="inline-flex items-center justify-center rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-brand cursor-help transition shrink-0"
        tabIndex={0}
        aria-label="Lihat akun debit dan kredit otomatis"
      >
        <Info size={13} />
      </span>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="pointer-events-none z-[9999] min-w-[240px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-xs space-y-2"
          >
            <p className="font-bold text-[11px] text-slate-700 border-b border-slate-100 pb-1">
              Aturan Jurnal Otomatis
            </p>
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-100">
                  Debit (+)
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-800 text-right">
                  {debitCode ? `${debitCode} · ${debitName || ""}` : "—"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-100">
                  Kredit (-)
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-800 text-right">
                  {creditCode ? `${creditCode} · ${creditName || ""}` : "—"}
                </span>
              </div>
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}

function MetadataCellDisplay({
  metadata,
  schema,
  isEditing,
  isOpen,
  onOpenEditor,
}: {
  metadata: Record<string, any>;
  schema: MetadataFieldDefinition[];
  isEditing?: boolean;
  isOpen?: boolean;
  onOpenEditor: () => void;
}) {
  const entries = Object.keys(metadata || {})
    .filter((key) => {
      const val = metadata[key];
      return (
        val !== undefined && val !== null && val !== "" && (!Array.isArray(val) || val.length > 0)
      );
    })
    .map((key) => {
      const fDef = schema.find((f) => f.key === key);
      const label = fDef?.label || key;
      const rawVal = metadata[key];
      let formattedVal = "";
      if (typeof rawVal === "boolean") {
        formattedVal = rawVal ? "Ya" : "Tidak";
      } else if (Array.isArray(rawVal)) {
        formattedVal = rawVal.join(", ");
      } else if (fDef?.type === "currency" && typeof rawVal === "number") {
        formattedVal = `Rp ${formatSen(rawVal)}`;
      } else {
        formattedVal = String(rawVal);
      }
      return { key, label, val: formattedVal };
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      {/* Detail key-value tags: always visible in full detail both in view and edit mode */}
      {entries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {entries.map(({ key, label, val }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800 border border-slate-200/90 shadow-2xs"
              title={`${label}: ${val}`}
            >
              <span className="font-semibold text-slate-500">{label}:</span>
              <span className="font-semibold text-slate-900 break-all">{val}</span>
            </span>
          ))}
        </div>
      ) : !isEditing ? (
        <span className="text-slate-400 italic text-[11px]">—</span>
      ) : null}

      {/* In edit mode: compact action trigger next to the detailed tags */}
      {isEditing && (
        <div className="inline-flex items-center">
          {isOpen ? (
            <button
              type="button"
              onClick={onOpenEditor}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition"
              title="Tutup editor metadata"
            >
              <ChevronUp size={11} /> Tutup Form
            </button>
          ) : entries.length > 0 ? (
            <button
              type="button"
              onClick={onOpenEditor}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-brand border border-blue-200 hover:bg-blue-100 transition"
              title="Ubah rincian metadata"
            >
              <Pencil size={10} /> Ubah
            </button>
          ) : schema.length > 0 ? (
            <button
              type="button"
              onClick={onOpenEditor}
              className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-blue-100 transition"
              title="Isi metadata tambahan"
            >
              <Tag size={12} /> + Metadata
            </button>
          ) : (
            <span className="text-slate-400 italic text-[10px]">—</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function DailyTransactionsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const thisMonthKey = useMemo(() => todayIsoDate().slice(0, 7), []);
  const initialMonthRange = useMemo(() => getMonthRange(thisMonthKey), [thisMonthKey]);

  const [filterMode, setFilterMode] = useState<"month" | "custom" | "all">("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(thisMonthKey);
  const [startDate, setStartDate] = useState(initialMonthRange.startDate);
  const [endDate, setEndDate] = useState(initialMonthRange.endDate);

  function handleSelectMonth(monthKey: string) {
    if (!monthKey) return;
    setFilterMode("month");
    setSelectedMonth(monthKey);
    const range = getMonthRange(monthKey);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }

  function handleStepMonth(offset: number) {
    const baseMonth = selectedMonth || thisMonthKey;
    const nextMonth = stepMonth(baseMonth, offset);
    handleSelectMonth(nextMonth);
  }

  function handleCurrentMonth() {
    handleSelectMonth(thisMonthKey);
  }

  function handlePrevMonth() {
    const prevMonth = stepMonth(thisMonthKey, -1);
    handleSelectMonth(prevMonth);
  }

  function handleAllPeriod() {
    setFilterMode("all");
    setSelectedMonth("");
    setStartDate("");
    setEndDate("");
  }

  function handleCustomStartDate(val: string) {
    setStartDate(val);
    setFilterMode("custom");
  }

  function handleCustomEndDate(val: string) {
    setEndDate(val);
    setFilterMode("custom");
  }

  // Toggle Neraca table visibility
  const [showNeracaFilter, setShowNeracaFilter] = useState(false);

  // Selected Neraca accounts for filtering transactions (supports multiple, max 2)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // Selected Transaction Group filter
  const [selectedGroup, setSelectedGroup] = useState<TransactionGroup | "all">("all");

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

  // View mode for mobile vs desktop: defaults to cards on small screens (<768px), table on desktop
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "cards";
    }
    return "table";
  });

  // Mobile modal form state
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [mobileModalDraft, setMobileModalDraft] = useState<DraftRow | null>(null);

  // Queries
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const accounts: Account[] = accountsQuery.data ?? [];
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const selectedAccounts = useMemo(
    () => selectedAccountIds.map((id) => accountById.get(id)).filter(Boolean) as Account[],
    [selectedAccountIds, accountById],
  );

  function handleToggleAccount(accountId: string) {
    setSelectedAccountIds((prev) => {
      if (prev.includes(accountId)) {
        return prev.filter((id) => id !== accountId);
      }
      if (prev.length >= 2) {
        toast.info("Maksimal 2 akun filter aktif. Filter pertama diganti.");
        return [prev[1]!, accountId];
      }
      return [...prev, accountId];
    });
  }

  const typesQuery = useQuery({
    queryKey: queryKeys.transactionTypes(),
    queryFn: () => getTransactionTypes(),
  });
  const transactionTypes = typesQuery.data ?? [];
  const typeById = useMemo(
    () => new Map(transactionTypes.map((t) => [t.id, t])),
    [transactionTypes],
  );

  // Group transaction types by their inferred business group for <optgroup> dropdowns
  const groupedTransactionTypes = useMemo(() => {
    const map = new Map<TransactionGroup, typeof transactionTypes>();
    for (const group of TRANSACTION_GROUPS) {
      map.set(group.key, []);
    }
    for (const t of transactionTypes) {
      const g =
        t.group ||
        inferTransactionGroup(
          accountById.get(t.debitAccountId),
          accountById.get(t.creditAccountId),
        );
      const list = map.get(g) ?? [];
      list.push(t);
      map.set(g, list);
    }
    return map;
  }, [transactionTypes, accountById]);

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

  // Transaction counts per group for the active period (and account filter if selected)
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const g of TRANSACTION_GROUPS) {
      counts[g.key] = 0;
    }
    const baseList =
      selectedAccounts.length > 0
        ? transactionsList.filter((tx) =>
            selectedAccounts.some(
              (acc) =>
                tx.debitAccountId === acc.id ||
                tx.creditAccountId === acc.id ||
                (acc.code &&
                  (tx.debitAccountCode === acc.code || tx.creditAccountCode === acc.code)),
            ),
          )
        : transactionsList;

    counts.all = baseList.length;
    for (const tx of baseList) {
      const g =
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
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }, [transactionsList, selectedAccounts, accountById]);

  // Filtered transactions based on selected Neraca accounts (up to 2) and selected Group
  const filteredTransactionsList = useMemo(() => {
    let list = transactionsList;
    if (selectedAccounts.length > 0) {
      list = list.filter((tx) =>
        selectedAccounts.some(
          (acc) =>
            tx.debitAccountId === acc.id ||
            tx.creditAccountId === acc.id ||
            (acc.code && (tx.debitAccountCode === acc.code || tx.creditAccountCode === acc.code)),
        ),
      );
    }
    if (selectedGroup !== "all") {
      list = list.filter((tx) => {
        const g =
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
        return g === selectedGroup;
      });
    }
    return list;
  }, [transactionsList, selectedAccounts, selectedGroup, accountById]);

  // Chronological running balances and mutations for each selected account (up to 2)
  const accountRunningMaps = useMemo(() => {
    const maps = new Map<string, Map<string, { balance: number; mutation: number }>>();
    if (selectedAccounts.length === 0) return maps;

    for (const acc of selectedAccounts) {
      const targetCode = acc.code;
      const map = new Map<string, { balance: number; mutation: number }>();

      // If transactions already contain running balances for this account (e.g. cash & bank accounts)
      const hasBuiltInRunning = transactionsList.some(
        (tx) => tx.runningBalances && targetCode in tx.runningBalances,
      );

      if (hasBuiltInRunning) {
        for (const tx of transactionsList) {
          const bal = tx.runningBalances[targetCode] ?? 0;
          const mut = tx.mutations[targetCode] ?? 0;
          map.set(tx.id, { balance: bal, mutation: mut });
        }
      } else {
        const isDebitPositive =
          acc.classification === "ASET_LANCAR" ||
          acc.classification === "ASET_TETAP" ||
          acc.classification === "BEBAN" ||
          acc.normalBalance === "DEBIT";

        let currentBal = 0;
        for (const tx of transactionsList) {
          let mut = 0;
          if (tx.debitAccountId === acc.id || tx.debitAccountCode === targetCode) {
            mut += tx.amount * (isDebitPositive ? 1 : -1);
          }
          if (tx.creditAccountId === acc.id || tx.creditAccountCode === targetCode) {
            mut += tx.amount * (isDebitPositive ? -1 : 1);
          }
          currentBal += mut;
          map.set(tx.id, { balance: currentBal, mutation: mut });
        }
      }
      maps.set(acc.id, map);
    }

    return maps;
  }, [selectedAccounts, transactionsList]);

  // Total columns in table (5 base + up to 2 account balance columns + 1 action)
  const totalColumns = 6 + selectedAccounts.length;

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
      toast.success("Transaksi berhasil disimpan.");
      setDraftRows((prev) => prev.filter((r) => r.id !== draft.id));
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan transaksi");
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
      toast.success("Transaksi berhasil diperbarui.");
      setEditingRowId(null);
      setEditingRowState(null);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui transaksi");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: async () => {
      toast.success("Transaksi berhasil dihapus.");
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus transaksi");
    },
  });

  function addNewRow() {
    let defaultType = transactionTypes[0];
    if (selectedGroup !== "all") {
      const inGroup = groupedTransactionTypes.get(selectedGroup);
      if (inGroup && inGroup.length > 0) {
        defaultType = inGroup[0];
      }
    }
    const draftDate =
      filterMode === "month" && selectedMonth && selectedMonth !== thisMonthKey
        ? `${selectedMonth}-01`
        : todayIsoDate();
    const newDraft: DraftRow = {
      isNew: true,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      transactionDate: draftDate,
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

  function openMobileNewTransaction() {
    let defaultType = transactionTypes[0];
    if (selectedGroup !== "all") {
      const inGroup = groupedTransactionTypes.get(selectedGroup);
      if (inGroup && inGroup.length > 0) {
        defaultType = inGroup[0];
      }
    }
    const draftDate =
      filterMode === "month" && selectedMonth && selectedMonth !== thisMonthKey
        ? `${selectedMonth}-01`
        : todayIsoDate();
    const newDraft: DraftRow = {
      isNew: true,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      transactionDate: draftDate,
      transactionTypeId: defaultType ? defaultType.id : "",
      amount: "",
      memo: "",
      metadata: {},
    };
    setMobileModalDraft(newDraft);
    setMobileModalOpen(true);
  }

  function openMobileEditTransaction(tx: TransactionWithBalances) {
    setMobileModalDraft({
      id: tx.id,
      isNew: false,
      transactionDate: tx.transactionDate,
      transactionTypeId: tx.transactionTypeId,
      amount: senToRupiah(tx.amount).toFixed(2),
      memo: tx.memo || "",
      metadata: tx.metadata || {},
    });
    setMobileModalOpen(true);
  }

  function handleAddNew() {
    if (viewMode === "cards") {
      openMobileNewTransaction();
    } else {
      addNewRow();
    }
  }

  return (
    <div className="space-y-1.5 text-xs">
      {/* Assistant RBAC Mode Banner */}
      {user?.role === "asisten" && (
        <div className="flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-900">
          <div className="flex items-center gap-1.5">
            <Shield size={13} className="text-amber-600 shrink-0" />
            <span>
              <strong>Mode Asisten Aktif:</strong> Anda hanya dapat melihat & menginput transaksi
              dengan CoA yang diizinkan. Transaksi sensitif (seperti Gaji & Modal) disembunyikan.
            </span>
          </div>
          <span className="font-bold text-amber-800 text-[10px] bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
            RBAC Terproteksi
          </span>
        </div>
      )}

      {/* Filter and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 rounded border border-slate-200 bg-white p-1 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Filter Periode / Bulan */}
          <div className="flex flex-wrap items-center gap-1">
            {/* Monthly Stepper & Selector */}
            <div className="inline-flex items-center rounded border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => handleStepMonth(-1)}
                className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900 transition"
                title="Bulan sebelumnya"
                aria-label="Bulan sebelumnya"
              >
                <ChevronLeft size={13} />
              </button>

              <div className="flex items-center px-0.5">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSelectMonth(e.target.value);
                    }
                  }}
                  className="rounded border-0 bg-transparent px-1 py-0.5 text-xs font-semibold text-slate-800 outline-none hover:bg-white transition cursor-pointer"
                  title="Pilih bulan"
                />
              </div>

              <button
                type="button"
                onClick={() => handleStepMonth(1)}
                className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900 transition"
                title="Bulan berikutnya"
                aria-label="Bulan berikutnya"
              >
                <ChevronRight size={13} />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="inline-flex items-center rounded border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={handleCurrentMonth}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${
                  filterMode === "month" && selectedMonth === thisMonthKey
                    ? "bg-white font-semibold text-brand shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${
                  filterMode === "month" && selectedMonth === stepMonth(thisMonthKey, -1)
                    ? "bg-white font-semibold text-brand shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bulan Lalu
              </button>
              <button
                type="button"
                onClick={handleAllPeriod}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${
                  filterMode === "all"
                    ? "bg-white font-semibold text-brand shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setFilterMode(filterMode === "custom" ? "month" : "custom")}
                className={`rounded px-1.5 py-0.5 text-xs font-medium transition ${
                  filterMode === "custom"
                    ? "bg-white font-semibold text-brand shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                title="Rentang tanggal kustom"
              >
                <Calendar size={12} className="inline mr-0.5" />
                Kustom
              </button>
            </div>

            {/* Custom Range (muncul jika mode kustom aktif) */}
            {filterMode === "custom" && (
              <div className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50/50 px-1 py-0.5 text-xs text-slate-700">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleCustomStartDate(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs tabular-nums outline-none focus:border-brand"
                />
                <span className="text-slate-400 text-[10px]">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleCustomEndDate(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs tabular-nums outline-none focus:border-brand"
                />
              </div>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setShowNeracaFilter((prev) => !prev)}
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold transition ${
              showNeracaFilter
                ? "border-brand bg-blue-50 text-brand"
                : selectedAccounts.length > 0
                  ? "border-blue-300 bg-blue-50/70 text-brand"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            title="Filter akun dari Saldo Akhir Neraca (Maksimal 2 akun)"
          >
            <Filter
              size={12}
              className={
                selectedAccounts.length > 0 || showNeracaFilter ? "text-brand" : "text-slate-500"
              }
            />
            <span>
              Filter Akun {selectedAccounts.length > 0 ? `(${selectedAccounts.length}/2)` : ""}
            </span>
            {showNeracaFilter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Summary Filter Aktif */}
          {(selectedAccounts.length > 0 || startDate || endDate || selectedGroup !== "all") && (
            <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-200 pl-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Filter:
              </span>

              {/* Active Account Filter Chips */}
              {selectedAccounts.map((acc, idx) => (
                <div
                  key={acc.id}
                  className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-900"
                >
                  <span className="font-semibold text-brand">
                    Akun {selectedAccounts.length > 1 ? `#${idx + 1}` : ""}:
                  </span>
                  <span className="font-mono font-bold tabular-nums">{acc.code}</span>
                  <span className="max-w-[120px] truncate text-slate-700" title={acc.name}>
                    {acc.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleAccount(acc.id)}
                    className="ml-0.5 rounded text-blue-600 hover:text-blue-900 transition"
                    title={`Hapus filter ${acc.name}`}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}

              {/* Active Date Filter Chip */}
              {(startDate || endDate) && (
                <div className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-700">
                  <span className="font-semibold text-slate-500">Periode:</span>
                  <span className="tabular-nums font-medium">
                    {filterMode === "month" && selectedMonth
                      ? formatMonthYearId(selectedMonth)
                      : `${startDate || "Awal"} s/d ${endDate || "Kini"}`}
                  </span>
                  <button
                    type="button"
                    onClick={handleAllPeriod}
                    className="ml-0.5 rounded text-slate-500 hover:text-slate-800 transition"
                    title="Hapus filter tanggal"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {/* Active Group Filter Chip */}
              {selectedGroup !== "all" && (
                <div className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-700">
                  <span className="font-semibold text-slate-500">Grup:</span>
                  <span className="font-semibold">{TRANSACTION_GROUP_LABELS[selectedGroup]}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedGroup("all")}
                    className="ml-0.5 rounded text-slate-500 hover:text-slate-800 transition"
                    title="Hapus filter grup"
                  >
                    <X size={11} />
                  </button>
                </div>
              )}

              {/* Matching Transactions Count Badge */}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 tabular-nums">
                {filteredTransactionsList.length} baris
              </span>

              {/* Reset All Filters if multiple are active */}
              {(selectedAccounts.length > 0 ||
                Boolean(startDate || endDate) ||
                selectedGroup !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAccountIds([]);
                    setSelectedGroup("all");
                    handleAllPeriod();
                  }}
                  className="text-[10px] font-semibold text-slate-400 hover:text-red-600 transition underline"
                  title="Reset semua filter"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center rounded border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition ${
                viewMode === "cards"
                  ? "bg-white text-brand shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Tampilan Kartu (Ramah Mobile)"
            >
              Kartu
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition ${
                viewMode === "table"
                  ? "bg-white text-brand shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Tampilan Tabel Spreadsheet"
            >
              Tabel
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddNew}
            className="inline-flex items-center gap-1 rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition shrink-0"
          >
            <Plus size={13} /> Baris Baru
          </button>
        </div>
      </div>

      {/* Transaction Group Filter Pills */}
      <div className="flex items-center gap-1 overflow-x-auto max-w-full rounded border border-slate-200 bg-white p-1 text-xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-0.5 ml-1 shrink-0">
          Grup:
        </span>
        <button
          type="button"
          onClick={() => setSelectedGroup("all")}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition shrink-0 ${
            selectedGroup === "all"
              ? "bg-slate-800 text-white font-semibold shadow-2xs"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          <span>Semua</span>
          <span
            className={`rounded-full px-1.5 py-0 text-[10px] tabular-nums ${
              selectedGroup === "all" ? "bg-slate-700 text-white" : "bg-white text-slate-600"
            }`}
          >
            {groupCounts.all ?? 0}
          </span>
        </button>
        {TRANSACTION_GROUPS.map((grp) => {
          const isSelected = selectedGroup === grp.key;
          const count = groupCounts[grp.key] ?? 0;
          return (
            <button
              key={grp.key}
              type="button"
              onClick={() => setSelectedGroup(grp.key)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition shrink-0 ${
                isSelected
                  ? `${grp.badgeClass} font-bold shadow-2xs ring-1 ring-current`
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              title={grp.description}
            >
              <span>{grp.label}</span>
              <span
                className={`rounded-full px-1.5 py-0 text-[10px] tabular-nums ${
                  isSelected
                    ? "bg-white/90 text-slate-900 font-bold"
                    : count > 0
                      ? "bg-slate-100 text-slate-700 font-semibold"
                      : "text-slate-400"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Saldo Akhir Neraca Table (only appears when filter button is clicked) */}
      {showNeracaFilter && (
        <div className="transition-all animate-in fade-in duration-150">
          <NeracaSummaryTable
            asOfDate={endDate || todayIsoDate()}
            selectedAccountIds={selectedAccountIds}
            onToggleAccount={handleToggleAccount}
            onClearAccounts={() => setSelectedAccountIds([])}
            onClose={() => setShowNeracaFilter(false)}
          />
        </div>
      )}

      {/* Mobile Card View */}
      {viewMode === "cards" && (
        <div className="space-y-2">
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
                      disabled={createMutation.isPending || !draft.transactionTypeId}
                      onClick={() => createMutation.mutate(draft)}
                      className="rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftRows((prev) => prev.filter((r) => r.id !== draft.id))}
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

          {transactionsQuery.isLoading ? (
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
                    onClick={() => setSelectedAccountIds([])}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Hapus Filter Akun
                  </button>
                )}
                <button
                  type="button"
                  onClick={openMobileNewTransaction}
                  className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                >
                  <Plus size={13} /> Tambah Transaksi
                </button>
              </div>
            </div>
          ) : (
            filteredTransactionsList.map((tx) => {
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
                  className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs space-y-2 transition hover:border-slate-300"
                >
                  {/* Card Top: Date, PIC, and Group Badge */}
                  <div className="flex items-center justify-between gap-1.5 border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-slate-800 text-xs tabular-nums">
                        {tx.transactionDate}
                      </span>
                      {tx.memo && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-mono font-semibold text-slate-700">
                          {tx.memo}
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
                                <span
                                  className={mutation > 0 ? "text-emerald-600" : "text-red-500"}
                                >
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
                      onClick={() => openMobileEditTransaction(tx)}
                      className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      <Pencil size={11} className="text-slate-500" />
                      <span>Ubah</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Hapus transaksi ini? Jurnal terkait juga akan dihapus.")) {
                          deleteMutation.mutate(tx.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition"
                    >
                      <Trash2 size={11} className="text-rose-500" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Spreadsheet Table (Desktop view default, or toggled) */}
      {viewMode === "table" && (
        <div className="rounded border border-slate-200 bg-white">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700">
                <tr>
                  <th className="px-2 py-1 w-28 border-r border-slate-200">Tanggal</th>
                  <th className="px-2 py-1 min-w-[200px] border-r border-slate-200">
                    Tipe Transaksi
                  </th>
                  <th className="px-2 py-1 w-32 text-right border-r border-slate-200">
                    Nominal (Rp)
                  </th>
                  <th className="px-2 py-1 w-16 text-center border-r border-slate-200">PIC</th>
                  <th className="px-2 py-1 min-w-[160px] border-r border-slate-200">Metadata</th>

                  {/* Saldo Kas Column(s): visible for each active filter account (max 2) */}
                  {selectedAccounts.map((acc, idx) => (
                    <th
                      key={acc.id}
                      className="px-2 py-1 min-w-[130px] text-right border-r border-slate-200 bg-blue-100/70 font-mono text-slate-800"
                      title={`Saldo ${acc.code} · ${acc.name}`}
                    >
                      <div className="text-[10px] font-bold text-brand uppercase tracking-wider font-sans leading-none">
                        Saldo Kas {selectedAccounts.length > 1 ? `(#${idx + 1})` : ""}
                      </div>
                      <div className="truncate font-semibold text-[11px]">
                        {acc.code} · {acc.name}
                      </div>
                    </th>
                  ))}

                  <th className="px-2 py-1 w-16 text-center sticky right-0 bg-slate-100">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* Draft Rows being newly added */}
                {draftRows.map((draft) => {
                  const selectedType = typeById.get(draft.transactionTypeId);
                  const debitAcc = selectedType
                    ? accountById.get(selectedType.debitAccountId)
                    : null;
                  const creditAcc = selectedType
                    ? accountById.get(selectedType.creditAccountId)
                    : null;
                  const schema = selectedType?.metadataSchema || [];
                  const isMetadataOpen =
                    activeMetadataRowIndex?.isDraft &&
                    activeMetadataRowIndex.idOrIndex === draft.id;

                  return (
                    <Fragment key={draft.id}>
                      <tr
                        className={`border-b transition ${
                          isMetadataOpen
                            ? "bg-blue-100/70 border-blue-200"
                            : "bg-blue-50/50 border-blue-100"
                        }`}
                      >
                        {/* Date */}
                        <td className="px-2 py-1 border-r border-slate-200">
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
                            className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand"
                          />
                        </td>

                        {/* Transaction Type with Group badge & (i) Tooltip */}
                        <td className="px-2 py-1 border-r border-slate-200">
                          <div className="flex items-center gap-1 min-w-0">
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
                              className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand font-medium truncate"
                            >
                              {TRANSACTION_GROUPS.map((grp) => {
                                const typesInGroup = groupedTransactionTypes.get(grp.key) || [];
                                if (typesInGroup.length === 0) return null;
                                return (
                                  <optgroup key={grp.key} label={grp.label}>
                                    {typesInGroup.map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.code} · {t.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                );
                              })}
                            </select>
                            <TransactionTypeInfoTooltip
                              debitCode={debitAcc?.code}
                              debitName={debitAcc?.name}
                              creditCode={creditAcc?.code}
                              creditName={creditAcc?.name}
                            />
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-2 py-1 border-r border-slate-200">
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
                            className="w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-right font-mono text-xs tabular-nums outline-none focus:border-brand"
                          />
                        </td>

                        {/* PIC */}
                        <td className="px-2 py-1 border-r border-slate-200">
                          <input
                            type="text"
                            placeholder="PIC"
                            maxLength={10}
                            value={draft.memo}
                            onChange={(e) =>
                              setDraftRows((prev) =>
                                prev.map((r) =>
                                  r.id === draft.id ? { ...r, memo: e.target.value } : r,
                                ),
                              )
                            }
                            className="w-full h-6 text-center uppercase font-mono rounded border border-slate-200 bg-white px-1 py-0.5 text-xs outline-none focus:border-brand"
                          />
                        </td>

                        {/* Metadata Cell with Clean Content Display */}
                        <td className="px-2 py-1 border-r border-slate-200">
                          <MetadataCellDisplay
                            metadata={draft.metadata}
                            schema={schema}
                            isEditing={true}
                            isOpen={isMetadataOpen}
                            onOpenEditor={() =>
                              setActiveMetadataRowIndex(
                                isMetadataOpen ? null : { isDraft: true, idOrIndex: draft.id },
                              )
                            }
                          />
                        </td>

                        {/* Saldo Kas Draft Cell(s): visible for each active filter account */}
                        {selectedAccounts.map((acc) => (
                          <td
                            key={acc.id}
                            className="px-2 py-1 text-right border-r border-slate-200 bg-slate-50/40 text-slate-400 font-mono text-xs tabular-nums"
                          >
                            —
                          </td>
                        ))}

                        {/* Actions */}
                        <td className="px-2 py-1 text-center sticky right-0 bg-blue-50/95">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              disabled={createMutation.isPending || !draft.transactionTypeId}
                              onClick={() => createMutation.mutate(draft)}
                              className="rounded bg-brand p-1 text-white hover:bg-blue-700 disabled:opacity-50 transition"
                              title="Simpan baris transaksi"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDraftRows((prev) => prev.filter((r) => r.id !== draft.id))
                              }
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                              title="Batal"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Inline Sub-row for Draft Metadata */}
                      {isMetadataOpen && (
                        <tr
                          key={`${draft.id}-metadata`}
                          className="bg-blue-50/50 border-b border-blue-200"
                        >
                          <td
                            colSpan={totalColumns}
                            className="px-2 py-1 bg-blue-50/30 border-b border-blue-100"
                          >
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
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}

                {/* Transactions List */}
                {transactionsQuery.isLoading ? (
                  <tr>
                    <td colSpan={totalColumns} className="px-2 py-6 text-center text-muted">
                      Memuat transaksi...
                    </td>
                  </tr>
                ) : filteredTransactionsList.length === 0 && draftRows.length === 0 ? (
                  <tr>
                    <td colSpan={totalColumns} className="px-2 py-6 text-center text-muted">
                      {selectedAccounts.length > 0 ? (
                        <div className="space-y-1">
                          <p>
                            Tidak ada transaksi yang terkait dengan akun{" "}
                            <strong>
                              {selectedAccounts.map((a) => `${a.code} · ${a.name}`).join(" atau ")}
                            </strong>{" "}
                            pada periode ini.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSelectedAccountIds([])}
                            className="text-xs font-semibold text-brand underline"
                          >
                            Tampilkan semua transaksi
                          </button>
                        </div>
                      ) : (
                        <>
                          Belum ada transaksi. Klik <strong>+ Baris Baru</strong> untuk menambah
                          transaksi pertama Anda.
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredTransactionsList.map((tx, txIdx) => {
                    const isEditing = editingRowId === tx.id;
                    const currentDraft = isEditing ? editingRowState! : null;

                    const selectedType = typeById.get(
                      isEditing ? currentDraft!.transactionTypeId : tx.transactionTypeId,
                    );
                    const schema = selectedType?.metadataSchema || [];

                    const isMetadataOpen =
                      !activeMetadataRowIndex?.isDraft &&
                      activeMetadataRowIndex?.idOrIndex === tx.id;

                    const editingDebitAcc = selectedType
                      ? accountById.get(selectedType.debitAccountId)
                      : null;
                    const editingCreditAcc = selectedType
                      ? accountById.get(selectedType.creditAccountId)
                      : null;

                    return (
                      <Fragment key={tx.id}>
                        <tr
                          className={`transition ${
                            isEditing
                              ? "bg-amber-100/70"
                              : txIdx % 2 === 0
                                ? "bg-white hover:bg-blue-50/40"
                                : "bg-slate-50/70 hover:bg-blue-50/40"
                          }`}
                        >
                          {/* Tanggal */}
                          <td className="px-2 py-1 border-r border-slate-200 tabular-nums">
                            {isEditing ? (
                              <input
                                type="date"
                                value={currentDraft!.transactionDate}
                                onChange={(e) =>
                                  setEditingRowState((prev) =>
                                    prev ? { ...prev, transactionDate: e.target.value } : null,
                                  )
                                }
                                className="w-full h-6 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand"
                              />
                            ) : (
                              tx.transactionDate
                            )}
                          </td>

                          {/* Tipe Transaksi with Group badge & (i) Tooltip */}
                          <td className="px-2 py-1 border-r border-slate-200">
                            {isEditing ? (
                              <div className="flex items-center gap-1 min-w-0">
                                <select
                                  value={currentDraft!.transactionTypeId}
                                  onChange={(e) => {
                                    const newTypeId = e.target.value;
                                    setEditingRowState((prev) =>
                                      prev ? { ...prev, transactionTypeId: newTypeId } : null,
                                    );
                                  }}
                                  className="w-full h-6 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand font-medium truncate"
                                >
                                  {TRANSACTION_GROUPS.map((grp) => {
                                    const typesInGroup = groupedTransactionTypes.get(grp.key) || [];
                                    if (typesInGroup.length === 0) return null;
                                    return (
                                      <optgroup key={grp.key} label={grp.label}>
                                        {typesInGroup.map((t) => (
                                          <option key={t.id} value={t.id}>
                                            {t.code} · {t.name}
                                          </option>
                                        ))}
                                      </optgroup>
                                    );
                                  })}
                                </select>
                                <TransactionTypeInfoTooltip
                                  debitCode={editingDebitAcc?.code}
                                  debitName={editingDebitAcc?.name}
                                  creditCode={editingCreditAcc?.code}
                                  creditName={editingCreditAcc?.name}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-1.5 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 truncate">
                                  {(() => {
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
                                    return gConf ? (
                                      <span
                                        className={`shrink-0 inline-flex items-center rounded px-1.5 py-0 text-[10px] font-semibold border ${gConf.badgeClass}`}
                                      >
                                        {gConf.badgeLabel}
                                      </span>
                                    ) : null;
                                  })()}
                                  <span
                                    className="font-semibold text-slate-900 truncate"
                                    title={tx.transactionTypeName || "Tipe Transaksi"}
                                  >
                                    {tx.transactionTypeName || "Tipe Transaksi"}
                                  </span>
                                </div>
                                <TransactionTypeInfoTooltip
                                  debitCode={tx.debitAccountCode}
                                  debitName={tx.debitAccountName}
                                  creditCode={tx.creditAccountCode}
                                  creditName={tx.creditAccountName}
                                />
                              </div>
                            )}
                          </td>

                          {/* Nominal */}
                          <td className="px-2 py-1 text-right font-mono tabular-nums border-r border-slate-200">
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
                                className="w-full h-6 rounded border border-slate-200 px-1.5 py-0.5 text-right font-mono text-xs tabular-nums outline-none focus:border-brand"
                              />
                            ) : (
                              <span className="font-semibold text-slate-900">
                                Rp {formatSen(tx.amount)}
                              </span>
                            )}
                          </td>

                          {/* PIC */}
                          <td className="px-2 py-1 border-r border-slate-200 text-center">
                            {isEditing ? (
                              <input
                                type="text"
                                placeholder="PIC"
                                maxLength={10}
                                value={currentDraft!.memo}
                                onChange={(e) =>
                                  setEditingRowState((prev) =>
                                    prev ? { ...prev, memo: e.target.value } : null,
                                  )
                                }
                                className="w-full h-6 text-center uppercase font-mono rounded border border-slate-200 px-1 py-0.5 text-xs outline-none focus:border-brand"
                              />
                            ) : (
                              <span className="font-mono text-xs font-semibold text-slate-700">
                                {tx.memo || "—"}
                              </span>
                            )}
                          </td>

                          {/* Metadata Clean Content Display */}
                          <td className="px-2 py-1 border-r border-slate-200">
                            <MetadataCellDisplay
                              metadata={isEditing ? currentDraft!.metadata : tx.metadata}
                              schema={schema}
                              isEditing={isEditing}
                              onOpenEditor={() =>
                                setActiveMetadataRowIndex(
                                  isMetadataOpen ? null : { isDraft: false, idOrIndex: tx.id },
                                )
                              }
                            />
                          </td>

                          {/* Saldo Kas Cell(s): visible for each active filter account (max 2) */}
                          {selectedAccounts.map((acc) => {
                            const item = accountRunningMaps.get(acc.id)?.get(tx.id);
                            const balance = item?.balance ?? 0;
                            const mutation = item?.mutation ?? 0;
                            return (
                              <td
                                key={acc.id}
                                className="px-2 py-1 text-right border-r border-slate-200 font-mono text-xs tabular-nums bg-blue-50/20"
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
                          <td className="px-2 py-1 text-center sticky right-0 bg-white/95">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateMutation.mutate({ id: tx.id, draft: currentDraft! })
                                  }
                                  className="rounded bg-brand p-1 text-white hover:bg-blue-700 transition"
                                  title="Simpan perubahan"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditExisting}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 transition"
                                  title="Batal"
                                >
                                  <RotateCcw size={12} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEditExisting(tx)}
                                  className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-brand transition"
                                  title="Edit transaksi"
                                >
                                  <Pencil size={12} />
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
                                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                                  title="Hapus transaksi"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Expandable Inline Sub-row for Existing Transaction Metadata */}
                        {isEditing && isMetadataOpen && (
                          <tr
                            key={`${tx.id}-metadata`}
                            className="bg-amber-50/40 border-b border-amber-200"
                          >
                            <td
                              colSpan={totalColumns}
                              className="px-2 py-1 bg-amber-50/20 border-b border-amber-100"
                            >
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
                              />
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
      )}

      {/* Mobile Transaction Form Modal */}
      {mobileModalOpen && mobileModalDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-2xl space-y-3.5 my-auto max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">
                {mobileModalDraft.isNew ? "Tambah Transaksi Baru" : "Ubah Transaksi"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setMobileModalOpen(false);
                  setMobileModalDraft(null);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label="Tutup form"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form Inputs */}
            <div className="space-y-3 text-xs">
              {/* Tanggal */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Tanggal Transaksi</label>
                  <button
                    type="button"
                    onClick={() =>
                      setMobileModalDraft((prev) =>
                        prev ? { ...prev, transactionDate: todayIsoDate() } : null,
                      )
                    }
                    className="text-[11px] font-semibold text-brand hover:underline"
                  >
                    Hari Ini
                  </button>
                </div>
                <input
                  type="date"
                  value={mobileModalDraft.transactionDate}
                  onChange={(e) =>
                    setMobileModalDraft((prev) =>
                      prev ? { ...prev, transactionDate: e.target.value } : null,
                    )
                  }
                  className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 text-xs outline-none focus:border-brand"
                />
              </div>

              {/* Tipe Transaksi */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipe Transaksi</label>
                <select
                  value={mobileModalDraft.transactionTypeId}
                  onChange={(e) => {
                    const newTypeId = e.target.value;
                    setMobileModalDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            transactionTypeId: newTypeId,
                            metadata: prev.isNew ? {} : prev.metadata,
                          }
                        : null,
                    );
                  }}
                  className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs outline-none focus:border-brand font-medium truncate"
                >
                  {TRANSACTION_GROUPS.map((grp) => {
                    const typesInGroup = groupedTransactionTypes.get(grp.key) || [];
                    if (typesInGroup.length === 0) return null;
                    return (
                      <optgroup key={grp.key} label={grp.label}>
                        {typesInGroup.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.code} · {t.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>

                {/* Automatic debit/credit preview */}
                {(() => {
                  const curType = typeById.get(mobileModalDraft.transactionTypeId);
                  const debAcc = curType ? accountById.get(curType.debitAccountId) : null;
                  const credAcc = curType ? accountById.get(curType.creditAccountId) : null;
                  if (!curType) return null;
                  return (
                    <div className="mt-1 flex items-center justify-between rounded bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600">
                      <span className="truncate">
                        <span className="font-bold text-emerald-700">D:</span>{" "}
                        {debAcc ? `${debAcc.code} · ${debAcc.name}` : "—"}
                      </span>
                      <span className="truncate ml-2 text-right">
                        <span className="font-bold text-amber-700">K:</span>{" "}
                        {credAcc ? `${credAcc.code} · ${credAcc.name}` : "—"}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Nominal */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nominal (Rp)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-400 select-none">
                    Rp
                  </span>
                  <input
                    type="text"
                    placeholder="0,00"
                    value={mobileModalDraft.amount}
                    onBlur={(e) => {
                      const formatted = formatAmountInput(e.target.value);
                      setMobileModalDraft((prev) => (prev ? { ...prev, amount: formatted } : null));
                    }}
                    onChange={(e) =>
                      setMobileModalDraft((prev) =>
                        prev ? { ...prev, amount: e.target.value } : null,
                      )
                    }
                    className="w-full h-8 pl-8 pr-2.5 rounded border border-slate-300 bg-white font-mono text-xs tabular-nums outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* PIC */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">PIC / Memo</label>
                <input
                  type="text"
                  placeholder="Contoh: ADM, KSR, GUD"
                  maxLength={10}
                  value={mobileModalDraft.memo}
                  onChange={(e) =>
                    setMobileModalDraft((prev) =>
                      prev ? { ...prev, memo: e.target.value.toUpperCase() } : null,
                    )
                  }
                  className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 font-mono uppercase text-xs outline-none focus:border-brand"
                />
              </div>

              {/* Metadata Section if schema exists */}
              {(() => {
                const curType = typeById.get(mobileModalDraft.transactionTypeId);
                const schema = curType?.metadataSchema || [];
                if (schema.length === 0) return null;
                return (
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      Metadata Tambahan ({schema.length} atribut)
                    </label>
                    <DynamicMetadataForm
                      schema={schema}
                      initialValues={mobileModalDraft.metadata}
                      layout="vertical"
                      onSave={(newMeta) => {
                        setMobileModalDraft((prev) =>
                          prev ? { ...prev, metadata: newMeta } : null,
                        );
                        toast.success("Metadata diperbarui.");
                      }}
                    />
                  </div>
                );
              })()}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMobileModalOpen(false);
                  setMobileModalDraft(null);
                }}
                className="h-8 px-3.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !mobileModalDraft.transactionTypeId
                }
                onClick={async () => {
                  if (!mobileModalDraft.transactionTypeId) return;
                  if (mobileModalDraft.isNew) {
                    await createMutation.mutateAsync(mobileModalDraft);
                  } else {
                    await updateMutation.mutateAsync({
                      id: mobileModalDraft.id,
                      draft: mobileModalDraft,
                    });
                  }
                  setMobileModalOpen(false);
                  setMobileModalDraft(null);
                }}
                className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded bg-brand text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Check size={13} />
                <span>{mobileModalDraft.isNew ? "Simpan Transaksi" : "Simpan Perubahan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
