import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
} from "lucide-react";
import { senToRupiah, todayIsoDate } from "@keuangan-apotek/shared";
import { getBalanceReport, queryKeys, type BalanceReport } from "../../lib/queries";

function formatSen(value: number): string {
  const rupiah = senToRupiah(value);
  const fixed = rupiah.toFixed(2);
  const [whole, fraction] = fixed.split(".");
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}

type NeracaSummaryTableProps = {
  asOfDate?: string;
  selectedAccountIds?: string[];
  selectedAccountId?: string | null;
  onSelectAccount?: (accountId: string | null) => void;
  onToggleAccount?: (accountId: string) => void;
  onClearAccounts?: () => void;
  onClose?: () => void;
};

type GroupKey = "ALL" | "ASSETS" | "LIABILITIES" | "EQUITY";

export function NeracaSummaryTable({
  asOfDate,
  selectedAccountIds,
  selectedAccountId,
  onSelectAccount,
  onToggleAccount,
  onClearAccounts,
  onClose,
}: NeracaSummaryTableProps) {
  const targetDate = asOfDate || todayIsoDate();
  const [activeTab, setActiveTab] = useState<GroupKey>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const activeAccountIds = useMemo(() => {
    if (selectedAccountIds !== undefined) return selectedAccountIds;
    if (selectedAccountId) return [selectedAccountId];
    return [];
  }, [selectedAccountIds, selectedAccountId]);

  const { data: balanceReport, isLoading } = useQuery<BalanceReport>({
    queryKey: queryKeys.balanceReport(targetDate),
    queryFn: () => getBalanceReport(targetDate),
  });

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const sections = balanceReport?.sections ?? [];

  // Filter sections and accounts based on activeTab and searchQuery
  const filteredSections = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return sections
      .filter((section) => {
        if (activeTab === "ALL") return true;
        return section.key === activeTab;
      })
      .map((section) => {
        const rows = section.rows.filter((row) => {
          if (!q) return true;
          return (
            row.code.toLowerCase().includes(q) ||
            row.name.toLowerCase().includes(q) ||
            (row.classification && row.classification.toLowerCase().includes(q))
          );
        });
        return {
          ...section,
          rows,
        };
      })
      .filter((section) => section.rows.length > 0 || !searchQuery);
  }, [sections, activeTab, searchQuery]);

  const totalNeracaAccounts = useMemo(() => {
    return sections.reduce((acc, s) => acc + s.rows.length, 0);
  }, [sections]);

  const totalAssets = balanceReport?.totalAssets ?? 0;
  const totalLiabilities = balanceReport?.totalLiabilities ?? 0;
  const totalEquity = balanceReport?.totalEquity ?? 0;
  const isBalanced = balanceReport?.isBalanced ?? true;
  const difference = balanceReport?.difference ?? 0;

  return (
    <section className="rounded border border-slate-200 bg-white p-1.5 space-y-1">
      {/* Header and Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-1 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <Building2 size={13} className="text-brand shrink-0" />
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 shrink-0">
            Saldo Akhir Neraca
          </h3>
          <span className="text-[10px] text-muted truncate">
            (Live Ending Balance per {targetDate})
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {/* Accounting Equation Badge */}
          <div
            className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
              isBalanced
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {isBalanced ? (
              <>
                <CheckCircle2 size={11} className="text-emerald-600" />
                <span>Seimbang</span>
              </>
            ) : (
              <>
                <AlertTriangle size={11} className="text-red-600" />
                <span>Selisih: Rp {formatSen(difference)}</span>
              </>
            )}
          </div>

          {activeAccountIds.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                {activeAccountIds.length}/2 akun aktif
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onClearAccounts) onClearAccounts();
                  else if (onSelectAccount) onSelectAccount(null);
                }}
                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 transition"
                title="Batalkan filter akun"
              >
                <RotateCcw size={10} />
                <span>Reset Filter</span>
              </button>
            </div>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
              title="Tutup tabel neraca"
            >
              <X size={11} />
              <span>Tutup</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
              activeTab === "ALL"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua ({totalNeracaAccounts})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ASSETS")}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition ${
              activeTab === "ASSETS"
                ? "bg-brand text-white"
                : "bg-blue-50 text-brand hover:bg-blue-100"
            }`}
          >
            Aset (Rp {formatSen(totalAssets)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("LIABILITIES")}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition ${
              activeTab === "LIABILITIES"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            Kewajiban (Rp {formatSen(totalLiabilities)})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("EQUITY")}
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition ${
              activeTab === "EQUITY"
                ? "bg-purple-600 text-white"
                : "bg-purple-50 text-purple-700 hover:bg-purple-100"
            }`}
          >
            Ekuitas (Rp {formatSen(totalEquity)})
          </button>
        </div>

        <div className="relative w-48">
          <Search size={11} className="absolute left-2 top-1.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari kode / akun..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-slate-200 bg-white pl-6 pr-2 py-0.5 text-xs outline-none focus:border-brand"
          />
        </div>
      </div>

      {/* Neraca Accounts Table */}
      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700">
              <tr>
                <th className="px-2 py-1 w-20 border-r border-slate-200">Kode</th>
                <th className="px-2 py-1 min-w-[180px] border-r border-slate-200">Nama Akun</th>
                <th className="px-2 py-1 w-32 border-r border-slate-200">Kategori</th>
                <th className="px-2 py-1 w-16 text-center border-r border-slate-200">Normal</th>
                <th className="px-2 py-1 w-36 text-right border-r border-slate-200">
                  Saldo Akhir (Rp)
                </th>
                <th className="px-2 py-1 w-16 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-muted">
                    Memuat saldo akun neraca...
                  </td>
                </tr>
              ) : filteredSections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-4 text-center text-muted">
                    Tidak ada akun neraca yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredSections.map((section) => {
                  const isCollapsed = Boolean(collapsedSections[section.key]);

                  const headerBadgeClass =
                    section.key === "ASSETS"
                      ? "bg-blue-100 text-blue-900 border-blue-200"
                      : section.key === "LIABILITIES"
                        ? "bg-amber-100 text-amber-900 border-amber-200"
                        : "bg-purple-100 text-purple-900 border-purple-200";

                  return (
                    <Fragment key={section.key}>
                      {/* Section Group Header */}
                      <tr className="bg-slate-100/90 font-medium">
                        <td colSpan={6} className="px-2 py-1 border-b border-slate-200">
                          <button
                            type="button"
                            onClick={() => toggleSection(section.key)}
                            className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-800 hover:text-brand transition"
                          >
                            <div className="flex items-center gap-1.5">
                              {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                              <span>{section.label}</span>
                              <span
                                className={`rounded px-1 py-0 text-[10px] font-semibold border ${headerBadgeClass}`}
                              >
                                {section.rows.length} Akun
                              </span>
                            </div>
                            <span className="font-mono text-xs tabular-nums text-slate-700">
                              Subtotal: Rp {formatSen(section.total)}
                            </span>
                          </button>
                        </td>
                      </tr>

                      {/* Section Account Rows */}
                      {!isCollapsed &&
                        section.rows.map((row, rowIdx) => {
                          const isSelected = activeAccountIds.includes(row.accountId);
                          const isNegative = row.balance < 0;

                          const normalBalance =
                            (row as any).normalBalance ||
                            (section.key === "ASSETS" ? "DEBIT" : "KREDIT");

                          return (
                            <tr
                              key={row.accountId}
                              onClick={() => {
                                if (onToggleAccount) {
                                  onToggleAccount(row.accountId);
                                } else if (onSelectAccount) {
                                  onSelectAccount(isSelected ? null : row.accountId);
                                }
                              }}
                              className={`cursor-pointer transition select-none ${
                                isSelected
                                  ? "bg-blue-100/80 font-medium text-blue-950 border-l-2 border-l-brand"
                                  : rowIdx % 2 === 0
                                    ? "bg-white hover:bg-blue-50/50"
                                    : "bg-slate-50/70 hover:bg-blue-50/50"
                              }`}
                            >
                              {/* Account Code */}
                              <td className="px-2 py-1 font-mono text-xs tabular-nums border-r border-slate-100">
                                {row.code}
                              </td>

                              {/* Account Name */}
                              <td className="px-2 py-1 border-r border-slate-100">
                                <span
                                  className={
                                    isSelected ? "font-semibold text-brand" : "text-slate-900"
                                  }
                                >
                                  {row.name}
                                </span>
                              </td>

                              {/* Category / Classification */}
                              <td className="px-2 py-1 text-[11px] text-slate-500 border-r border-slate-100 truncate">
                                {(row as any).classification?.replace(/_/g, " ") || section.label}
                              </td>

                              {/* Normal Balance */}
                              <td className="px-2 py-1 text-center text-[10px] font-semibold border-r border-slate-100">
                                <span
                                  className={
                                    normalBalance === "DEBIT"
                                      ? "text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded"
                                      : "text-amber-700 bg-amber-50 px-1 py-0.5 rounded"
                                  }
                                >
                                  {normalBalance === "DEBIT" ? "D" : "K"}
                                </span>
                              </td>

                              {/* Ending Balance */}
                              <td
                                className={`px-2 py-1 text-right font-mono text-xs tabular-nums border-r border-slate-100 font-semibold ${
                                  isNegative ? "text-red-600" : "text-slate-900"
                                }`}
                              >
                                Rp {formatSen(row.balance)}
                              </td>

                              {/* Filter Status */}
                              <td className="px-2 py-1 text-center whitespace-nowrap">
                                {isSelected ? (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap">
                                    <Filter size={9} /> Aktif
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 group-hover:text-slate-600">
                                    Pilih
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
