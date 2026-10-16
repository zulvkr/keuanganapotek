import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Columns,
  Printer,
  RefreshCw,
  Rows,
} from "lucide-react";
import { senToRupiah, todayIsoDate } from "@keuangan-apotek/shared";
import DrillDownDrawer from "../components/drilldown/DrillDownDrawer";
import {
  getBalanceReport,
  getCashFlowReport,
  getDrillDown,
  getIncomeReport,
  queryKeys,
  type CashFlowReport,
} from "../lib/queries";

type Tab = "income" | "income-comparative" | "balance" | "cash-flow";
type DatePreset = "THIS_MONTH" | "PREV_MONTH" | "THIS_YEAR" | "CUSTOM";
type Period = { startDate: string; endDate: string };
type IncomeRow = {
  accountId: string;
  code: string;
  name: string;
  classification: string;
  amount: number;
  compareAmount: number;
  variance: number;
  growthPercent: number | null;
};
type ReportTotal = {
  amount: number;
  compareAmount: number;
  variance: number;
  growthPercent: number | null;
};
type IncomeSection = { key: string; label: string; rows: IncomeRow[]; total: ReportTotal };
type IncomeReport = {
  period: Period;
  comparePeriod: Period | null;
  sections: IncomeSection[];
  revenue: ReportTotal;
  cogs: ReportTotal;
  grossProfit: ReportTotal;
  operatingExpenses: ReportTotal;
  nonOperatingExpenses: ReportTotal;
  netProfit: ReportTotal;
};
type BalanceRow = {
  accountId: string;
  code: string;
  name: string;
  balance: number;
  classification?: string;
  normalBalance?: string;
};
type BalanceReport = {
  asOfDate: string;
  sections: Array<{ key: string; label: string; rows: BalanceRow[]; total: number }>;
  currentEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  difference: number;
  isBalanced: boolean;
};
type DrillDown = {
  account: { code: string; name: string };
  entries: Array<{
    lineId: string;
    journalNo: string;
    entryDate: string;
    referenceNo: string | null;
    memo: string | null;
    sourceModule: string;
    description: string | null;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
};

const inputClass =
  "rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono tabular-nums outline-none focus:border-brand focus:ring-1 focus:ring-brand";

function formatMoney(value: number): string {
  const decimal = senToRupiah(value);
  const sign = decimal.isNegative() ? "-" : "";
  const parts = decimal.abs().toFixed(2).split(".");
  return sign + parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + parts[1];
}

function formatAbsoluteMoney(value: number): string {
  const parts = senToRupiah(value).abs().toFixed(2).split(".");
  return parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + parts[1];
}

function formatCurrency(value: number): string {
  const decimal = senToRupiah(value);
  const sign = decimal.isNegative() ? "-Rp " : "Rp ";
  const parts = decimal.abs().toFixed(2).split(".");
  return sign + parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + parts[1];
}

function ReportAmount({
  value,
  onClick,
  className,
}: {
  value: number;
  onClick?: () => void;
  className?: string;
}) {
  const content = formatCurrency(value);
  return onClick ? (
    <button
      className={`font-mono tabular-nums text-right text-brand underline decoration-blue-200 underline-offset-2 hover:decoration-brand text-xs ${className ?? ""}`}
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  ) : (
    <span className={`font-mono tabular-nums text-xs ${className ?? ""}`}>{content}</span>
  );
}

function getMonthDates(offsetMonths = 0): Period {
  const today = todayIsoDate();
  const [y, m] = today.split("-").map(Number);
  const target = new Date(Date.UTC(y!, m! - 1 + offsetMonths, 1));
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    startDate: `${year}-${mm}-01`,
    endDate: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function SinglePeriodSectionTable({
  section,
  openDrillDown,
}: {
  section: IncomeSection;
  openDrillDown: (row: IncomeRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
          <tr>
            <th className="px-2 py-1">Akun</th>
            <th className="px-2 py-1 text-right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row, index) => (
            <tr
              className={
                (index % 2 ? "bg-slate-50/60" : "bg-white") +
                " hover:bg-blue-50/40 border-b border-slate-100"
              }
              key={row.accountId}
            >
              <td className="px-2 py-1">
                <span className="font-mono font-semibold tabular-nums text-slate-700">
                  {row.code}
                </span>
                <span className="ml-1.5 text-slate-800">{row.name}</span>
              </td>
              <td className="px-2 py-1 text-right">
                <ReportAmount onClick={() => openDrillDown(row)} value={row.amount} />
              </td>
            </tr>
          ))}
          {section.rows.length === 0 && (
            <tr>
              <td colSpan={2} className="px-2 py-2 text-center text-slate-400 italic">
                Tidak ada akun pada kategori ini
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-100 font-semibold text-slate-800">
            <td className="px-2 py-1">Total {section.label}</td>
            <td className="px-2 py-1 text-right">
              <ReportAmount value={section.total.amount} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ComparativeTable({
  section,
  openDrillDown,
}: {
  section: IncomeSection;
  openDrillDown: (row: IncomeRow) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs">
        <thead className="sticky top-0 bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
          <tr>
            <th className="px-2 py-1">Akun</th>
            <th className="px-2 py-1 text-right">Bulan Berjalan</th>
            <th className="px-2 py-1 text-right">Bulan Pembanding</th>
            <th className="px-2 py-1 text-right">Varians</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row, index) => (
            <tr
              className={
                (index % 2 ? "bg-slate-50/60" : "bg-white") +
                " hover:bg-blue-50/40 border-b border-slate-100"
              }
              key={row.accountId}
            >
              <td className="px-2 py-1">
                <span className="font-mono font-semibold tabular-nums text-slate-700">
                  {row.code}
                </span>
                <span className="ml-1.5 text-slate-800">{row.name}</span>
              </td>
              <td className="px-2 py-1 text-right">
                <ReportAmount onClick={() => openDrillDown(row)} value={row.amount} />
              </td>
              <td className="px-2 py-1 text-right">
                <ReportAmount value={row.compareAmount} />
              </td>
              <td
                className={
                  "px-2 py-1 text-right font-mono tabular-nums text-xs " +
                  (row.variance >= 0 ? "text-emerald-700" : "text-red-700")
                }
              >
                {row.variance >= 0 ? "+" : "−"}Rp {formatAbsoluteMoney(row.variance)}{" "}
                <span className="ml-1 text-[11px]">
                  ({row.growthPercent === null ? "—" : row.growthPercent.toFixed(2) + "%"})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-100 font-semibold text-slate-800">
            <td className="px-2 py-1">Total {section.label}</td>
            <td className="px-2 py-1 text-right">
              <ReportAmount value={section.total.amount} />
            </td>
            <td className="px-2 py-1 text-right">
              <ReportAmount value={section.total.compareAmount} />
            </td>
            <td className="px-2 py-1 text-right font-mono tabular-nums text-xs">
              {section.total.growthPercent === null
                ? "—"
                : section.total.growthPercent.toFixed(2) + "%"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function ReportsPage() {
  const today = todayIsoDate();
  const initialMonth = getMonthDates(0);
  const initialPrevMonth = getMonthDates(-1);
  const [tab, setTab] = useState<Tab>("income");
  const [activePreset, setActivePreset] = useState<DatePreset>("THIS_MONTH");
  const [neracaFormat, setNeracaFormat] = useState<"skontro" | "stafel">("skontro");
  const [periodStart, setPeriodStart] = useState(initialMonth.startDate);
  const [periodEnd, setPeriodEnd] = useState(initialMonth.endDate);
  const [compareStart, setCompareStart] = useState(initialPrevMonth.startDate);
  const [compareEnd, setCompareEnd] = useState(initialPrevMonth.endDate);
  const [message, setMessage] = useState("");
  const [drillTarget, setDrillTarget] = useState<{ accountId: string; period: Period } | null>(
    null,
  );

  function applyPreset(preset: "THIS_MONTH" | "PREV_MONTH" | "THIS_YEAR") {
    if (preset === "THIS_MONTH") {
      const current = getMonthDates(0);
      const prev = getMonthDates(-1);
      setPeriodStart(current.startDate);
      setPeriodEnd(tab === "balance" ? today : current.endDate);
      setCompareStart(prev.startDate);
      setCompareEnd(prev.endDate);
      setActivePreset("THIS_MONTH");
    } else if (preset === "PREV_MONTH") {
      const prev = getMonthDates(-1);
      const prevPrev = getMonthDates(-2);
      setPeriodStart(prev.startDate);
      setPeriodEnd(prev.endDate);
      setCompareStart(prevPrev.startDate);
      setCompareEnd(prevPrev.endDate);
      setActivePreset("PREV_MONTH");
    } else if (preset === "THIS_YEAR") {
      const year = today.slice(0, 4);
      setPeriodStart(`${year}-01-01`);
      setPeriodEnd(tab === "balance" ? today : `${year}-12-31`);
      setCompareStart(`${Number(year) - 1}-01-01`);
      setCompareEnd(`${Number(year) - 1}-12-31`);
      setActivePreset("THIS_YEAR");
    }
  }

  const incomeStandardQuery = useQuery({
    queryKey: queryKeys.incomeReport({
      periodStart,
      periodEnd,
    }),
    queryFn: () =>
      getIncomeReport({
        periodStart,
        periodEnd,
      }),
    enabled: tab === "income",
  });
  const incomeComparativeQuery = useQuery({
    queryKey: queryKeys.incomeReport({
      periodStart,
      periodEnd,
      compareStartDate: compareStart,
      compareEndDate: compareEnd,
    }),
    queryFn: () =>
      getIncomeReport({
        periodStart,
        periodEnd,
        compareStartDate: compareStart,
        compareEndDate: compareEnd,
      }),
    enabled: tab === "income-comparative",
  });
  const balanceQuery = useQuery({
    queryKey: queryKeys.balanceReport(periodEnd),
    queryFn: () => getBalanceReport(periodEnd),
    enabled: tab === "balance",
  });
  const cashFlowQuery = useQuery({
    queryKey: queryKeys.cashFlowReport({ startDate: periodStart, endDate: periodEnd }),
    queryFn: () => getCashFlowReport({ startDate: periodStart, endDate: periodEnd }),
    enabled: tab === "cash-flow",
  });
  const reportQuery =
    tab === "income"
      ? incomeStandardQuery
      : tab === "income-comparative"
        ? incomeComparativeQuery
        : tab === "balance"
          ? balanceQuery
          : cashFlowQuery;
  const income = (tab === "income" ? incomeStandardQuery.data : incomeComparativeQuery.data) as
    | IncomeReport
    | undefined;
  const balance = balanceQuery.data as BalanceReport | undefined;
  const cashFlow = cashFlowQuery.data as CashFlowReport | undefined;
  const loading = reportQuery.isLoading;
  const reportError = reportQuery.error instanceof Error ? reportQuery.error.message : "";
  const drillQuery = useQuery({
    queryKey: drillTarget
      ? queryKeys.drillDown(drillTarget.accountId, drillTarget.period)
      : ["reports", "drill-down", "inactive"],
    queryFn: () => getDrillDown(drillTarget!.accountId, drillTarget!.period),
    enabled: Boolean(drillTarget),
  });
  const drillDown = drillQuery.data as DrillDown | undefined;
  const drillLoading = drillQuery.isFetching;
  const drillError = drillQuery.error instanceof Error ? drillQuery.error.message : "";

  const currentPeriod = useMemo(
    () => ({ startDate: periodStart, endDate: periodEnd }),
    [periodStart, periodEnd],
  );

  function openDrillDown(accountId: string, period = currentPeriod) {
    setDrillTarget({ accountId, period });
  }

  function incomeStandardView() {
    if (!income) return null;
    return (
      <div className="space-y-2">
        {/* Status Toolbar */}
        <div className="flex items-center justify-between border border-slate-200 bg-white px-2 py-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <BarChart3 size={13} className="text-brand" />
            <span>
              Laba Rugi Standar (Periode {periodStart} s/d {periodEnd})
            </span>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
            title="Cetak Laporan Laba Rugi"
          >
            <Printer size={12} />
            <span>Cetak</span>
          </button>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-1.5 text-xs">
          <div className="rounded border border-slate-200 bg-white p-2">
            <div className="text-[10px] font-semibold uppercase text-slate-500">Pendapatan</div>
            <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
              Rp {formatMoney(income.revenue.amount)}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2">
            <div className="text-[10px] font-semibold uppercase text-slate-500">HPP Obat</div>
            <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
              Rp {formatMoney(income.cogs.amount)}
            </div>
          </div>
          <div className="rounded border border-blue-200 bg-blue-50/50 p-2">
            <div className="text-[10px] font-semibold uppercase text-blue-700">Laba Kotor</div>
            <div className="font-mono text-xs font-bold text-blue-900 mt-0.5">
              Rp {formatMoney(income.grossProfit.amount)}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2">
            <div className="text-[10px] font-semibold uppercase text-slate-500">
              Beban Operasional
            </div>
            <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
              Rp {formatMoney(income.operatingExpenses.amount)}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2">
            <div className="text-[10px] font-semibold uppercase text-slate-500">
              Beban Non-Operasional
            </div>
            <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
              Rp {formatMoney(income.nonOperatingExpenses.amount)}
            </div>
          </div>
          <div
            className={`rounded border p-2 ${
              income.netProfit.amount >= 0
                ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                : "border-red-300 bg-red-50 text-red-900"
            }`}
          >
            <div className="text-[10px] font-semibold uppercase">Laba Bersih</div>
            <div className="font-mono text-xs font-bold mt-0.5">
              Rp {formatMoney(income.netProfit.amount)}
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-1.5 border border-slate-300 bg-white shadow-xs p-3">
          <div className="text-center py-2 border-b-2 border-slate-900 mb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Laporan Laba Rugi
            </h2>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              Periode {periodStart} s/d {periodEnd}
            </div>
          </div>

          {income.sections.map((section) => (
            <section className="border border-slate-200 bg-white" key={section.key}>
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-1">
                <h3 className="text-xs font-bold text-slate-800">{section.label}</h3>
                <span className="text-[11px] text-slate-500">
                  Klik nominal untuk rincian jurnal
                </span>
              </div>
              <SinglePeriodSectionTable
                openDrillDown={(row) => void openDrillDown(row.accountId)}
                section={section}
              />
            </section>
          ))}

          {/* Bottom Line Summary */}
          <div className="border-t-2 border-b-2 border-slate-900 bg-slate-100 px-3 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-900 mt-3">
            <span>Laba / (Rugi) Bersih Periode Berjalan</span>
            <span
              className={`font-mono text-sm font-bold tabular-nums ${
                income.netProfit.amount >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {formatCurrency(income.netProfit.amount)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  function incomeComparativeView() {
    if (!income) return null;
    return (
      <div className="space-y-1.5">
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="px-2 py-1 text-left">Ringkasan Laba Rugi</th>
                <th className="px-2 py-1 text-right">Pendapatan</th>
                <th className="px-2 py-1 text-right">HPP</th>
                <th className="px-2 py-1 text-right">Laba Kotor</th>
                <th className="px-2 py-1 text-right">Beban Operasional</th>
                <th className="px-2 py-1 text-right">Laba Bersih Usaha</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white font-mono tabular-nums font-semibold">
                <td className="px-2 py-1 font-sans text-slate-500 font-medium">Bulan Berjalan</td>
                <td className="px-2 py-1 text-right text-slate-800">
                  Rp {formatMoney(income.revenue.amount)}
                </td>
                <td className="px-2 py-1 text-right text-slate-800">
                  Rp {formatMoney(income.cogs.amount)}
                </td>
                <td className="px-2 py-1 text-right text-slate-800">
                  Rp {formatMoney(income.grossProfit.amount)}
                </td>
                <td className="px-2 py-1 text-right text-slate-800">
                  Rp {formatMoney(income.operatingExpenses.amount)}
                </td>
                <td
                  className={`px-2 py-1 text-right ${income.netProfit.amount >= 0 ? "text-emerald-700" : "text-red-700"}`}
                >
                  Rp {formatMoney(income.netProfit.amount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="space-y-1.5">
          {income.sections.map((section) => (
            <section className="border border-slate-200 bg-white" key={section.key}>
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2 py-1">
                <h3 className="text-xs font-bold text-slate-800">{section.label}</h3>
                <span className="text-[11px] text-slate-500">
                  Klik nominal bulan berjalan untuk rincian jurnal
                </span>
              </div>
              <ComparativeTable
                openDrillDown={(row) => void openDrillDown(row.accountId)}
                section={section}
              />
            </section>
          ))}
        </div>
      </div>
    );
  }

  function balanceView() {
    if (!balance) return null;

    const assetSection = balance.sections.find((s) => s.key === "ASSETS");
    const liabilitySection = balance.sections.find((s) => s.key === "LIABILITIES");
    const equitySection = balance.sections.find((s) => s.key === "EQUITY");

    const assetRows = assetSection?.rows ?? [];
    const isCurrentAsset = (r: BalanceRow) =>
      r.classification === "ASET_LANCAR" ||
      (!r.classification &&
        (r.code.startsWith("11") ||
          r.code.startsWith("12") ||
          r.code.startsWith("13") ||
          r.code.startsWith("14") ||
          r.code.startsWith("15")));

    const currentAssets = assetRows.filter(isCurrentAsset);
    const fixedAssets = assetRows.filter((r) => !isCurrentAsset(r));

    const totalCurrentAssets = currentAssets.reduce((sum, r) => sum + r.balance, 0);
    const totalFixedAssets = fixedAssets.reduce((sum, r) => sum + r.balance, 0);
    const totalAssets = balance.totalAssets;

    const liabilities = liabilitySection?.rows ?? [];
    const totalLiabilities = balance.totalLiabilities;

    const equityAccounts = equitySection?.rows ?? [];
    const currentEarnings = balance.currentEarnings;
    const totalEquity = balance.totalEquity;

    const totalPasiva = totalLiabilities + totalEquity;

    return (
      <div className="space-y-1.5">
        {/* Status & Options Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-white px-2 py-1 text-xs">
          <div
            className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold tabular-nums ${
              balance.isBalanced
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {balance.isBalanced ? (
              <>
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span>Persamaan Dasar Akuntansi: Seimbang (Aktiva = Pasiva)</span>
              </>
            ) : (
              <>
                <AlertTriangle size={13} className="text-red-600" />
                <span>
                  Persamaan Akuntansi Selisih: Rp {formatAbsoluteMoney(balance.difference)}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-0.5 text-[11px] font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setNeracaFormat("skontro")}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 transition ${
                  neracaFormat === "skontro"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "hover:text-slate-900"
                }`}
                title="Bentuk Skontro (2 Kolom: Aktiva & Pasiva)"
              >
                <Columns size={12} />
                <span>Skontro</span>
              </button>
              <button
                type="button"
                onClick={() => setNeracaFormat("stafel")}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 transition ${
                  neracaFormat === "stafel"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "hover:text-slate-900"
                }`}
                title="Bentuk Stafel (Vertikal)"
              >
                <Rows size={12} />
                <span>Stafel</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
              title="Cetak Laporan Neraca"
            >
              <Printer size={12} />
              <span>Cetak</span>
            </button>
          </div>
        </div>

        {/* Neraca Report Sheet */}
        <div className="border border-slate-300 bg-white shadow-xs">
          {/* Header Laporan */}
          <div className="text-center py-2.5 border-b-2 border-slate-900 bg-white">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Laporan Neraca
            </h2>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">
              {neracaFormat === "skontro" ? "Bentuk Skontro" : "Bentuk Stafel"}
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              Per Tanggal {balance.asOfDate}
            </div>
          </div>

          {neracaFormat === "skontro" ? (
            /* BENTUK SKONTRO (2 KOLOM: AKTIVA vs PASIVA) */
            <div className="grid grid-cols-1 md:grid-cols-2 text-xs">
              {/* SISI KIRI: AKTIVA */}
              <div className="flex flex-col justify-between border-b md:border-b-0 md:border-r-2 border-slate-900">
                <div className="divide-y divide-slate-100">
                  {/* Header Kolom Aktiva */}
                  <div className="border-b-2 border-slate-900 bg-slate-50 px-3 py-1">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                      Aktiva
                    </h3>
                  </div>

                  {/* Sub-grup: Aktiva Lancar */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                      Aktiva Lancar
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {currentAssets.map((row) => (
                          <tr key={row.accountId} className="hover:bg-blue-50/30">
                            <td className="py-0.5 pl-2 pr-1 text-slate-800">
                              <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                                {row.code}
                              </span>
                              <span>{row.name}</span>
                            </td>
                            <td className="py-0.5 text-right whitespace-nowrap">
                              <ReportAmount
                                onClick={() =>
                                  void openDrillDown(row.accountId, {
                                    startDate: "0001-01-01",
                                    endDate: balance.asOfDate,
                                  })
                                }
                                value={row.balance}
                              />
                            </td>
                          </tr>
                        ))}
                        {currentAssets.length === 0 && (
                          <tr>
                            <td colSpan={2} className="py-1 pl-2 text-slate-400 italic">
                              Tidak ada akun aktiva lancar
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-semibold text-slate-800">
                          <td className="py-1 pl-2">Total Aktiva Lancar</td>
                          <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">
                            {formatCurrency(totalCurrentAssets)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Sub-grup: Aktiva Tetap */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                      Aktiva Tetap
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {fixedAssets.map((row) => (
                          <tr key={row.accountId} className="hover:bg-blue-50/30">
                            <td className="py-0.5 pl-2 pr-1 text-slate-800">
                              <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                                {row.code}
                              </span>
                              <span>{row.name}</span>
                            </td>
                            <td className="py-0.5 text-right whitespace-nowrap">
                              <ReportAmount
                                onClick={() =>
                                  void openDrillDown(row.accountId, {
                                    startDate: "0001-01-01",
                                    endDate: balance.asOfDate,
                                  })
                                }
                                value={row.balance}
                              />
                            </td>
                          </tr>
                        ))}
                        {fixedAssets.length === 0 && (
                          <tr>
                            <td colSpan={2} className="py-1 pl-2 text-slate-400 italic">
                              Tidak ada akun aktiva tetap
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-semibold text-slate-800">
                          <td className="py-1 pl-2">Total Aktiva Tetap</td>
                          <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">
                            {formatCurrency(totalFixedAssets)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Footer Bawah: TOTAL AKTIVA */}
                <div className="border-t-2 border-b-2 border-slate-900 bg-slate-100 px-3 py-1.5 flex items-center justify-between font-bold text-xs uppercase tracking-wide text-slate-900 mt-4">
                  <span>Total Aktiva</span>
                  <span className="font-mono text-xs font-bold tabular-nums whitespace-nowrap">
                    {formatCurrency(totalAssets)}
                  </span>
                </div>
              </div>

              {/* SISI KANAN: PASIVA */}
              <div className="flex flex-col justify-between">
                <div className="divide-y divide-slate-100">
                  {/* Header Kolom Pasiva */}
                  <div className="border-b-2 border-slate-900 bg-slate-50 px-3 py-1">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                      Pasiva
                    </h3>
                  </div>

                  {/* Sub-grup: Kewajiban */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                      Kewajiban
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {liabilities.map((row) => (
                          <tr key={row.accountId} className="hover:bg-blue-50/30">
                            <td className="py-0.5 pl-2 pr-1 text-slate-800">
                              <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                                {row.code}
                              </span>
                              <span>{row.name}</span>
                            </td>
                            <td className="py-0.5 text-right whitespace-nowrap">
                              <ReportAmount
                                onClick={() =>
                                  void openDrillDown(row.accountId, {
                                    startDate: "0001-01-01",
                                    endDate: balance.asOfDate,
                                  })
                                }
                                value={row.balance}
                              />
                            </td>
                          </tr>
                        ))}
                        {liabilities.length === 0 && (
                          <tr>
                            <td colSpan={2} className="py-1 pl-2 text-slate-400 italic">
                              Tidak ada akun kewajiban
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-semibold text-slate-800">
                          <td className="py-1 pl-2">Total Kewajiban</td>
                          <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">
                            {formatCurrency(totalLiabilities)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Sub-grup: Ekuitas */}
                  <div className="px-3 py-2 space-y-1.5">
                    <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                      Ekuitas
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {equityAccounts.map((row) => (
                          <tr key={row.accountId} className="hover:bg-blue-50/30">
                            <td className="py-0.5 pl-2 pr-1 text-slate-800">
                              <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                                {row.code}
                              </span>
                              <span>{row.name}</span>
                            </td>
                            <td className="py-0.5 text-right whitespace-nowrap">
                              <ReportAmount
                                onClick={() =>
                                  void openDrillDown(row.accountId, {
                                    startDate: "0001-01-01",
                                    endDate: balance.asOfDate,
                                  })
                                }
                                value={row.balance}
                              />
                            </td>
                          </tr>
                        ))}
                        {/* Laba Periode Berjalan */}
                        <tr className="hover:bg-blue-50/30">
                          <td className="py-0.5 pl-2 pr-1 text-slate-800">
                            <span className="font-mono text-[10px] text-slate-400 mr-1.5">-</span>
                            <span>Laba Periode Berjalan</span>
                          </td>
                          <td className="py-0.5 text-right whitespace-nowrap">
                            <span className="font-mono tabular-nums text-xs">
                              {formatCurrency(currentEarnings)}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-semibold text-slate-800">
                          <td className="py-1 pl-2">Total Ekuitas</td>
                          <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">
                            {formatCurrency(totalEquity)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Footer Bawah: TOTAL PASIVA */}
                <div className="border-t-2 border-b-2 border-slate-900 bg-slate-100 px-3 py-1.5 flex items-center justify-between font-bold text-xs uppercase tracking-wide text-slate-900 mt-4">
                  <span>Total Pasiva</span>
                  <span className="font-mono text-xs font-bold tabular-nums whitespace-nowrap">
                    {formatCurrency(totalPasiva)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* BENTUK STAFEL (VERTIKAL) */
            <div className="p-3 space-y-4 text-xs max-w-3xl mx-auto">
              {/* 1. AKTIVA */}
              <div className="space-y-3">
                <div className="border-b-2 border-slate-900 pb-1">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    Aktiva
                  </h3>
                </div>

                {/* Aktiva Lancar */}
                <div className="pl-2 space-y-1.5">
                  <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                    Aktiva Lancar
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {currentAssets.map((row) => (
                        <tr key={row.accountId} className="hover:bg-blue-50/30">
                          <td className="py-0.5 pl-2 text-slate-800">
                            <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                              {row.code}
                            </span>
                            <span>{row.name}</span>
                          </td>
                          <td className="py-0.5 text-right whitespace-nowrap">
                            <ReportAmount
                              onClick={() =>
                                void openDrillDown(row.accountId, {
                                  startDate: "0001-01-01",
                                  endDate: balance.asOfDate,
                                })
                              }
                              value={row.balance}
                            />
                          </td>
                        </tr>
                      ))}
                      {currentAssets.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-1 pl-2 text-slate-400 italic">
                            Tidak ada akun aktiva lancar
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 font-semibold text-slate-800">
                        <td className="py-1 pl-2">Total Aktiva Lancar</td>
                        <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">
                          {formatCurrency(totalCurrentAssets)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Aktiva Tetap */}
                <div className="pl-2 space-y-1.5">
                  <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                    Aktiva Tetap
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {fixedAssets.map((row) => (
                        <tr key={row.accountId} className="hover:bg-blue-50/30">
                          <td className="py-0.5 pl-2 text-slate-800">
                            <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                              {row.code}
                            </span>
                            <span>{row.name}</span>
                          </td>
                          <td className="py-0.5 text-right whitespace-nowrap">
                            <ReportAmount
                              onClick={() =>
                                void openDrillDown(row.accountId, {
                                  startDate: "0001-01-01",
                                  endDate: balance.asOfDate,
                                })
                              }
                              value={row.balance}
                            />
                          </td>
                        </tr>
                      ))}
                      {fixedAssets.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-1 pl-2 text-slate-400 italic">
                            Tidak ada akun aktiva tetap
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 font-semibold text-slate-800">
                        <td className="py-1 pl-2">Total Aktiva Tetap</td>
                        <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">
                          {formatCurrency(totalFixedAssets)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Total Aktiva */}
                <div className="border-t-2 border-b-2 border-slate-900 bg-slate-100 px-3 py-1.5 flex items-center justify-between font-bold text-xs uppercase tracking-wide text-slate-900">
                  <span>Total Aktiva</span>
                  <span className="font-mono text-xs font-bold tabular-nums whitespace-nowrap">
                    {formatCurrency(totalAssets)}
                  </span>
                </div>
              </div>

              {/* 2. PASIVA */}
              <div className="space-y-3 pt-2">
                <div className="border-b-2 border-slate-900 pb-1">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    Pasiva
                  </h3>
                </div>

                {/* Kewajiban */}
                <div className="pl-2 space-y-1.5">
                  <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                    Kewajiban
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {liabilities.map((row) => (
                        <tr key={row.accountId} className="hover:bg-blue-50/30">
                          <td className="py-0.5 pl-2 text-slate-800">
                            <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                              {row.code}
                            </span>
                            <span>{row.name}</span>
                          </td>
                          <td className="py-0.5 text-right whitespace-nowrap">
                            <ReportAmount
                              onClick={() =>
                                void openDrillDown(row.accountId, {
                                  startDate: "0001-01-01",
                                  endDate: balance.asOfDate,
                                })
                              }
                              value={row.balance}
                            />
                          </td>
                        </tr>
                      ))}
                      {liabilities.length === 0 && (
                        <tr>
                          <td colSpan={2} className="py-1 pl-2 text-slate-400 italic">
                            Tidak ada akun kewajiban
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 font-semibold text-slate-800">
                        <td className="py-1 pl-2">Total Kewajiban</td>
                        <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">
                          {formatCurrency(totalLiabilities)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Ekuitas */}
                <div className="pl-2 space-y-1.5">
                  <div className="font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                    Ekuitas
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {equityAccounts.map((row) => (
                        <tr key={row.accountId} className="hover:bg-blue-50/30">
                          <td className="py-0.5 pl-2 text-slate-800">
                            <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                              {row.code}
                            </span>
                            <span>{row.name}</span>
                          </td>
                          <td className="py-0.5 text-right whitespace-nowrap">
                            <ReportAmount
                              onClick={() =>
                                void openDrillDown(row.accountId, {
                                  startDate: "0001-01-01",
                                  endDate: balance.asOfDate,
                                })
                              }
                              value={row.balance}
                            />
                          </td>
                        </tr>
                      ))}
                      <tr className="hover:bg-blue-50/30">
                        <td className="py-0.5 pl-2 text-slate-800">
                          <span className="font-mono text-[10px] text-slate-400 mr-1.5">-</span>
                          <span>Laba Periode Berjalan</span>
                        </td>
                        <td className="py-0.5 text-right whitespace-nowrap">
                          <span className="font-mono tabular-nums text-xs">
                            {formatCurrency(currentEarnings)}
                          </span>
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-200 font-semibold text-slate-800">
                        <td className="py-1 pl-2">Total Ekuitas</td>
                        <td className="py-1 text-right font-mono tabular-nums whitespace-nowrap">
                          {formatCurrency(totalEquity)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Total Pasiva */}
                <div className="border-t-2 border-b-2 border-slate-900 bg-slate-100 px-3 py-1.5 flex items-center justify-between font-bold text-xs uppercase tracking-wide text-slate-900">
                  <span>Total Pasiva</span>
                  <span className="font-mono text-xs font-bold tabular-nums whitespace-nowrap">
                    {formatCurrency(totalPasiva)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function cashFlowView() {
    if (!cashFlow) return null;

    return (
      <div className="space-y-2">
        {/* Status Toolbar */}
        <div className="flex items-center justify-between border border-slate-200 bg-white px-2 py-1 text-xs">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <ArrowRightLeft size={13} className="text-brand" />
            <span>
              Laporan Arus Kas (Periode {periodStart} s/d {periodEnd})
            </span>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
            title="Cetak Laporan Arus Kas"
          >
            <Printer size={12} />
            <span>Cetak</span>
          </button>
        </div>

        {/* Executive Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-1.5 text-xs">
          <div className="rounded border border-slate-200 bg-white p-2">
            <div className="text-[10px] font-semibold uppercase text-slate-500">Saldo Awal Kas</div>
            <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
              Rp {formatMoney(cashFlow.beginningCash)}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2">
            <div className="text-[10px] font-semibold uppercase text-slate-500">
              Arus Kas Operasi
            </div>
            <div
              className={`font-mono text-xs font-bold mt-0.5 ${
                cashFlow.operating.netAmount >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              Rp {formatMoney(cashFlow.operating.netAmount)}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2">
            <div className="text-[10px] font-semibold uppercase text-slate-500">
              Arus Kas Investasi
            </div>
            <div
              className={`font-mono text-xs font-bold mt-0.5 ${
                cashFlow.investing.netAmount >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              Rp {formatMoney(cashFlow.investing.netAmount)}
            </div>
          </div>
          <div className="rounded border border-slate-200 bg-white p-2">
            <div className="text-[10px] font-semibold uppercase text-slate-500">
              Arus Kas Pendanaan
            </div>
            <div
              className={`font-mono text-xs font-bold mt-0.5 ${
                cashFlow.financing.netAmount >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              Rp {formatMoney(cashFlow.financing.netAmount)}
            </div>
          </div>
          <div className="rounded border border-blue-200 bg-blue-50/50 p-2">
            <div className="text-[10px] font-semibold uppercase text-blue-700">
              Perubahan Bersih
            </div>
            <div
              className={`font-mono text-xs font-bold mt-0.5 ${
                cashFlow.netCashFlow >= 0 ? "text-blue-900" : "text-red-700"
              }`}
            >
              {cashFlow.netCashFlow >= 0 ? "+" : ""}Rp {formatMoney(cashFlow.netCashFlow)}
            </div>
          </div>
          <div className="rounded border border-emerald-300 bg-emerald-50 text-emerald-900 p-2">
            <div className="text-[10px] font-semibold uppercase">Saldo Akhir Kas</div>
            <div className="font-mono text-xs font-bold mt-0.5">
              Rp {formatMoney(cashFlow.endingCash)}
            </div>
          </div>
        </div>

        {/* Cash Flow Statement Sheet */}
        <div className="border border-slate-300 bg-white shadow-xs p-3 space-y-4">
          <div className="text-center py-2 border-b-2 border-slate-900">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Laporan Arus Kas
            </h2>
            <div className="text-xs font-semibold text-slate-700 mt-0.5">Metode Langsung</div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
              Periode {periodStart} s/d {periodEnd}
            </div>
          </div>

          {/* 1. OPERATING ACTIVITIES */}
          <div className="space-y-1.5 text-xs">
            <div className="border-b-2 border-slate-800 pb-1 font-bold text-xs uppercase tracking-wider text-slate-900">
              Arus Kas dari Aktivitas Operasi
            </div>

            {/* Inflows */}
            <div className="pl-2 space-y-1">
              <div className="text-[11px] font-semibold text-slate-700">
                Penerimaan Kas Operasi:
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {cashFlow.operating.inflows.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30">
                      <td className="py-0.5 pl-3 text-slate-800">
                        {item.code && (
                          <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                            {item.code}
                          </span>
                        )}
                        <span>{item.name}</span>
                      </td>
                      <td className="py-0.5 text-right whitespace-nowrap">
                        {item.accountId ? (
                          <ReportAmount
                            onClick={() => void openDrillDown(item.accountId!)}
                            value={item.amount}
                          />
                        ) : (
                          <span className="font-mono tabular-nums text-xs">
                            {formatCurrency(item.amount)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {cashFlow.operating.inflows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-0.5 pl-3 text-slate-400 italic text-[11px]">
                        Tidak ada penerimaan operasi pada periode ini
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold text-slate-800">
                    <td className="py-0.5 pl-3">Total Penerimaan Operasi</td>
                    <td className="py-0.5 text-right font-mono tabular-nums">
                      {formatCurrency(cashFlow.operating.totalInflow)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Outflows */}
            <div className="pl-2 space-y-1 pt-1">
              <div className="text-[11px] font-semibold text-slate-700">
                Pengeluaran Kas Operasi:
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {cashFlow.operating.outflows.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30">
                      <td className="py-0.5 pl-3 text-slate-800">
                        {item.code && (
                          <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                            {item.code}
                          </span>
                        )}
                        <span>{item.name}</span>
                      </td>
                      <td className="py-0.5 text-right whitespace-nowrap">
                        {item.accountId ? (
                          <ReportAmount
                            onClick={() => void openDrillDown(item.accountId!)}
                            value={item.amount}
                          />
                        ) : (
                          <span className="font-mono tabular-nums text-xs text-red-700">
                            ({formatCurrency(item.amount)})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {cashFlow.operating.outflows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-0.5 pl-3 text-slate-400 italic text-[11px]">
                        Tidak ada pengeluaran operasi pada periode ini
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold text-slate-800">
                    <td className="py-0.5 pl-3">Total Pengeluaran Operasi</td>
                    <td className="py-0.5 text-right font-mono tabular-nums text-red-700">
                      ({formatCurrency(cashFlow.operating.totalOutflow)})
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Net Operating */}
            <div className="border-t border-b border-slate-300 bg-slate-50 px-2 py-1 flex justify-between font-bold text-xs text-slate-900">
              <span>Arus Kas Bersih dari Aktivitas Operasi</span>
              <span
                className={`font-mono tabular-nums ${
                  cashFlow.operating.netAmount >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatCurrency(cashFlow.operating.netAmount)}
              </span>
            </div>
          </div>

          {/* 2. INVESTING ACTIVITIES */}
          <div className="space-y-1.5 text-xs">
            <div className="border-b-2 border-slate-800 pb-1 font-bold text-xs uppercase tracking-wider text-slate-900">
              Arus Kas dari Aktivitas Investasi
            </div>
            <table className="w-full text-xs">
              <tbody>
                {cashFlow.investing.inflows.map((item, idx) => (
                  <tr key={`in-${idx}`} className="hover:bg-blue-50/30">
                    <td className="py-0.5 pl-3 text-slate-800">
                      {item.code && (
                        <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                          {item.code}
                        </span>
                      )}
                      <span>{item.name}</span>
                    </td>
                    <td className="py-0.5 text-right whitespace-nowrap">
                      {item.accountId ? (
                        <ReportAmount
                          onClick={() => void openDrillDown(item.accountId!)}
                          value={item.amount}
                        />
                      ) : (
                        <span className="font-mono tabular-nums text-xs">
                          {formatCurrency(item.amount)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {cashFlow.investing.outflows.map((item, idx) => (
                  <tr key={`out-${idx}`} className="hover:bg-blue-50/30">
                    <td className="py-0.5 pl-3 text-slate-800">
                      {item.code && (
                        <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                          {item.code}
                        </span>
                      )}
                      <span>{item.name}</span>
                    </td>
                    <td className="py-0.5 text-right whitespace-nowrap font-mono tabular-nums text-red-700">
                      ({formatCurrency(item.amount)})
                    </td>
                  </tr>
                ))}
                {cashFlow.investing.inflows.length === 0 &&
                  cashFlow.investing.outflows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-1 pl-3 text-slate-400 italic text-[11px]">
                        Tidak ada aktivitas investasi pada periode ini
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
            <div className="border-t border-b border-slate-300 bg-slate-50 px-2 py-1 flex justify-between font-bold text-xs text-slate-900">
              <span>Arus Kas Bersih dari Aktivitas Investasi</span>
              <span
                className={`font-mono tabular-nums ${
                  cashFlow.investing.netAmount >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatCurrency(cashFlow.investing.netAmount)}
              </span>
            </div>
          </div>

          {/* 3. FINANCING ACTIVITIES */}
          <div className="space-y-1.5 text-xs">
            <div className="border-b-2 border-slate-800 pb-1 font-bold text-xs uppercase tracking-wider text-slate-900">
              Arus Kas dari Aktivitas Pendanaan
            </div>
            <table className="w-full text-xs">
              <tbody>
                {cashFlow.financing.inflows.map((item, idx) => (
                  <tr key={`in-${idx}`} className="hover:bg-blue-50/30">
                    <td className="py-0.5 pl-3 text-slate-800">
                      {item.code && (
                        <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                          {item.code}
                        </span>
                      )}
                      <span>{item.name}</span>
                    </td>
                    <td className="py-0.5 text-right whitespace-nowrap">
                      {item.accountId ? (
                        <ReportAmount
                          onClick={() => void openDrillDown(item.accountId!)}
                          value={item.amount}
                        />
                      ) : (
                        <span className="font-mono tabular-nums text-xs">
                          {formatCurrency(item.amount)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {cashFlow.financing.outflows.map((item, idx) => (
                  <tr key={`out-${idx}`} className="hover:bg-blue-50/30">
                    <td className="py-0.5 pl-3 text-slate-800">
                      {item.code && (
                        <span className="font-mono text-[10px] text-slate-400 mr-1.5">
                          {item.code}
                        </span>
                      )}
                      <span>{item.name}</span>
                    </td>
                    <td className="py-0.5 text-right whitespace-nowrap font-mono tabular-nums text-red-700">
                      ({formatCurrency(item.amount)})
                    </td>
                  </tr>
                ))}
                {cashFlow.financing.inflows.length === 0 &&
                  cashFlow.financing.outflows.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-1 pl-3 text-slate-400 italic text-[11px]">
                        Tidak ada aktivitas pendanaan pada periode ini
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
            <div className="border-t border-b border-slate-300 bg-slate-50 px-2 py-1 flex justify-between font-bold text-xs text-slate-900">
              <span>Arus Kas Bersih dari Aktivitas Pendanaan</span>
              <span
                className={`font-mono tabular-nums ${
                  cashFlow.financing.netAmount >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatCurrency(cashFlow.financing.netAmount)}
              </span>
            </div>
          </div>

          {/* 4. NET CHANGE & RECONCILIATION */}
          <div className="border-t-2 border-b-2 border-slate-900 bg-slate-100 p-2.5 space-y-1.5 text-xs font-semibold text-slate-900">
            <div className="flex justify-between">
              <span>Kenaikan / (Penurunan) Bersih Kas & Setara Kas</span>
              <span
                className={`font-mono text-xs tabular-nums ${
                  cashFlow.netCashFlow >= 0
                    ? "text-emerald-800 font-bold"
                    : "text-red-800 font-bold"
                }`}
              >
                {formatCurrency(cashFlow.netCashFlow)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 font-normal">
              <span>Saldo Kas & Setara Kas Awal Periode</span>
              <span className="font-mono tabular-nums text-slate-800 font-semibold">
                {formatCurrency(cashFlow.beginningCash)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1 text-sm font-bold text-slate-900">
              <span>Saldo Kas & Setara Kas Akhir Periode</span>
              <span className="font-mono tabular-nums text-brand">
                {formatCurrency(cashFlow.endingCash)}
              </span>
            </div>
          </div>

          {/* 5. RINCIAN PER AKUN KAS & BANK */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <h4 className="font-bold text-xs text-slate-800">Rincian Per Akun Kas & Bank</h4>
              <span className="text-[11px] text-slate-500">
                Klik kode akun untuk rincian mutasi
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-2 py-1 text-left">Kode / Akun Kas & Bank</th>
                    <th className="px-2 py-1 text-right">Saldo Awal</th>
                    <th className="px-2 py-1 text-right">Masuk (+)</th>
                    <th className="px-2 py-1 text-right">Keluar (-)</th>
                    <th className="px-2 py-1 text-right">Mutasi Bersih</th>
                    <th className="px-2 py-1 text-right">Saldo Akhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {cashFlow.cashAccounts.map((acc, index) => (
                    <tr key={acc.accountId} className={index % 2 ? "bg-slate-50/50" : "bg-white"}>
                      <td className="px-2 py-1 text-left font-sans">
                        <button
                          type="button"
                          onClick={() => void openDrillDown(acc.accountId)}
                          className="font-mono font-semibold text-brand hover:underline mr-1.5"
                        >
                          {acc.code}
                        </button>
                        <span className="text-slate-800">{acc.name}</span>
                      </td>
                      <td className="px-2 py-1 text-right text-slate-600">
                        {formatCurrency(acc.beginningBalance)}
                      </td>
                      <td className="px-2 py-1 text-right text-emerald-700">
                        +{formatAbsoluteMoney(acc.inflow)}
                      </td>
                      <td className="px-2 py-1 text-right text-red-700">
                        -{formatAbsoluteMoney(acc.outflow)}
                      </td>
                      <td
                        className={`px-2 py-1 text-right font-semibold ${
                          acc.netMovement >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {acc.netMovement >= 0 ? "+" : ""}
                        {formatCurrency(acc.netMovement)}
                      </td>
                      <td className="px-2 py-1 text-right font-bold text-slate-900">
                        {formatCurrency(acc.endingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-100 font-mono font-bold tabular-nums text-slate-900">
                  <tr>
                    <td className="px-2 py-1 text-left font-sans">Total Seluruh Kas & Bank</td>
                    <td className="px-2 py-1 text-right">
                      {formatCurrency(cashFlow.beginningCash)}
                    </td>
                    <td className="px-2 py-1 text-right text-emerald-700">
                      +
                      {formatAbsoluteMoney(cashFlow.cashAccounts.reduce((s, a) => s + a.inflow, 0))}
                    </td>
                    <td className="px-2 py-1 text-right text-red-700">
                      -
                      {formatAbsoluteMoney(
                        cashFlow.cashAccounts.reduce((s, a) => s + a.outflow, 0),
                      )}
                    </td>
                    <td
                      className={`px-2 py-1 text-right ${
                        cashFlow.netCashFlow >= 0 ? "text-emerald-700" : "text-red-700"
                      }`}
                    >
                      {cashFlow.netCashFlow >= 0 ? "+" : ""}
                      {formatCurrency(cashFlow.netCashFlow)}
                    </td>
                    <td className="px-2 py-1 text-right text-brand">
                      {formatCurrency(cashFlow.endingCash)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <section className="border border-slate-200 bg-white px-2 py-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-800">Laporan Keuangan</h2>
            <span className="text-[11px] text-slate-300">|</span>
            <nav aria-label="Jenis laporan" className="flex items-center gap-1">
              <button
                className={
                  "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded " +
                  (tab === "income" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100")
                }
                onClick={() => setTab("income")}
                type="button"
              >
                <BarChart3 size={12} /> Laba Rugi
              </button>
              <button
                className={
                  "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded " +
                  (tab === "income-comparative"
                    ? "bg-brand text-white"
                    : "text-slate-600 hover:bg-slate-100")
                }
                onClick={() => setTab("income-comparative")}
                type="button"
              >
                <Columns size={12} /> Laba Rugi Komparatif
              </button>
              <button
                className={
                  "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded " +
                  (tab === "balance" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100")
                }
                onClick={() => setTab("balance")}
                type="button"
              >
                <BookOpen size={12} /> Neraca
              </button>
              <button
                className={
                  "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded " +
                  (tab === "cash-flow"
                    ? "bg-brand text-white"
                    : "text-slate-600 hover:bg-slate-100")
                }
                onClick={() => setTab("cash-flow")}
                type="button"
              >
                <ArrowRightLeft size={12} /> Arus Kas
              </button>
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Quick Presets */}
            <div
              aria-label="Preset Periode"
              className="inline-flex items-center rounded border border-slate-200 bg-slate-50 p-0.5"
              role="group"
            >
              <button
                type="button"
                onClick={() => applyPreset("THIS_MONTH")}
                className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                  activePreset === "THIS_MONTH"
                    ? "bg-white font-semibold text-brand shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bulan ini
              </button>
              <button
                type="button"
                onClick={() => applyPreset("PREV_MONTH")}
                className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                  activePreset === "PREV_MONTH"
                    ? "bg-white font-semibold text-brand shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Bulan lalu
              </button>
              <button
                type="button"
                onClick={() => applyPreset("THIS_YEAR")}
                className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                  activePreset === "THIS_YEAR"
                    ? "bg-white font-semibold text-brand shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Tahun ini
              </button>
            </div>

            {tab !== "balance" && (
              <label className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
                Mulai
                <input
                  className={inputClass}
                  onChange={(event) => {
                    setPeriodStart(event.target.value);
                    setActivePreset("CUSTOM");
                  }}
                  type="date"
                  value={periodStart}
                />
              </label>
            )}
            <label className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
              {tab === "balance" ? "Per Tanggal" : "s/d"}
              <input
                className={inputClass}
                onChange={(event) => {
                  setPeriodEnd(event.target.value);
                  setActivePreset("CUSTOM");
                }}
                type="date"
                value={periodEnd}
              />
            </label>
            {tab === "income-comparative" && (
              <>
                <span className="text-slate-300">|</span>
                <label className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
                  Bandingkan:
                  <input
                    className={inputClass}
                    onChange={(event) => {
                      setCompareStart(event.target.value);
                      setActivePreset("CUSTOM");
                    }}
                    type="date"
                    value={compareStart}
                  />
                </label>
                <label className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
                  s/d
                  <input
                    className={inputClass}
                    onChange={(event) => {
                      setCompareEnd(event.target.value);
                      setActivePreset("CUSTOM");
                    }}
                    type="date"
                    value={compareEnd}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </section>

      {(message || reportError) && (
        <div
          className="flex items-center justify-between border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800"
          role="status"
        >
          <span>{message || reportError}</span>
          <button aria-label="Tutup pesan laporan" onClick={() => setMessage("")} type="button">
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
          Memuat laporan...
        </div>
      ) : tab === "income" ? (
        incomeStandardView()
      ) : tab === "income-comparative" ? (
        incomeComparativeView()
      ) : tab === "balance" ? (
        balanceView()
      ) : (
        cashFlowView()
      )}
      <DrillDownDrawer
        data={drillDown ?? null}
        error={drillError}
        formatMoney={formatMoney}
        loading={drillLoading}
        onClose={() => setDrillTarget(null)}
      />
    </div>
  );
}
