import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { parseRupiahToSen, senToRupiah, todayIsoDate } from "@keuangan-apotek/shared";
import {
  autoBalanceOpeningBalances,
  deleteAccount as removeAccount,
  invalidateAccountingQueries,
  lockOpeningBalances,
  moveOpeningBalanceDate,
  saveAccount,
  saveOpeningBalances,
} from "../lib/mutations";
import {
  getAccounts,
  getOpeningBalanceMeta,
  getOpeningBalances,
  queryKeys,
  type Account,
} from "../lib/queries";

type BalanceLine = { accountId: string; debitAmount: string; creditAmount: string; notes?: string };
const today = todayIsoDate();

function formatSen(sen: number): string {
  const fixed = senToRupiah(sen).toFixed(2);
  const [whole, fraction] = fixed.split(".");
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}

function CoAPage() {
  const [mode, setMode] = useState<"structure" | "opening">("structure");
  const [cutoffDate, setCutoffDate] = useState(today);
  const [isCutoffDateDirty, setIsCutoffDateDirty] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Record<string, BalanceLine>>({});
  const [runningBalances, setRunningBalances] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [classification, setClassification] = useState("ALL");
  const [isLocked, setIsLocked] = useState(false);
  const [message, setMessage] = useState("");
  const [newAccount, setNewAccount] = useState({
    code: "",
    name: "",
    classification: "ASET_LANCAR",
    normalBalance: "DEBIT",
    parentId: "",
    level: 1,
  });

  const queryClient = useQueryClient();
  const accountsQuery = useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
  const metaQuery = useQuery({
    queryKey: queryKeys.openingBalanceMeta,
    queryFn: getOpeningBalanceMeta,
  });
  // Load the existing draft once. The selected date is an opening-balance
  // field, not a report filter, so changing it must not reload/overwrite the
  // values currently being edited.
  const loadedCutoffDate = metaQuery.data?.cutoffDate ?? today;
  const balancesQuery = useQuery({
    queryKey: queryKeys.openingBalances(loadedCutoffDate),
    queryFn: () => getOpeningBalances(loadedCutoffDate),
    enabled: Boolean(metaQuery.data),
  });
  const loading = accountsQuery.isLoading || metaQuery.isLoading || balancesQuery.isLoading;
  useEffect(() => {
    if (metaQuery.data?.cutoffDate && !isCutoffDateDirty) setCutoffDate(metaQuery.data.cutoffDate);
  }, [metaQuery.data, isCutoffDateDirty]);
  useEffect(() => {
    setAccounts((accountsQuery.data ?? []) as Account[]);
  }, [accountsQuery.data]);

  useEffect(() => {
    if (!balancesQuery.data) return;
    const next: Record<string, BalanceLine> = {};
    const nextRunning: Record<string, number> = {};
    for (const row of balancesQuery.data) {
      next[row.accountId] = {
        accountId: row.accountId,
        debitAmount: formatSen(row.debitAmount),
        creditAmount: formatSen(row.creditAmount),
        notes: row.notes ?? "",
      };
      nextRunning[row.accountId] = row.runningBalance;
    }
    setBalances(next);
    setRunningBalances(nextRunning);
    setIsLocked(balancesQuery.data.some((row) => row.isLocked));
  }, [balancesQuery.data]);

  const autoBalanceMutation = useMutation({
    mutationFn: autoBalanceOpeningBalances,
    onSuccess: (payload) => {
      const next: Record<string, BalanceLine> = {};
      for (const line of payload.lines as BalanceLine[]) {
        const debitSen = parseRupiahToSen(line.debitAmount || "0");
        const creditSen = parseRupiahToSen(line.creditAmount || "0");
        next[line.accountId] = {
          accountId: line.accountId,
          debitAmount: formatSen(debitSen),
          creditAmount: formatSen(creditSen),
          notes: line.notes ?? "",
        };
      }
      setBalances((current) => ({ ...current, ...next }));
      setMessage("Selisih dialokasikan ke Ekuitas Saldo Awal (3101).");
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Auto-balancing gagal"),
  });

  const saveLockMutation = useMutation({
    mutationFn: async (lines: BalanceLine[]) => {
      if (isCutoffDateDirty && cutoffDate !== loadedCutoffDate && isLocked) {
        await moveOpeningBalanceDate({ fromDate: loadedCutoffDate, toDate: cutoffDate });
      }
      await saveOpeningBalances({ cutoffDate, lines });
      return lockOpeningBalances(cutoffDate);
    },
    onSuccess: async (payload) => {
      setIsLocked(true);
      queryClient.setQueryData(queryKeys.openingBalanceMeta, { cutoffDate });
      setIsCutoffDateDirty(false);
      setMessage(
        `Saldo awal berhasil disimpan. Jurnal pembuka ${payload.journal.journalNo} diperbarui.`,
      );
      await invalidateAccountingQueries(queryClient);
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Saldo awal belum dapat disimpan."),
  });

  const accountMutation = useMutation({
    mutationFn: saveAccount,
    onSuccess: async () => {
      setMessage("Akun berhasil disimpan.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      await queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (error) =>
      setMessage(error instanceof Error ? error.message : "Perubahan akun belum tersimpan."),
  });

  const deleteMutation = useMutation({
    mutationFn: removeAccount,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    },
    onError: () =>
      setMessage(
        "Akun tidak dapat dihapus. Hapus sub-akun atau referensi terkait terlebih dahulu.",
      ),
  });

  const visibleAccounts = useMemo(
    () =>
      accounts.filter((account) => {
        const matchesText = `${account.code} ${account.name}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return (
          matchesText && (classification === "ALL" || account.classification === classification)
        );
      }),
    [accounts, classification, search],
  );

  const accountAggregates = useMemo(() => {
    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    const childrenMap = new Map<string, Account[]>();
    for (const a of accounts) {
      if (a.parentId) {
        const list = childrenMap.get(a.parentId) ?? [];
        list.push(a);
        childrenMap.set(a.parentId, list);
      }
    }

    const memoMap = new Map<
      string,
      { debitSen: number; creditSen: number; runningBalanceSen: number }
    >();

    function calculate(accId: string): {
      debitSen: number;
      creditSen: number;
      runningBalanceSen: number;
    } {
      if (memoMap.has(accId)) return memoMap.get(accId)!;
      const acc = accountsById.get(accId);
      if (!acc) return { debitSen: 0, creditSen: 0, runningBalanceSen: 0 };
      if (!acc.isGroup) {
        const line = balances[accId];
        const res = {
          debitSen: parseRupiahToSen(line?.debitAmount || "0"),
          creditSen: parseRupiahToSen(line?.creditAmount || "0"),
          runningBalanceSen: runningBalances[accId] ?? 0,
        };
        memoMap.set(accId, res);
        return res;
      }

      const children = childrenMap.get(accId) ?? [];
      let debitSen = 0;
      let creditSen = 0;
      let runningBalanceSen = 0;
      for (const child of children) {
        const childRes = calculate(child.id);
        debitSen += childRes.debitSen;
        creditSen += childRes.creditSen;
        runningBalanceSen += childRes.runningBalanceSen;
      }
      const res = { debitSen, creditSen, runningBalanceSen };
      memoMap.set(accId, res);
      return res;
    }

    for (const a of accounts) {
      calculate(a.id);
    }

    return memoMap;
  }, [accounts, balances, runningBalances]);

  const totals = useMemo(() => {
    const leafAccounts = accounts.filter((account) => !account.isGroup);
    let totalDebitSen = 0;
    let totalCreditSen = 0;

    for (const account of leafAccounts) {
      const line = balances[account.id];
      if (!line) continue;
      const debitSen = parseRupiahToSen(line.debitAmount || "0");
      const creditSen = parseRupiahToSen(line.creditAmount || "0");
      totalDebitSen += debitSen;
      totalCreditSen += creditSen;
    }

    const debitDecimal = senToRupiah(totalDebitSen);
    const creditDecimal = senToRupiah(totalCreditSen);
    const differenceDecimal = debitDecimal.minus(creditDecimal);

    return {
      totalDebitSen,
      totalCreditSen,
      debit: debitDecimal,
      credit: creditDecimal,
      difference: differenceDecimal,
    };
  }, [accounts, balances]);

  const updateBalance = (
    accountId: string,
    field: "debitAmount" | "creditAmount" | "notes",
    value: string,
  ) => {
    setBalances((current) => {
      const prev = current[accountId] ?? {
        accountId,
        debitAmount: "0,00",
        creditAmount: "0,00",
        notes: "",
      };

      if (field === "notes") {
        return { ...current, [accountId]: { ...prev, notes: value } };
      }

      const isNegative = value.trim().startsWith("-");
      const cleanVal = isNegative ? value.trim().substring(1) : value;

      if (field === "debitAmount") {
        if (isNegative) {
          return {
            ...current,
            [accountId]: { ...prev, debitAmount: "0,00", creditAmount: cleanVal },
          };
        }
        return {
          ...current,
          [accountId]: {
            ...prev,
            debitAmount: value,
            creditAmount: "0,00",
          },
        };
      }

      if (field === "creditAmount") {
        if (isNegative) {
          return {
            ...current,
            [accountId]: { ...prev, creditAmount: "0,00", debitAmount: cleanVal },
          };
        }
        return {
          ...current,
          [accountId]: {
            ...prev,
            creditAmount: value,
            debitAmount: "0,00",
          },
        };
      }

      return current;
    });
  };

  const formatBalanceOnBlur = (
    accountId: string,
    field: "debitAmount" | "creditAmount",
    value: string,
  ) => {
    const isNegative = value.trim().startsWith("-");
    const cleanVal = isNegative ? value.trim().substring(1) : value;
    const sen = parseRupiahToSen(cleanVal || "0");

    setBalances((current) => {
      const prev = current[accountId] ?? {
        accountId,
        debitAmount: "0,00",
        creditAmount: "0,00",
        notes: "",
      };
      if (field === "debitAmount") {
        if (isNegative && sen > 0) {
          return {
            ...current,
            [accountId]: { ...prev, debitAmount: "0,00", creditAmount: formatSen(sen) },
          };
        }
        return {
          ...current,
          [accountId]: {
            ...prev,
            debitAmount: formatSen(sen),
            creditAmount: "0,00",
          },
        };
      }
      if (field === "creditAmount") {
        if (isNegative && sen > 0) {
          return {
            ...current,
            [accountId]: { ...prev, creditAmount: "0,00", debitAmount: formatSen(sen) },
          };
        }
        return {
          ...current,
          [accountId]: {
            ...prev,
            creditAmount: formatSen(sen),
            debitAmount: "0,00",
          },
        };
      }
      return current;
    });
  };

  function handleNormalBalanceChange(account: Account, newNormal: "DEBIT" | "KREDIT") {
    void updateAccount(account, { normalBalance: newNormal });
    setBalances((current) => {
      const line = current[account.id] ?? {
        accountId: account.id,
        debitAmount: "0,00",
        creditAmount: "0,00",
        notes: "",
      };
      const debitSen = parseRupiahToSen(line.debitAmount);
      const creditSen = parseRupiahToSen(line.creditAmount);
      if (newNormal === "KREDIT") {
        return {
          ...current,
          [account.id]: {
            ...line,
            creditAmount:
              debitSen > 0 ? formatSen(debitSen) : creditSen > 0 ? formatSen(creditSen) : "0,00",
            debitAmount: "0,00",
          },
        };
      }
      if (newNormal === "DEBIT") {
        return {
          ...current,
          [account.id]: {
            ...line,
            debitAmount:
              creditSen > 0 ? formatSen(creditSen) : debitSen > 0 ? formatSen(debitSen) : "0,00",
            creditAmount: "0,00",
          },
        };
      }
      return current;
    });
  }

  async function autoBalance() {
    const lines = accounts
      .filter((account) => !account.isGroup)
      .map((account) => {
        const line = balances[account.id];
        return {
          accountId: account.id,
          debitAmount: line?.debitAmount || "0",
          creditAmount: line?.creditAmount || "0",
          notes: line?.notes,
        };
      });
    autoBalanceMutation.mutate({ cutoffDate, lines });
  }

  async function saveAndLock() {
    const lines = accounts
      .filter((account) => !account.isGroup)
      .map((account) => {
        const line = balances[account.id];
        return {
          accountId: account.id,
          debitAmount: line?.debitAmount || "0",
          creditAmount: line?.creditAmount || "0",
          notes: line?.notes,
        };
      });
    saveLockMutation.mutate(lines);
  }

  async function addAccount() {
    accountMutation.mutate(newAccount as Parameters<typeof saveAccount>[0]);
    setNewAccount({
      code: "",
      name: "",
      classification: "ASET_LANCAR",
      normalBalance: "DEBIT",
      parentId: "",
      level: 1,
    });
  }

  async function updateAccount(account: Account, patch: Partial<Account>) {
    const next = { ...account, ...patch };
    setAccounts((prev) => prev.map((a) => (a.id === account.id ? next : a)));
    accountMutation.mutate(next as Parameters<typeof saveAccount>[0]);
  }

  async function handleDeleteAccount(id: string) {
    deleteMutation.mutate(id);
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4">
        <div aria-label="Mode CoA" className="flex gap-6 border-b border-slate-200" role="tablist">
          <button
            aria-selected={mode === "structure"}
            className={`border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${mode === "structure" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"}`}
            onClick={() => setMode("structure")}
            role="tab"
            type="button"
          >
            Struktur Akun
          </button>
          <button
            aria-selected={mode === "opening"}
            className={`border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${mode === "opening" ? "border-brand text-brand" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"}`}
            onClick={() => setMode("opening")}
            role="tab"
            type="button"
          >
            Input Saldo Awal
          </button>
        </div>
      </section>

      {mode === "opening" && isCutoffDateDirty && cutoffDate !== loadedCutoffDate && (
        <p
          className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          role="status"
        >
          Tanggal saldo awal diubah. Draft yang sedang diinput akan disimpan dengan tanggal{" "}
          {cutoffDate}.
        </p>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
          <input
            aria-label="Cari akun"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-blue-100"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode atau nama akun..."
            value={search}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <SlidersHorizontal size={16} />
            <select
              aria-label="Filter klasifikasi"
              className="rounded-lg border border-slate-200 px-3 py-2"
              onChange={(event) => setClassification(event.target.value)}
              value={classification}
            >
              <option value="ALL">Semua klasifikasi</option>
              <option value="ASET_LANCAR">Aset Lancar</option>
              <option value="ASET_TIDAK_LANCAR">Aset Tidak Lancar</option>
              <option value="KEWAJIBAN_LANCAR">Kewajiban</option>
              <option value="EKUITAS">Ekuitas</option>
              <option value="PENDAPATAN">Pendapatan</option>
              <option value="BEBAN_POKOK">Beban Pokok</option>
              <option value="BEBAN_OPERASIONAL">Beban Operasional</option>
            </select>
          </div>
          {mode === "opening" && (
            <label
              className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-900"
              htmlFor="cutoff"
            >
              <span>Tanggal saldo awal</span>
              <input
                aria-label="Tanggal saldo awal"
                className="rounded-md border border-blue-200 bg-white px-2 py-1 text-sm font-normal tabular-nums text-slate-700"
                id="cutoff"
                onChange={(event) => {
                  setCutoffDate(event.target.value);
                  setIsCutoffDateDirty(true);
                }}
                type="date"
                value={cutoffDate}
              />
            </label>
          )}
        </div>
      </section>

      {message && (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="status"
        >
          {message}
        </p>
      )}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky left-0 bg-slate-50 px-5 py-3">Kode Akun</th>
                <th className="px-4 py-3">Nama Akun</th>
                <th className="px-4 py-3">Klasifikasi</th>
                <th className="px-4 py-3">Saldo Normal</th>
                {mode === "opening" ? (
                  <>
                    <th className="px-4 py-3 text-right">Debit Awal (Rp)</th>
                    <th className="px-4 py-3 text-right">Kredit Awal (Rp)</th>
                    <th className="px-4 py-3">Catatan</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-right">Saldo Berjalan</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-muted"
                    colSpan={mode === "opening" ? 7 : 7}
                  >
                    Memuat CoA...
                  </td>
                </tr>
              )}
              {!loading &&
                visibleAccounts.map((account, index) => {
                  const line = balances[account.id] ?? {
                    accountId: account.id,
                    debitAmount: "0,00",
                    creditAmount: "0,00",
                    notes: "",
                  };
                  const agg = accountAggregates.get(account.id) ?? {
                    debitSen: 0,
                    creditSen: 0,
                    runningBalanceSen: 0,
                  };

                  return (
                    <tr
                      className={`${
                        account.isGroup
                          ? account.level === 1
                            ? "bg-slate-100 font-bold"
                            : "bg-slate-50/80 font-semibold text-slate-800"
                          : index % 2
                            ? "bg-slate-50/40"
                            : "bg-white"
                      }`}
                      key={account.id}
                    >
                      <td className="sticky left-0 bg-inherit px-5 py-2 font-mono tabular-nums text-slate-700">
                        <span
                          className="inline-flex items-center"
                          style={{ paddingLeft: `${(account.level - 1) * 18}px` }}
                        >
                          {account.level > 1 ? (
                            <ChevronRight className="mr-1 inline text-slate-300" size={14} />
                          ) : null}
                          <input
                            aria-label={`Kode ${account.code}`}
                            className={`w-20 rounded-md border border-transparent bg-transparent px-1 py-1 hover:border-slate-200 focus:border-brand focus:outline-none ${account.isGroup ? "font-bold text-slate-900 cursor-default" : ""}`}
                            disabled={account.isGroup}
                            defaultValue={account.code}
                            onBlur={(event) => {
                              if (
                                /^(\d{4}|\d-\d{4})$/.test(event.currentTarget.value) &&
                                event.currentTarget.value !== account.code
                              )
                                void updateAccount(account, { code: event.currentTarget.value });
                            }}
                          />
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          aria-label={`Nama ${account.code}`}
                          className={`w-full rounded-md border border-transparent bg-transparent px-2 py-1 hover:border-slate-200 focus:border-brand focus:outline-none ${account.isGroup ? "font-bold text-slate-900 cursor-default" : "font-medium"}`}
                          disabled={account.isGroup}
                          defaultValue={account.name}
                          onBlur={(event) => {
                            if (
                              event.currentTarget.value.trim() &&
                              event.currentTarget.value !== account.name
                            )
                              void updateAccount(account, {
                                name: event.currentTarget.value.trim(),
                              });
                          }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          aria-label={`Klasifikasi ${account.code}`}
                          className="rounded-md border border-transparent bg-transparent px-2 py-1 text-xs hover:border-slate-200 disabled:opacity-80"
                          disabled={account.isGroup}
                          defaultValue={account.classification}
                          onChange={(event) =>
                            void updateAccount(account, { classification: event.target.value })
                          }
                        >
                          <option value="ASET_LANCAR">ASET LANCAR</option>
                          <option value="ASET_TIDAK_LANCAR">ASET TIDAK LANCAR</option>
                          <option value="KEWAJIBAN_LANCAR">KEWAJIBAN LANCAR</option>
                          <option value="EKUITAS">EKUITAS</option>
                          <option value="PENDAPATAN">PENDAPATAN</option>
                          <option value="BEBAN_POKOK">BEBAN POKOK</option>
                          <option value="BEBAN_OPERASIONAL">BEBAN OPERASIONAL</option>
                          <option value="BEBAN_NON_OPERASIONAL">BEBAN NON OPERASIONAL</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <select
                          aria-label={`Saldo normal ${account.code}`}
                          className={
                            account.normalBalance === "DEBIT"
                              ? "rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-semibold text-blue-700 disabled:text-blue-900"
                              : "rounded-md border border-transparent bg-transparent px-2 py-1 text-xs font-semibold text-emerald-700 disabled:text-emerald-900"
                          }
                          disabled={account.isGroup}
                          value={account.normalBalance}
                          onChange={(event) =>
                            handleNormalBalanceChange(
                              account,
                              event.target.value as "DEBIT" | "KREDIT",
                            )
                          }
                        >
                          <option value="DEBIT">DEBIT</option>
                          <option value="KREDIT">KREDIT</option>
                        </select>
                      </td>
                      {mode === "opening" ? (
                        account.isGroup ? (
                          <>
                            <td className="px-4 py-2">
                              <input
                                aria-label={`Debit ${account.code}`}
                                className="w-full rounded-md border border-slate-200/60 bg-slate-100/70 px-2 py-1 text-right font-mono font-bold tabular-nums text-slate-700 cursor-not-allowed"
                                disabled
                                value={formatSen(agg.debitSen)}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                aria-label={`Kredit ${account.code}`}
                                className="w-full rounded-md border border-slate-200/60 bg-slate-100/70 px-2 py-1 text-right font-mono font-bold tabular-nums text-slate-700 cursor-not-allowed"
                                disabled
                                value={formatSen(agg.creditSen)}
                              />
                            </td>
                            <td className="px-4 py-2 text-xs italic text-slate-400">
                              (Akumulasi sub-akun)
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2">
                              <input
                                aria-label={`Debit ${account.code}`}
                                className={`w-full rounded-md border px-2 py-1 text-right font-mono tabular-nums ${
                                  account.normalBalance === "DEBIT"
                                    ? "border-slate-200 bg-white hover:border-slate-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    : "border-slate-200/60 bg-slate-100/70 text-slate-400 cursor-not-allowed"
                                }`}
                                disabled={account.normalBalance !== "DEBIT"}
                                onBlur={(event) =>
                                  formatBalanceOnBlur(account.id, "debitAmount", event.target.value)
                                }
                                onChange={(event) =>
                                  updateBalance(account.id, "debitAmount", event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    const currentIndex = visibleAccounts.findIndex(
                                      (a) => a.id === account.id,
                                    );
                                    for (
                                      let i = currentIndex + 1;
                                      i < visibleAccounts.length;
                                      i++
                                    ) {
                                      const nextAcc = visibleAccounts[i];
                                      if (nextAcc && !nextAcc.isGroup) {
                                        const targetAriaLabel =
                                          nextAcc.normalBalance === "DEBIT"
                                            ? `Debit ${nextAcc.code}`
                                            : `Kredit ${nextAcc.code}`;
                                        const targetInput =
                                          document.querySelector<HTMLInputElement>(
                                            `[aria-label='${targetAriaLabel}']`,
                                          );
                                        targetInput?.focus();
                                        targetInput?.select();
                                        break;
                                      }
                                    }
                                  }
                                }}
                                value={
                                  account.normalBalance === "DEBIT" ? line.debitAmount : "0,00"
                                }
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                aria-label={`Kredit ${account.code}`}
                                className={`w-full rounded-md border px-2 py-1 text-right font-mono tabular-nums ${
                                  account.normalBalance === "KREDIT"
                                    ? "border-slate-200 bg-white hover:border-slate-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    : "border-slate-200/60 bg-slate-100/70 text-slate-400 cursor-not-allowed"
                                }`}
                                disabled={account.normalBalance !== "KREDIT"}
                                onBlur={(event) =>
                                  formatBalanceOnBlur(
                                    account.id,
                                    "creditAmount",
                                    event.target.value,
                                  )
                                }
                                onChange={(event) =>
                                  updateBalance(account.id, "creditAmount", event.target.value)
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    const currentIndex = visibleAccounts.findIndex(
                                      (a) => a.id === account.id,
                                    );
                                    for (
                                      let i = currentIndex + 1;
                                      i < visibleAccounts.length;
                                      i++
                                    ) {
                                      const nextAcc = visibleAccounts[i];
                                      if (nextAcc && !nextAcc.isGroup) {
                                        const targetAriaLabel =
                                          nextAcc.normalBalance === "DEBIT"
                                            ? `Debit ${nextAcc.code}`
                                            : `Kredit ${nextAcc.code}`;
                                        const targetInput =
                                          document.querySelector<HTMLInputElement>(
                                            `[aria-label='${targetAriaLabel}']`,
                                          );
                                        targetInput?.focus();
                                        targetInput?.select();
                                        break;
                                      }
                                    }
                                  }
                                }}
                                value={
                                  account.normalBalance === "KREDIT" ? line.creditAmount : "0,00"
                                }
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                aria-label={`Catatan ${account.code}`}
                                className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-brand focus:outline-none"
                                onChange={(event) =>
                                  updateBalance(account.id, "notes", event.target.value)
                                }
                                value={line.notes ?? ""}
                              />
                            </td>
                          </>
                        )
                      ) : (
                        <>
                          <td
                            className={`px-4 py-3 text-right font-mono tabular-nums ${
                              account.isGroup ? "font-bold text-slate-800" : "text-slate-600"
                            }`}
                          >
                            Rp {formatSen(agg.runningBalanceSen)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <label className="inline-flex items-center gap-2 text-xs text-emerald-700">
                              <input
                                aria-label={`Aktif ${account.code}`}
                                disabled={account.isGroup}
                                checked={account.isActive}
                                onChange={(event) =>
                                  void updateAccount(account, { isActive: event.target.checked })
                                }
                                type="checkbox"
                              />
                              Aktif
                            </label>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              aria-label={`Hapus ${account.code}`}
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
                              disabled={account.isGroup}
                              onClick={() => handleDeleteAccount(account.id)}
                              type="button"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {mode === "structure" && (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex-1 text-xs font-semibold text-slate-500">
              Kode akun
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setNewAccount({ ...newAccount, code: event.target.value })}
                placeholder="Contoh 1210"
                value={newAccount.code}
              />
            </label>
            <label className="flex-[2] text-xs font-semibold text-slate-500">
              Nama akun
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                onChange={(event) => setNewAccount({ ...newAccount, name: event.target.value })}
                placeholder="Nama akun baru"
                value={newAccount.name}
              />
            </label>
            <select
              aria-label="Induk akun baru"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              onChange={(event) => {
                const parent = accounts.find((account) => account.id === event.target.value);
                setNewAccount({
                  ...newAccount,
                  parentId: event.target.value,
                  level: parent ? parent.level + 1 : 1,
                });
              }}
              value={newAccount.parentId}
            >
              <option value="">Tanpa induk</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Klasifikasi akun baru"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              onChange={(event) =>
                setNewAccount({
                  ...newAccount,
                  classification: event.target.value,
                  normalBalance: ["KEWAJIBAN_LANCAR", "EKUITAS", "PENDAPATAN"].includes(
                    event.target.value,
                  )
                    ? "KREDIT"
                    : "DEBIT",
                })
              }
              value={newAccount.classification}
            >
              <option value="ASET_LANCAR">Aset Lancar</option>
              <option value="KEWAJIBAN_LANCAR">Kewajiban</option>
              <option value="EKUITAS">Ekuitas</option>
              <option value="PENDAPATAN">Pendapatan</option>
              <option value="BEBAN_OPERASIONAL">Beban Operasional</option>
            </select>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              onClick={addAccount}
              type="button"
            >
              <Plus size={16} /> Tambah Akun
            </button>
          </div>
        </section>
      )}

      {mode === "opening" && (
        <div
          className={`sticky bottom-3 z-20 flex flex-col gap-4 rounded-2xl border p-4 shadow-lg md:flex-row md:items-center md:justify-between ${totals.difference.isZero() ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}
        >
          <div className="grid grid-cols-3 gap-5 text-sm">
            <div>
              <p className="text-xs text-slate-500">Total Debit Awal</p>
              <p className="mt-1 font-mono font-bold tabular-nums">
                Rp {formatSen(totals.totalDebitSen)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Kredit Awal</p>
              <p className="mt-1 font-mono font-bold tabular-nums">
                Rp {formatSen(totals.totalCreditSen)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Selisih</p>
              <p
                className={`mt-1 font-mono font-bold tabular-nums ${totals.difference.isZero() ? "text-emerald-700" : "text-red-700"}`}
              >
                Rp {formatSen(Math.abs(totals.totalDebitSen - totals.totalCreditSen))}
                {!totals.difference.isZero() && (
                  <span className="ml-1 text-xs font-normal text-slate-500">
                    ({totals.difference.isPositive() ? "Debit > Kredit" : "Kredit > Debit"})
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${totals.difference.isZero() ? "bg-white text-emerald-700" : "bg-white text-red-700"}`}
            >
              {totals.difference.isZero() ? <Check size={14} /> : <span>!</span>}{" "}
              {totals.difference.isZero() ? "Seimbang" : "Belum seimbang"}
            </span>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={totals.difference.isZero()}
              onClick={autoBalance}
              type="button"
            >
              <WandSparkles size={16} /> Alokasikan Selisih
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!totals.difference.isZero()}
              onClick={saveAndLock}
              type="button"
            >
              <Save size={16} /> Simpan Saldo Awal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoAPage;
