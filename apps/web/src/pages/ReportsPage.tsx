import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, BookOpen, FileText, RefreshCw } from "lucide-react";
import { senToRupiah, todayIsoDate } from "@keuangan-apotek/shared";
import DrillDownDrawer from "../components/drilldown/DrillDownDrawer";
import {
  getBalanceReport,
  getDrillDown,
  getIncomeReport,
  getTrialReport,
  queryKeys,
} from "../lib/queries";

type Tab = "income" | "balance" | "trial";
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
type BalanceRow = { accountId: string; code: string; name: string; balance: number };
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
type TrialRow = {
  accountId: string;
  code: string;
  name: string;
  classification: string;
  debitBalance: number;
  creditBalance: number;
  endingBalance: number;
};
type TrialReport = {
  period: Period;
  rows: TrialRow[];
  totalDebit: number;
  totalCredit: number;
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
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-blue-100";

function previousMonthPeriod(date: string): Period {
  const parts = date.split("-").map(Number);
  const previous = new Date(Date.UTC(parts[0]!, parts[1]! - 2, 1));
  const year = previous.getUTCFullYear();
  const month = previous.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthText = String(month).padStart(2, "0");
  return {
    startDate: year + "-" + monthText + "-01",
    endDate: year + "-" + monthText + "-" + String(lastDay).padStart(2, "0"),
  };
}

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

function ReportAmount({ value, onClick }: { value: number; onClick?: () => void }) {
  const content = <>Rp {formatMoney(value)}</>;
  return onClick ? (
    <button
      className="font-mono tabular-nums text-right text-brand underline decoration-blue-200 underline-offset-2 hover:decoration-brand"
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  ) : (
    <span className="font-mono tabular-nums">{content}</span>
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
      <table className="w-full min-w-[720px] text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-5 py-3">Akun</th>
            <th className="px-3 py-3 text-right">Bulan berjalan</th>
            <th className="px-3 py-3 text-right">Bulan pembanding</th>
            <th className="px-5 py-3 text-right">Varians</th>
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row, index) => (
            <tr className={index % 2 ? "bg-slate-50/60" : "bg-white"} key={row.accountId}>
              <td className="px-5 py-3">
                <span className="font-mono font-semibold tabular-nums text-slate-600">
                  {row.code}
                </span>
                <span className="ml-2">{row.name}</span>
              </td>
              <td className="px-3 py-3 text-right">
                <ReportAmount onClick={() => openDrillDown(row)} value={row.amount} />
              </td>
              <td className="px-3 py-3 text-right">
                <ReportAmount value={row.compareAmount} />
              </td>
              <td
                className={
                  "px-5 py-3 text-right font-mono tabular-nums " +
                  (row.variance >= 0 ? "text-emerald-700" : "text-red-700")
                }
              >
                {row.variance >= 0 ? "+" : "−"}Rp {formatAbsoluteMoney(row.variance)}{" "}
                <span className="ml-1 text-xs">
                  ({row.growthPercent === null ? "—" : row.growthPercent.toFixed(2) + "%"})
                </span>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
            <td className="px-5 py-3">Total {section.label}</td>
            <td className="px-3 py-3 text-right">
              <ReportAmount value={section.total.amount} />
            </td>
            <td className="px-3 py-3 text-right">
              <ReportAmount value={section.total.compareAmount} />
            </td>
            <td className="px-5 py-3 text-right font-mono tabular-nums">
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
  const monthStart = today.slice(0, 7) + "-01";
  const [tab, setTab] = useState<Tab>("income");
  const [periodStart, setPeriodStart] = useState(monthStart);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [compareStart, setCompareStart] = useState(() => previousMonthPeriod(monthStart).startDate);
  const [compareEnd, setCompareEnd] = useState(() => previousMonthPeriod(monthStart).endDate);
  const [message, setMessage] = useState("");
  const [drillTarget, setDrillTarget] = useState<{ accountId: string; period: Period } | null>(
    null,
  );
  const incomeQuery = useQuery({
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
    enabled: tab === "income",
  });
  const balanceQuery = useQuery({
    queryKey: queryKeys.balanceReport(periodEnd),
    queryFn: () => getBalanceReport(periodEnd),
    enabled: tab === "balance",
  });
  const trialQuery = useQuery({
    queryKey: queryKeys.trialReport({ startDate: periodStart, endDate: periodEnd }),
    queryFn: () => getTrialReport({ startDate: periodStart, endDate: periodEnd }),
    enabled: tab === "trial",
  });
  const reportQuery =
    tab === "income" ? incomeQuery : tab === "balance" ? balanceQuery : trialQuery;
  const income = incomeQuery.data as IncomeReport | undefined;
  const balance = balanceQuery.data as BalanceReport | undefined;
  const trial = trialQuery.data as TrialReport | undefined;
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

  function incomeView() {
    if (!income) return null;
    const summary = [
      { label: "Pendapatan", value: income.revenue.amount },
      { label: "Laba kotor", value: income.grossProfit.amount },
      { label: "Laba bersih usaha", value: income.netProfit.amount },
    ];
    return (
      <>
        <div className="grid gap-3 md:grid-cols-3">
          {summary.map((item) => (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={item.label}>
              <p className="text-xs text-muted">{item.label}</p>
              <p className="mt-2 font-mono text-xl font-bold tabular-nums">
                Rp {formatMoney(item.value)}
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {income.sections.map((section) => (
            <section
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              key={section.key}
            >
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold">{section.label}</h3>
                <p className="mt-1 text-xs text-muted">
                  Klik nominal bulan berjalan untuk melihat jurnal pembentuk.
                </p>
              </div>
              <ComparativeTable
                openDrillDown={(row) => void openDrillDown(row.accountId)}
                section={section}
              />
            </section>
          ))}
        </div>
      </>
    );
  }

  function balanceView() {
    if (!balance) return null;
    return (
      <>
        <div
          className={
            "rounded-xl border p-4 " +
            (balance.isBalanced ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Persamaan dasar akuntansi</p>
              <p className="mt-1 text-xs text-muted">
                Aset = Kewajiban + Ekuitas termasuk laba periode berjalan.
              </p>
            </div>
            <span
              className={
                "font-mono text-sm font-bold tabular-nums " +
                (balance.isBalanced ? "text-emerald-700" : "text-red-700")
              }
            >
              {balance.isBalanced ? "✓ Seimbang" : "Selisih Rp " + formatMoney(balance.difference)}
            </span>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {balance.sections.map((section) => (
            <section
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              key={section.key}
            >
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-semibold">{section.label}</h3>
                <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                  Rp {formatMoney(section.total)}
                </p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {section.rows.map((row) => (
                    <tr className="border-b border-slate-50" key={row.accountId}>
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs tabular-nums text-slate-500">
                          {row.code}
                        </span>
                        <span className="ml-2">{row.name}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
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
                </tbody>
              </table>
            </section>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <span>
              Total aset{" "}
              <strong className="ml-2 font-mono tabular-nums">
                Rp {formatMoney(balance.totalAssets)}
              </strong>
            </span>
            <span>
              Total kewajiban{" "}
              <strong className="ml-2 font-mono tabular-nums">
                Rp {formatMoney(balance.totalLiabilities)}
              </strong>
            </span>
            <span>
              Total ekuitas{" "}
              <strong className="ml-2 font-mono tabular-nums">
                Rp {formatMoney(balance.totalEquity)}
              </strong>
            </span>
            <span>
              Laba berjalan{" "}
              <strong className="ml-2 font-mono tabular-nums">
                Rp {formatMoney(balance.currentEarnings)}
              </strong>
            </span>
          </div>
        </div>
      </>
    );
  }

  function trialView() {
    if (!trial) return null;
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div
          className={
            "flex flex-wrap items-center justify-between gap-3 border-b p-5 " +
            (trial.isBalanced ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50")
          }
        >
          <div>
            <h3 className="font-semibold">Neraca Saldo</h3>
            <p className="mt-1 text-xs text-muted">
              Saldo bersih seluruh akun pada periode yang dipilih.
            </p>
          </div>
          <span
            className={
              "font-mono text-sm font-bold tabular-nums " +
              (trial.isBalanced ? "text-emerald-700" : "text-red-700")
            }
          >
            Debit {formatMoney(trial.totalDebit)} · Kredit {formatMoney(trial.totalCredit)}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3">Kode / Akun</th>
                <th className="px-3 py-3">Klasifikasi</th>
                <th className="px-3 py-3 text-right">Saldo debit</th>
                <th className="px-5 py-3 text-right">Saldo kredit</th>
              </tr>
            </thead>
            <tbody>
              {trial.rows.map((row, index) => (
                <tr className={index % 2 ? "bg-slate-50/60" : "bg-white"} key={row.accountId}>
                  <td className="px-5 py-3">
                    <span className="font-mono font-semibold tabular-nums text-slate-600">
                      {row.code}
                    </span>
                    <span className="ml-2">{row.name}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">{row.classification}</td>
                  <td className="px-3 py-3 text-right">
                    <ReportAmount
                      onClick={() => void openDrillDown(row.accountId)}
                      value={row.debitBalance}
                    />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ReportAmount
                      onClick={() => void openDrillDown(row.accountId)}
                      value={row.creditBalance}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 font-bold">
                <td className="px-5 py-3" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-3 text-right">
                  <ReportAmount value={trial.totalDebit} />
                </td>
                <td className="px-5 py-3 text-right">
                  <ReportAmount value={trial.totalCredit} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              Phase 5 · Modul 8
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Laporan Keuangan</h2>
            <p className="mt-1 text-sm text-muted">
              Analisis real-time dengan rincian sampai ke jurnal pembentuk nominal.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2\">
            <label className="text-xs font-semibold text-slate-500">
              Mulai
              <input
                className={inputClass + " mt-1 block"}
                onChange={(event) => setPeriodStart(event.target.value)}
                type="date"
                value={periodStart}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Sampai
              <input
                className={inputClass + " mt-1 block"}
                onChange={(event) => setPeriodEnd(event.target.value)}
                type="date"
                value={periodEnd}
              />
            </label>
            {tab === "income" && (
              <>
                <label className="text-xs font-semibold text-slate-500">
                  Bandingkan dari
                  <input
                    className={inputClass + " mt-1 block"}
                    onChange={(event) => setCompareStart(event.target.value)}
                    type="date"
                    value={compareStart}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Bandingkan sampai
                  <input
                    className={inputClass + " mt-1 block"}
                    onChange={(event) => setCompareEnd(event.target.value)}
                    type="date"
                    value={compareEnd}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </section>
      <nav
        aria-label="Jenis laporan"
        className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <button
          className={
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold " +
            (tab === "income" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50")
          }
          onClick={() => setTab("income")}
          type="button"
        >
          <BarChart3 size={16} /> Laba Rugi Komparatif
        </button>
        <button
          className={
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold " +
            (tab === "balance" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50")
          }
          onClick={() => setTab("balance")}
          type="button"
        >
          <BookOpen size={16} /> Neraca
        </button>
        <button
          className={
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold " +
            (tab === "trial" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-50")
          }
          onClick={() => setTab("trial")}
          type="button"
        >
          <FileText size={16} /> Neraca Saldo
        </button>
      </nav>
      {(message || reportError) && (
        <div
          className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          role="status"
        >
          <span>{message || reportError}</span>
          <button aria-label="Tutup pesan laporan" onClick={() => setMessage("")} type="button">
            <RefreshCw size={16} />
          </button>
        </div>
      )}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-muted">
          Memuat laporan...
        </div>
      ) : tab === "income" ? (
        incomeView()
      ) : tab === "balance" ? (
        balanceView()
      ) : (
        trialView()
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
