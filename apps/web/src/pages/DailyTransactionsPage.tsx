import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type TransactionGroup,
  TRANSACTION_GROUPS,
  type TransactionWithBalances,
  inferTransactionGroup,
  parseRupiahToSen,
  senToRupiah,
  todayIsoDate,
} from "@keuangan-apotek/shared";
import { Shield } from "lucide-react";
import { BulkActionBar } from "../components/daily-transactions/BulkActionBar";
import {
  BulkDateModal,
  BulkDeleteModal,
  BulkPicModal,
  BulkTypeModal,
} from "../components/daily-transactions/BulkActionModals";
import type {
  ActiveMetadataRowIndex,
  DraftRow,
  SortColumn,
} from "../components/daily-transactions/daily-transaction.types";
import { getMonthRange, stepMonth } from "../components/daily-transactions/daily-transaction.types";
import {
  KeyboardShortcutsModal,
  useKeyTips,
} from "../components/daily-transactions/KeyboardTipsOverlay";
import { NeracaSummaryTable } from "../components/daily-transactions/NeracaSummaryTable";
import { TransactionMobileModal } from "../components/daily-transactions/TransactionMobileModal";
import { TransactionMobileView } from "../components/daily-transactions/TransactionMobileView";
import { TransactionTable } from "../components/daily-transactions/TransactionTable";
import { TransactionToolbar } from "../components/daily-transactions/TransactionToolbar";
import { useAuth } from "../lib/auth";
import {
  bulkDeleteTransactions,
  bulkUpdateTransactions,
  createTransaction,
  deleteTransaction,
  invalidateAccountingQueries,
  updateTransaction,
} from "../lib/mutations";
import {
  getAccounts,
  getTransactionTypes,
  getTransactions,
  queryKeys,
  type Account,
} from "../lib/queries";
import { toast } from "../lib/toast";

export default function DailyTransactionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const thisMonthKey = todayIsoDate().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(thisMonthKey);

  const [filterMode, setFilterMode] = useState<"month" | "custom" | "all">("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function handleSelectMonth(monthKey: string) {
    setSelectedMonth(monthKey);
    setFilterMode("month");
    const r = getMonthRange(monthKey);
    setStartDate(r.startDate);
    setEndDate(r.endDate);
  }

  function handleStepMonth(offset: number) {
    const nextKey = stepMonth(selectedMonth, offset);
    handleSelectMonth(nextKey);
  }

  function handleCurrentMonth() {
    handleSelectMonth(thisMonthKey);
  }

  function handlePrevMonth() {
    handleSelectMonth(stepMonth(thisMonthKey, -1));
  }

  function handleAllPeriod() {
    setFilterMode("all");
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

  // Neraca summary drawer filter
  const [showNeracaFilter, setShowNeracaFilter] = useState(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<TransactionGroup | "all">("all");

  // Draft rows
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingRowState, setEditingRowState] = useState<DraftRow | null>(null);

  // Active inline metadata form index
  const [activeMetadataRowIndex, setActiveMetadataRowIndex] =
    useState<ActiveMetadataRowIndex>(null);

  // View mode
  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      return "cards";
    }
    return "table";
  });

  // Mobile modal form state
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [mobileModalDraft, setMobileModalDraft] = useState<DraftRow | null>(null);

  // Column filter & sort states
  const [columnSort, setColumnSort] = useState<{
    column: SortColumn;
    direction: "asc" | "desc";
  }>({
    column: "bookOrder",
    direction: "asc",
  });

  const [colFilterDate, setColFilterDate] = useState<Set<string> | null>(null);
  const [colFilterType, setColFilterType] = useState<Set<string> | null>(null);
  const [colFilterPic, setColFilterPic] = useState<Set<string> | null>(null);
  const [colFilterAmount, setColFilterAmount] = useState<{ min?: number; max?: number } | null>(
    null,
  );
  const [minAmountInput, setMinAmountInput] = useState("");
  const [maxAmountInput, setMaxAmountInput] = useState("");

  const groupTabsRef = useRef<HTMLDivElement>(null);
  const scrollGroupTabs = (amount: number) => {
    if (groupTabsRef.current) {
      groupTabsRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  // Queries
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const accountsList: Account[] = accountsQuery.data || [];
  const accountById = useMemo(() => new Map(accountsList.map((a) => [a.id, a])), [accountsList]);

  const selectedAccounts = useMemo(
    () => selectedAccountIds.map((id) => accountById.get(id)).filter(Boolean) as Account[],
    [selectedAccountIds, accountById],
  );

  const hasActiveColumnFilters =
    colFilterDate !== null ||
    colFilterType !== null ||
    colFilterPic !== null ||
    colFilterAmount !== null;

  const hasActiveSort = columnSort.column !== "bookOrder";
  const hasActiveAccountFilters = selectedAccountIds.length > 0;
  const hasActiveGroupFilter = selectedGroup !== "all";
  const hasActivePeriodFilter =
    filterMode === "all" ||
    (filterMode === "custom" && Boolean(startDate || endDate)) ||
    (filterMode === "month" && selectedMonth !== thisMonthKey);

  const hasActiveFiltersAndSort =
    hasActiveAccountFilters ||
    hasActiveGroupFilter ||
    hasActivePeriodFilter ||
    hasActiveColumnFilters ||
    hasActiveSort;

  let activeFiltersCount = 0;
  if (hasActiveAccountFilters) activeFiltersCount += selectedAccountIds.length;
  if (hasActiveGroupFilter) activeFiltersCount += 1;
  if (hasActivePeriodFilter) activeFiltersCount += 1;
  if (colFilterDate !== null) activeFiltersCount += 1;
  if (colFilterType !== null) activeFiltersCount += 1;
  if (colFilterPic !== null) activeFiltersCount += 1;
  if (colFilterAmount !== null) activeFiltersCount += 1;
  if (hasActiveSort) activeFiltersCount += 1;

  /**
   * ATURAN TATA LETAK UI (UI LAYOUT RULE):
   * Tombol "Reset Filter & Sort" HARUS selalu berada inline pada baris toolbar utama (TransactionToolbar),
   * dan DILARANG KERAS diletakkan pada extra row terpisah yang muncul-hilang secara dinamis.
   * Penempatan inline ini mencegah pergeseran layout (layout shift) dan menjaga stabilitas perhitungan tinggi tabel.
   */
  function handleResetAllFiltersAndSort() {
    setSelectedAccountIds([]);
    setSelectedGroup("all");
    setFilterMode("month");
    setSelectedMonth(thisMonthKey);
    setStartDate("");
    setEndDate("");
    setColumnSort({ column: "bookOrder", direction: "asc" });
    setColFilterDate(null);
    setColFilterType(null);
    setColFilterPic(null);
    setColFilterAmount(null);
    setMinAmountInput("");
    setMaxAmountInput("");
  }

  // Dynamic table viewport height calculation
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [tableBodyHeight, setTableBodyHeight] = useState<number | null>(null);

  useEffect(() => {
    if (viewMode !== "table") return;

    function recalculateHeight() {
      if (!tableWrapperRef.current) return;
      const rect = tableWrapperRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const bottomPadding = 12;
      const bottomBarHeight = 34;
      const available = windowHeight - rect.top - bottomPadding - bottomBarHeight;
      const finalHeight = Math.max(available, 220);
      setTableBodyHeight(finalHeight);
    }

    recalculateHeight();
    window.addEventListener("resize", recalculateHeight);
    return () => window.removeEventListener("resize", recalculateHeight);
  }, [viewMode, showNeracaFilter, user?.role]);

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

  const queryParams = useMemo(() => {
    if (filterMode === "month") {
      const r = getMonthRange(selectedMonth);
      return { startDate: r.startDate, endDate: r.endDate };
    }
    if (filterMode === "custom") {
      return {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
    }
    return {};
  }, [filterMode, selectedMonth, startDate, endDate]);

  const transactionsQuery = useQuery({
    queryKey: queryKeys.transactions(queryParams),
    queryFn: () => getTransactions(queryParams),
  });
  const transactionsList: TransactionWithBalances[] = transactionsQuery.data || [];

  const transactionTypesQuery = useQuery({
    queryKey: queryKeys.transactionTypes(),
    queryFn: () => getTransactionTypes(),
  });
  const transactionTypes = transactionTypesQuery.data || [];
  const typeById = useMemo(
    () => new Map(transactionTypes.map((t) => [t.id, t])),
    [transactionTypes],
  );

  const groupedTransactionTypes = useMemo(() => {
    const map = new Map<TransactionGroup, typeof transactionTypes>();
    for (const t of transactionTypes) {
      const g =
        t.group ||
        inferTransactionGroup(
          accountById.get(t.debitAccountId) ?? { code: "", name: "" },
          accountById.get(t.creditAccountId) ?? { code: "", name: "" },
        );
      const list = map.get(g) || [];
      list.push(t);
      map.set(g, list);
    }
    return map;
  }, [transactionTypes, accountById]);

  // Group counts
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const g of TRANSACTION_GROUPS) {
      counts[g.key] = 0;
    }
    const filteredByAccount =
      selectedAccountIds.length > 0
        ? transactionsList.filter((tx) =>
            selectedAccountIds.some(
              (accId) => tx.debitAccountId === accId || tx.creditAccountId === accId,
            ),
          )
        : transactionsList;

    counts.all = filteredByAccount.length;
    for (const tx of filteredByAccount) {
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
      if (counts[txGroup] !== undefined) {
        counts[txGroup] = (counts[txGroup] || 0) + 1;
      }
    }
    return counts;
  }, [transactionsList, selectedAccountIds, accountById]);

  // Base transactions list
  const baseTransactionsList = useMemo(() => {
    let list = transactionsList;
    if (selectedAccountIds.length > 0) {
      list = list.filter((tx) =>
        selectedAccountIds.some(
          (accId) => tx.debitAccountId === accId || tx.creditAccountId === accId,
        ),
      );
    }
    if (selectedGroup !== "all") {
      list = list.filter((tx) => {
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
        return txGroup === selectedGroup;
      });
    }
    return list;
  }, [transactionsList, selectedAccountIds, selectedGroup, accountById]);

  // Filter options for column popovers
  const dateFilterOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of baseTransactionsList) {
      map.set(tx.transactionDate, (map.get(tx.transactionDate) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, count]) => ({ key: date, label: date, count }));
  }, [baseTransactionsList]);

  const typeFilterOptions = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const tx of baseTransactionsList) {
      const type = typeById.get(tx.transactionTypeId);
      const name = type?.name || tx.transactionTypeName || tx.transactionTypeId;
      const current = map.get(name) || { label: name, count: 0 };
      current.count += 1;
      map.set(name, current);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, item]) => ({ key: name, label: item.label, count: item.count }));
  }, [baseTransactionsList, typeById]);

  const picFilterOptions = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of baseTransactionsList) {
      const p = tx.pic?.trim() || "(Tanpa PIC)";
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([p, count]) => ({ key: p, label: p, count }));
  }, [baseTransactionsList]);

  // Filtered & sorted transactions list
  const filteredTransactionsList = useMemo(() => {
    let list = baseTransactionsList;

    if (colFilterDate !== null) {
      list = list.filter((tx) => colFilterDate.has(tx.transactionDate));
    }
    if (colFilterType !== null) {
      list = list.filter((tx) => {
        const type = typeById.get(tx.transactionTypeId);
        const name = type?.name || tx.transactionTypeName || tx.transactionTypeId;
        return colFilterType.has(name);
      });
    }
    if (colFilterPic !== null) {
      list = list.filter((tx) => {
        const p = tx.pic?.trim() || "(Tanpa PIC)";
        return colFilterPic.has(p);
      });
    }
    if (colFilterAmount !== null) {
      if (colFilterAmount.min !== undefined) {
        list = list.filter((tx) => tx.amount >= colFilterAmount.min!);
      }
      if (colFilterAmount.max !== undefined) {
        list = list.filter((tx) => tx.amount <= colFilterAmount.max!);
      }
    }

    if (columnSort.column !== "bookOrder") {
      const factor = columnSort.direction === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        if (columnSort.column === "transactionDate") {
          const cmp = a.transactionDate.localeCompare(b.transactionDate);
          if (cmp !== 0) return cmp * factor;
          return ((a.sortOrder ?? 0) - (b.sortOrder ?? 0)) * factor;
        }
        if (columnSort.column === "transactionTypeName") {
          const nameA = typeById.get(a.transactionTypeId)?.name || a.transactionTypeName || "";
          const nameB = typeById.get(b.transactionTypeId)?.name || b.transactionTypeName || "";
          return nameA.localeCompare(nameB) * factor;
        }
        if (columnSort.column === "amount") {
          return (a.amount - b.amount) * factor;
        }
        if (columnSort.column === "pic") {
          const picA = a.pic || "";
          const picB = b.pic || "";
          return picA.localeCompare(picB) * factor;
        }
        return 0;
      });
    }

    return list;
  }, [
    baseTransactionsList,
    colFilterDate,
    colFilterType,
    colFilterPic,
    colFilterAmount,
    columnSort,
    typeById,
  ]);

  // Chronological running balances for selected accounts
  const accountRunningMaps = useMemo(() => {
    const maps = new Map<string, Map<string, { balance: number; mutation: number }>>();
    if (selectedAccounts.length === 0) return maps;

    for (const acc of selectedAccounts) {
      const targetCode = acc.code;
      const map = new Map<string, { balance: number; mutation: number }>();

      const hasBuiltInRunning = transactionsList.some(
        (tx) => tx.runningBalances && tx.runningBalances[targetCode] !== undefined,
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

  // Total table columns
  const totalColumns = 7 + selectedAccounts.length;

  // Selection
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(() => new Set());
  const [lastClickedTxId, setLastClickedTxId] = useState<string | null>(null);

  // Bulk action modals
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDateModalOpen, setBulkDateModalOpen] = useState(false);
  const [bulkPicModalOpen, setBulkPicModalOpen] = useState(false);
  const [bulkTypeModalOpen, setBulkTypeModalOpen] = useState(false);

  const selectedTransactions = useMemo(() => {
    if (selectedTxIds.size === 0) return [];
    return filteredTransactionsList.filter((tx) => selectedTxIds.has(tx.id));
  }, [selectedTxIds, filteredTransactionsList]);

  const selectedTotalSen = useMemo(() => {
    return selectedTransactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);
  }, [selectedTransactions]);

  const summaryStats = useMemo(() => {
    const isSelected = selectedTransactions.length > 0;
    const targetList = isSelected ? selectedTransactions : filteredTransactionsList;
    const count = targetList.length;
    if (count === 0) {
      return { isSelected, count: 0, sum: 0, avg: 0, min: 0, max: 0 };
    }
    let sum = 0;
    let min = targetList[0]!.amount || 0;
    let max = targetList[0]!.amount || 0;
    for (const tx of targetList) {
      const amt = tx.amount || 0;
      sum += amt;
      if (amt < min) min = amt;
      if (amt > max) max = amt;
    }
    const avg = Math.round(sum / count);
    return { isSelected, count, sum, avg, min, max };
  }, [selectedTransactions, filteredTransactionsList]);

  const isAllSelected = useMemo(() => {
    if (filteredTransactionsList.length === 0) return false;
    return filteredTransactionsList.every((tx) => selectedTxIds.has(tx.id));
  }, [filteredTransactionsList, selectedTxIds]);

  const isSomeSelected = useMemo(() => {
    return selectedTxIds.size > 0 && !isAllSelected;
  }, [selectedTxIds, isAllSelected]);

  function handleToggleSelectAll() {
    if (isAllSelected) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(filteredTransactionsList.map((tx) => tx.id)));
    }
  }

  function handleClearSelection() {
    setSelectedTxIds(new Set());
    setLastClickedTxId(null);
  }

  function handleToggleRowSelect(id: string, shiftKey = false) {
    setSelectedTxIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastClickedTxId && lastClickedTxId !== id) {
        const lastIndex = filteredTransactionsList.findIndex((t) => t.id === lastClickedTxId);
        const currIndex = filteredTransactionsList.findIndex((t) => t.id === id);
        if (lastIndex !== -1 && currIndex !== -1) {
          const [start, end] =
            lastIndex < currIndex ? [lastIndex, currIndex] : [currIndex, lastIndex];
          for (let i = start; i <= end; i++) {
            const item = filteredTransactionsList[i];
            if (item) next.add(item.id);
          }
          return next;
        }
      }

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastClickedTxId(id);
  }

  function handleExportCsv() {
    const listToExport =
      selectedTransactions.length > 0 ? selectedTransactions : filteredTransactionsList;
    if (listToExport.length === 0) {
      toast.info("Tidak ada transaksi untuk diekspor");
      return;
    }

    const headers = [
      "Tanggal",
      "Tipe Transaksi",
      "Grup",
      "Akun Debit",
      "Akun Kredit",
      "Nominal (Rp)",
      "PIC",
      "Metadata",
    ];
    const rows = listToExport.map((tx) => {
      const type = typeById.get(tx.transactionTypeId);
      const metaStr =
        tx.metadata && typeof tx.metadata === "object"
          ? Object.entries(tx.metadata)
              .map(([k, v]) => `${k}=${v}`)
              .join("; ")
          : "";
      return [
        tx.transactionDate,
        `"${(type?.name || tx.transactionTypeName || "").replace(/"/g, '""')}"`,
        `"${(tx.group || "").replace(/"/g, '""')}"`,
        `"${(tx.debitAccountCode ? `${tx.debitAccountCode} - ${tx.debitAccountName}` : "").replace(/"/g, '""')}"`,
        `"${(tx.creditAccountCode ? `${tx.creditAccountCode} - ${tx.creditAccountName}` : "").replace(/"/g, '""')}"`,
        senToRupiah(tx.amount),
        `"${(tx.pic || "").replace(/"/g, '""')}"`,
        `"${metaStr.replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `buku_transaksi_${todayIsoDate()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${listToExport.length} transaksi berhasil diekspor ke CSV.`);
  }

  // Mutations
  const createMutation = useMutation({
    mutationFn: (draft: DraftRow) =>
      createTransaction({
        transactionDate: draft.transactionDate,
        transactionTypeId: draft.transactionTypeId,
        amount: draft.amount || "0",
        pic: draft.pic || undefined,
        metadata: draft.metadata,
        sortOrder: draft.sortOrder,
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
        pic: draft.pic || undefined,
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

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteTransactions(ids),
    onSuccess: async (data) => {
      toast.success(`${data.deletedCount} transaksi berhasil dihapus beserta jurnalnya.`);
      setSelectedTxIds(new Set());
      setBulkDeleteModalOpen(false);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus transaksi masal");
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (input: {
      ids: string[];
      updates: { transactionDate?: string; pic?: string | null; transactionTypeId?: string };
    }) => bulkUpdateTransactions(input),
    onSuccess: async (data) => {
      toast.success(`${data.updatedCount} transaksi berhasil diperbarui.`);
      setSelectedTxIds(new Set());
      setBulkDateModalOpen(false);
      setBulkPicModalOpen(false);
      setBulkTypeModalOpen(false);
      await invalidateAccountingQueries(queryClient);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Gagal memperbarui transaksi masal");
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
    const lastShift =
      draftRows.find((r) => r.metadata?.shift)?.metadata?.shift ||
      filteredTransactionsList.find((t) => t.metadata?.shift)?.metadata?.shift;
    const initialMeta =
      lastShift && defaultType?.metadataSchema?.some((f) => f.key === "shift")
        ? { shift: lastShift }
        : {};
    const newDraft: DraftRow = {
      isNew: true,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      transactionDate: draftDate,
      transactionTypeId: defaultType ? defaultType.id : "",
      amount: "",
      pic: "",
      metadata: initialMeta,
    };
    setDraftRows((prev) => [newDraft, ...prev]);
  }

  function insertRowRelative(targetTx: TransactionWithBalances, position: "above" | "below") {
    let defaultType = transactionTypes[0];
    if (selectedGroup !== "all") {
      const inGroup = groupedTransactionTypes.get(selectedGroup);
      if (inGroup && inGroup.length > 0) {
        defaultType = inGroup[0];
      }
    }

    const currentIdx = transactionsList.findIndex((t) => t.id === targetTx.id);
    const targetDate = targetTx.transactionDate;
    const currentSortOrder = targetTx.sortOrder ?? 1000;

    let newSortOrder: number;
    if (position === "below") {
      const nextTx =
        currentIdx >= 0 && currentIdx < transactionsList.length - 1
          ? transactionsList[currentIdx + 1]
          : null;
      if (nextTx && nextTx.transactionDate === targetDate) {
        const nextSortOrder = nextTx.sortOrder ?? currentSortOrder + 2000;
        newSortOrder = (currentSortOrder + nextSortOrder) / 2;
      } else {
        newSortOrder = currentSortOrder + 1000;
      }
    } else {
      const prevTx = currentIdx > 0 ? transactionsList[currentIdx - 1] : null;
      if (prevTx && prevTx.transactionDate === targetDate) {
        const prevSortOrder = prevTx.sortOrder ?? currentSortOrder - 2000;
        newSortOrder = (prevSortOrder + currentSortOrder) / 2;
      } else {
        newSortOrder = currentSortOrder - 1000;
      }
    }

    const lastShift =
      targetTx.metadata?.shift || draftRows.find((r) => r.metadata?.shift)?.metadata?.shift;
    const initialMeta =
      lastShift && defaultType?.metadataSchema?.some((f) => f.key === "shift")
        ? { shift: lastShift }
        : {};

    const newDraft: DraftRow = {
      isNew: true,
      id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      transactionDate: targetDate,
      transactionTypeId: defaultType ? defaultType.id : "",
      amount: "",
      pic: targetTx.pic || "",
      metadata: initialMeta,
      sortOrder: newSortOrder,
      insertAfterId: position === "below" ? targetTx.id : undefined,
      insertBeforeId: position === "above" ? targetTx.id : undefined,
    };

    setDraftRows((prev) => [...prev, newDraft]);
  }

  function startEditExisting(tx: TransactionWithBalances) {
    setEditingRowId(tx.id);
    setEditingRowState({
      id: tx.id,
      transactionDate: tx.transactionDate,
      transactionTypeId: tx.transactionTypeId,
      amount: senToRupiah(tx.amount).toFixed(2),
      pic: tx.pic || "",
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
      pic: "",
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
      pic: tx.pic || "",
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

  function handleDraftKeyDown(e: React.KeyboardEvent, draft: DraftRow, isLastField = false) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key.toLowerCase() === "s")) {
      e.preventDefault();
      if (!draft.transactionTypeId) {
        toast.error("Pilih tipe transaksi terlebih dahulu.");
        return;
      }
      if (!createMutation.isPending) {
        createMutation.mutate(draft);
      }
      return;
    }

    if (isLastField && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!draft.transactionTypeId) {
        toast.error("Pilih tipe transaksi terlebih dahulu.");
        return;
      }
      if (!createMutation.isPending) {
        createMutation.mutate(draft);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setDraftRows((prev) => prev.filter((r) => r.id !== draft.id));
    }
  }

  function handleEditKeyDown(
    e: React.KeyboardEvent,
    txId: string,
    draft: DraftRow,
    isLastField = false,
  ) {
    if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key.toLowerCase() === "s")) {
      e.preventDefault();
      if (!draft.transactionTypeId) {
        toast.error("Pilih tipe transaksi terlebih dahulu.");
        return;
      }
      if (!updateMutation.isPending) {
        updateMutation.mutate({ id: txId, draft });
      }
      return;
    }

    if (isLastField && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!draft.transactionTypeId) {
        toast.error("Pilih tipe transaksi terlebih dahulu.");
        return;
      }
      if (!updateMutation.isPending) {
        updateMutation.mutate({ id: txId, draft });
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      cancelEditExisting();
    }
  }

  const { isKeyTipsActive, isHelpOpen, setIsHelpOpen } = useKeyTips({
    onAddNewRow: handleAddNew,
    onToggleFilter: () => setShowNeracaFilter((prev) => !prev),
    onCurrentMonth: handleCurrentMonth,
    onPrevMonth: handlePrevMonth,
    onAllPeriod: handleAllPeriod,
    onCustomPeriod: () => setFilterMode(filterMode === "custom" ? "month" : "custom"),
    onToggleView: () => setViewMode((prev) => (prev === "cards" ? "table" : "cards")),
    onSaveCurrentRow: () => {
      if (draftRows.length > 0) {
        const first = draftRows[0];
        if (first && first.transactionTypeId && !createMutation.isPending) {
          createMutation.mutate(first);
        }
      } else if (
        editingRowId &&
        editingRowState &&
        editingRowState.transactionTypeId &&
        !updateMutation.isPending
      ) {
        updateMutation.mutate({ id: editingRowId, draft: editingRowState });
      }
    },
    canSaveCurrentRow: Boolean(
      (draftRows.length > 0 && draftRows[0]?.transactionTypeId) ||
      (editingRowId && editingRowState?.transactionTypeId),
    ),
  });

  const renderGroupPills = () => (
    <>
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
    </>
  );

  const nominalFilterNode = (
    <div className="space-y-1.5 p-1">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        Rentang Nominal (Rp)
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <label className="text-[10px] text-slate-500">Min</label>
          <input
            type="text"
            placeholder="0"
            value={minAmountInput}
            onChange={(e) => setMinAmountInput(e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-500">Max</label>
          <input
            type="text"
            placeholder="Tanpa batas"
            value={maxAmountInput}
            onChange={(e) => setMaxAmountInput(e.target.value)}
            className="w-full px-1.5 py-1 text-[11px] rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
          />
        </div>
      </div>
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => {
            setMinAmountInput("");
            setMaxAmountInput("");
            setColFilterAmount(null);
          }}
          className="text-[11px] text-slate-500 hover:underline"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => {
            const minSen = minAmountInput.trim() ? parseRupiahToSen(minAmountInput) : undefined;
            const maxSen = maxAmountInput.trim() ? parseRupiahToSen(maxAmountInput) : undefined;
            if (minSen === undefined && maxSen === undefined) {
              setColFilterAmount(null);
            } else {
              setColFilterAmount({ min: minSen, max: maxSen });
            }
          }}
          className="rounded bg-brand px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
        >
          Terapkan
        </button>
      </div>
    </div>
  );

  const topDraftRows = useMemo(
    () => draftRows.filter((d) => !d.insertAfterId && !d.insertBeforeId),
    [draftRows],
  );

  const beforeDraftsMap = useMemo(() => {
    const map = new Map<string, DraftRow[]>();
    for (const d of draftRows) {
      if (d.insertBeforeId) {
        const list = map.get(d.insertBeforeId) || [];
        list.push(d);
        map.set(d.insertBeforeId, list);
      }
    }
    return map;
  }, [draftRows]);

  const afterDraftsMap = useMemo(() => {
    const map = new Map<string, DraftRow[]>();
    for (const d of draftRows) {
      if (d.insertAfterId) {
        const list = map.get(d.insertAfterId) || [];
        list.push(d);
        map.set(d.insertAfterId, list);
      }
    }
    return map;
  }, [draftRows]);

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

      {/*
        Filter and Action Bar 
        ATURAN TATA LETAK: Tombol Reset Filter & Sort diletakkan inline di sini!
        Dilarang menambahkan extra row dinamis di bawah bar ini.
      */}
      <TransactionToolbar
        selectedMonth={selectedMonth}
        thisMonthKey={thisMonthKey}
        filterMode={filterMode}
        startDate={startDate}
        endDate={endDate}
        showNeracaFilter={showNeracaFilter}
        selectedAccountCount={selectedAccounts.length}
        hasActiveFiltersAndSort={hasActiveFiltersAndSort}
        activeFiltersCount={activeFiltersCount}
        filteredCount={filteredTransactionsList.length}
        viewMode={viewMode}
        isKeyTipsActive={isKeyTipsActive}
        onSelectMonth={handleSelectMonth}
        onStepMonth={handleStepMonth}
        onCurrentMonth={handleCurrentMonth}
        onPrevMonth={handlePrevMonth}
        onAllPeriod={handleAllPeriod}
        onToggleCustomMode={() => setFilterMode(filterMode === "custom" ? "month" : "custom")}
        onChangeStartDate={handleCustomStartDate}
        onChangeEndDate={handleCustomEndDate}
        onToggleNeracaFilter={() => setShowNeracaFilter((prev) => !prev)}
        onResetAllFiltersAndSort={handleResetAllFiltersAndSort}
        onChangeViewMode={setViewMode}
        onOpenHelp={() => setIsHelpOpen(true)}
        onAddNew={handleAddNew}
      />

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
        <TransactionMobileView
          filteredTransactionsList={filteredTransactionsList}
          draftRows={draftRows}
          isLoading={transactionsQuery.isLoading}
          selectedAccounts={selectedAccounts}
          selectedTxIds={selectedTxIds}
          isAllSelected={isAllSelected}
          isSomeSelected={isSomeSelected}
          typeById={typeById}
          accountById={accountById}
          accountRunningMaps={accountRunningMaps}
          isSubmitting={createMutation.isPending}
          groupPillsNode={renderGroupPills()}
          onClearAccountFilters={() => setSelectedAccountIds([])}
          onToggleSelectAll={handleToggleSelectAll}
          onClearSelection={handleClearSelection}
          onToggleRowSelect={(id) => handleToggleRowSelect(id)}
          onSaveDraft={(draft) => createMutation.mutate(draft)}
          onDeleteDraft={(id) => setDraftRows((prev) => prev.filter((r) => r.id !== id))}
          onOpenNewTransaction={openMobileNewTransaction}
          onOpenEditTransaction={openMobileEditTransaction}
          onDeleteTransaction={(id) => {
            if (confirm("Hapus transaksi ini? Jurnal terkait juga akan dihapus.")) {
              deleteMutation.mutate(id);
            }
          }}
        />
      )}

      {/* Spreadsheet Table (Desktop view default, or toggled) */}
      {viewMode === "table" && (
        <TransactionTable
          tableWrapperRef={tableWrapperRef}
          tableBodyHeight={tableBodyHeight}
          showNeracaFilter={showNeracaFilter}
          isAssistant={user?.role === "asisten"}
          isAllSelected={isAllSelected}
          isSomeSelected={isSomeSelected}
          onToggleSelectAll={handleToggleSelectAll}
          columnSort={columnSort}
          onSort={(col, dir) => setColumnSort({ column: col, direction: dir })}
          dateFilterOptions={dateFilterOptions}
          colFilterDate={colFilterDate}
          onApplyColFilterDate={(keys) => setColFilterDate(keys)}
          typeFilterOptions={typeFilterOptions}
          colFilterType={colFilterType}
          onApplyColFilterType={(keys) => setColFilterType(keys)}
          nominalFilterNode={nominalFilterNode}
          colFilterAmount={colFilterAmount}
          picFilterOptions={picFilterOptions}
          colFilterPic={colFilterPic}
          onApplyColFilterPic={(keys) => setColFilterPic(keys)}
          selectedAccounts={selectedAccounts}
          topDraftRows={topDraftRows}
          beforeDraftsMap={beforeDraftsMap}
          afterDraftsMap={afterDraftsMap}
          filteredTransactionsList={filteredTransactionsList}
          isLoading={transactionsQuery.isLoading}
          totalColumns={totalColumns}
          selectedTxIds={selectedTxIds}
          editingRowId={editingRowId}
          editingRowState={editingRowState}
          activeMetadataRowIndex={activeMetadataRowIndex}
          transactionTypes={transactionTypes}
          typeById={typeById}
          accountById={accountById}
          accountRunningMaps={accountRunningMaps}
          isKeyTipsActive={isKeyTipsActive}
          isSubmitting={createMutation.isPending}
          onUpdateDraft={(updated) =>
            setDraftRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
          }
          onDeleteDraft={(id) => setDraftRows((prev) => prev.filter((r) => r.id !== id))}
          onSaveDraft={(draft) => createMutation.mutate(draft)}
          onToggleMetadata={(isDraft, idOrIndex) =>
            setActiveMetadataRowIndex(idOrIndex ? { isDraft, idOrIndex } : null)
          }
          onDraftKeyDown={handleDraftKeyDown}
          onToggleRowSelect={handleToggleRowSelect}
          onChangeEditingDraft={setEditingRowState}
          onEditKeyDown={handleEditKeyDown}
          onSaveEdit={(id, draft) => updateMutation.mutate({ id, draft })}
          onCancelEdit={cancelEditExisting}
          onStartEdit={startEditExisting}
          onDeleteTx={(id) => {
            if (confirm("Hapus transaksi ini? Jurnal terkait juga akan dihapus.")) {
              deleteMutation.mutate(id);
            }
          }}
          onInsertRelative={insertRowRelative}
          onClearAccountFilters={() => setSelectedAccountIds([])}
          groupTabsRef={groupTabsRef}
          scrollGroupTabs={scrollGroupTabs}
          groupPillsNode={renderGroupPills()}
          summaryStats={summaryStats}
        />
      )}

      {/* Mobile Transaction Form Modal */}
      <TransactionMobileModal
        isOpen={mobileModalOpen}
        draft={mobileModalDraft}
        transactionTypes={transactionTypes}
        typeById={typeById}
        accountById={accountById}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setMobileModalOpen(false);
          setMobileModalDraft(null);
        }}
        onChangeDraft={setMobileModalDraft}
        onSubmit={async (draft) => {
          if (!draft.transactionTypeId) return;
          if (draft.isNew) {
            await createMutation.mutateAsync(draft);
          } else {
            await updateMutation.mutateAsync({ id: draft.id, draft });
          }
          setMobileModalOpen(false);
          setMobileModalDraft(null);
        }}
      />

      {/* Bulk Action Toolbar */}
      <BulkActionBar
        selectedCount={selectedTxIds.size}
        totalAmountSen={selectedTotalSen}
        onClearSelection={handleClearSelection}
        onOpenBulkDelete={() => setBulkDeleteModalOpen(true)}
        onOpenBulkDate={() => setBulkDateModalOpen(true)}
        onOpenBulkPic={() => setBulkPicModalOpen(true)}
        onOpenBulkType={() => setBulkTypeModalOpen(true)}
        onExportCsv={handleExportCsv}
      />

      {/* Bulk Action Modals */}
      <BulkDeleteModal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        count={selectedTxIds.size}
        totalAmountSen={selectedTotalSen}
        isPending={bulkDeleteMutation.isPending}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedTxIds))}
      />

      <BulkDateModal
        isOpen={bulkDateModalOpen}
        onClose={() => setBulkDateModalOpen(false)}
        count={selectedTxIds.size}
        isPending={bulkUpdateMutation.isPending}
        onConfirm={(targetDate) =>
          bulkUpdateMutation.mutate({
            ids: Array.from(selectedTxIds),
            updates: { transactionDate: targetDate },
          })
        }
      />

      <BulkPicModal
        isOpen={bulkPicModalOpen}
        onClose={() => setBulkPicModalOpen(false)}
        count={selectedTxIds.size}
        isPending={bulkUpdateMutation.isPending}
        onConfirm={(targetPic) =>
          bulkUpdateMutation.mutate({
            ids: Array.from(selectedTxIds),
            updates: { pic: targetPic },
          })
        }
      />

      <BulkTypeModal
        isOpen={bulkTypeModalOpen}
        onClose={() => setBulkTypeModalOpen(false)}
        count={selectedTxIds.size}
        transactionTypes={transactionTypes}
        accountById={accountById}
        isPending={bulkUpdateMutation.isPending}
        onConfirm={(typeId) =>
          bulkUpdateMutation.mutate({
            ids: Array.from(selectedTxIds),
            updates: { transactionTypeId: typeId },
          })
        }
      />

      {/* Keyboard Shortcuts Cheat-sheet Modal */}
      <KeyboardShortcutsModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
