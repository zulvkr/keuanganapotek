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
  "rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs font-mono tabular-nums outline-none focus:border-brand focus:ring-1 focus:ring-brand";

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
      className="font-mono tabular-nums text-right text-brand underline decoration-blue-200 underline-offset-2 hover:decoration-brand text-xs"
      onClick={onClick}
      type="button"
    >
      {content}
    </button>
  ) : (
    <span className="font-mono tabular-nums text-xs">{content}</span>
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
    return (
      <div className="space-y-1.5">
        <div
          className={
            "flex items-center justify-between border px-2 py-1 text-xs " +
            (balance.isBalanced
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800")
          }
        >
          <span className="font-semibold">
            Persamaan Dasar Akuntansi (Aset = Kewajiban + Ekuitas)
          </span>
          <span className="font-mono font-bold tabular-nums">
            {balance.isBalanced ? "✓ Seimbang" : "Selisih Rp " + formatMoney(balance.difference)}
          </span>
        </div>
        <div className="grid gap-1.5 md:grid-cols-3">
          {balance.sections.map((section) => (
            <section className="border border-slate-200 bg-white flex flex-col" key={section.key}>
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-2 py-1">
                <h3 className="text-xs font-bold text-slate-800">{section.label}</h3>
                <span className="font-mono text-xs font-bold tabular-nums text-slate-900">
                  Rp {formatMoney(section.total)}
                </span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs">
                  <tbody>
                    {section.rows.map((row, idx) => (
                      <tr
                        className={
                          (idx % 2 ? "bg-slate-50/60" : "bg-white") +
                          " hover:bg-blue-50/40 border-b border-slate-100"
                        }
                        key={row.accountId}
                      >
                        <td className="px-2 py-1">
                          <span className="font-mono text-xs tabular-nums text-slate-600 font-semibold">
                            {row.code}
                          </span>
                          <span className="ml-1.5 text-slate-800">{row.name}</span>
                        </td>
                        <td className="px-2 py-1 text-right">
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
              </div>
            </section>
          ))}
        </div>
        <div className="border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span>
              Total Aset:{" "}
              <strong className="font-mono tabular-nums text-slate-900">
                Rp {formatMoney(balance.totalAssets)}
              </strong>
            </span>
            <span>
              Total Kewajiban:{" "}
              <strong className="font-mono tabular-nums text-slate-900">
                Rp {formatMoney(balance.totalLiabilities)}
              </strong>
            </span>
            <span>
              Total Ekuitas:{" "}
              <strong className="font-mono tabular-nums text-slate-900">
                Rp {formatMoney(balance.totalEquity)}
              </strong>
            </span>
            <span>
              Laba Berjalan:{" "}
              <strong className="font-mono tabular-nums text-emerald-700">
                Rp {formatMoney(balance.currentEarnings)}
              </strong>
            </span>
          </div>
        </div>
      </div>
    );
  }

  function trialView() {
    if (!trial) return null;
    return (
      <section className="border border-slate-200 bg-white">
        <div
          className={
            "flex items-center justify-between border-b px-2 py-1 text-xs " +
            (trial.isBalanced
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800")
          }
        >
          <div>
            <h3 className="font-bold">Neraca Saldo</h3>
          </div>
          <span className="font-mono font-bold tabular-nums">
            Debit: Rp {formatMoney(trial.totalDebit)} · Kredit: Rp {formatMoney(trial.totalCredit)}
            {trial.isBalanced
              ? " (Seimbang)"
              : " (Selisih Rp " + formatMoney(trial.difference) + ")"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead className="sticky top-0 bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-2 py-1">Kode / Akun</th>
                <th className="px-2 py-1">Klasifikasi</th>
                <th className="px-2 py-1 text-right">Saldo Debit</th>
                <th className="px-2 py-1 text-right">Saldo Kredit</th>
              </tr>
            </thead>
            <tbody>
              {trial.rows.map((row, index) => (
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
                  <td className="px-2 py-1 text-[11px] text-slate-500">{row.classification}</td>
                  <td className="px-2 py-1 text-right">
                    <ReportAmount
                      onClick={() => void openDrillDown(row.accountId)}
                      value={row.debitBalance}
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <ReportAmount
                      onClick={() => void openDrillDown(row.accountId)}
                      value={row.creditBalance}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-100 font-bold text-slate-800">
                <td className="px-2 py-1" colSpan={2}>
                  Total
                </td>
                <td className="px-2 py-1 text-right">
                  <ReportAmount value={trial.totalDebit} />
                </td>
                <td className="px-2 py-1 text-right">
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
                <BarChart3 size={12} /> Laba Rugi Komparatif
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
                  (tab === "trial" ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100")
                }
                onClick={() => setTab("trial")}
                type="button"
              >
                <FileText size={12} /> Neraca Saldo
              </button>
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
              Mulai
              <input
                className={inputClass}
                onChange={(event) => setPeriodStart(event.target.value)}
                type="date"
                value={periodStart}
              />
            </label>
            <label className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
              Sampai
              <input
                className={inputClass}
                onChange={(event) => setPeriodEnd(event.target.value)}
                type="date"
                value={periodEnd}
              />
            </label>
            {tab === "income" && (
              <>
                <span className="text-slate-300">|</span>
                <label className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
                  Bandingkan:
                  <input
                    className={inputClass}
                    onChange={(event) => setCompareStart(event.target.value)}
                    type="date"
                    value={compareStart}
                  />
                </label>
                <label className="flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
                  s/d
                  <input
                    className={inputClass}
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
