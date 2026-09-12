import { X } from "lucide-react";

type DrillDownEntry = {
  lineId: string;
  journalNo: string;
  entryDate: string;
  referenceNo: string | null;
  memo: string | null;
  sourceModule: string;
  description: string | null;
  debit: number;
  credit: number;
};

type DrillDownData = {
  account: { code: string; name: string };
  entries: DrillDownEntry[];
  totalDebit: number;
  totalCredit: number;
};

type Props = {
  data: DrillDownData | null;
  loading: boolean;
  error: string;
  onClose: () => void;
  formatMoney: (value: number) => string;
};

export default function DrillDownDrawer({ data, loading, error, onClose, formatMoney }: Props) {
  const visible = Boolean(data || loading || error);
  return (
    <>
      <div
        aria-hidden="true"
        className={
          "fixed inset-0 z-30 bg-slate-900/25 transition-opacity " +
          (visible ? "opacity-100" : "pointer-events-none opacity-0")
        }
        onClick={onClose}
      />
      <aside
        aria-label="Rincian jurnal akun"
        aria-modal="true"
        className={
          "fixed inset-y-0 right-0 z-40 flex w-full max-w-xl flex-col bg-white shadow-2xl transition-transform " +
          (visible ? "translate-x-0" : "translate-x-full")
        }
        role="dialog"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              Drill-down jurnal
            </p>
            <h2 className="mt-1 text-lg font-bold">
              {data ? data.account.code + " · " + data.account.name : "Rincian akun"}
            </h2>
            <p className="mt-1 text-xs text-muted">Daftar transaksi pembentuk nominal laporan.</p>
          </div>
          <button
            aria-label="Tutup rincian jurnal"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>
        {loading && <p className="p-6 text-sm text-muted">Memuat jurnal...</p>}
        {error && (
          <p className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {data && !loading && (
          <>
            <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-5">
              <div className="rounded-xl bg-blue-50 p-3">
                <p className="text-xs text-muted">Total debit</p>
                <p className="mt-1 font-mono font-bold tabular-nums">
                  Rp {formatMoney(data.totalDebit)}
                </p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-muted">Total kredit</p>
                <p className="mt-1 font-mono font-bold tabular-nums">
                  Rp {formatMoney(data.totalCredit)}
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Jurnal</th>
                    <th className="px-3 py-3">Sumber</th>
                    <th className="px-3 py-3 text-right">Debit</th>
                    <th className="px-5 py-3 text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr className="border-b border-slate-100 align-top" key={entry.lineId}>
                      <td className="px-5 py-3">
                        <p className="font-mono font-semibold tabular-nums">{entry.journalNo}</p>
                        <p className="font-mono text-xs tabular-nums text-slate-500">
                          {entry.entryDate}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.description || entry.memo || entry.referenceNo || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{entry.sourceModule}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {entry.debit ? "Rp " + formatMoney(entry.debit) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {entry.credit ? "Rp " + formatMoney(entry.credit) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.entries.length === 0 && (
                <p className="p-8 text-center text-sm text-muted">
                  Tidak ada jurnal pada periode ini.
                </p>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
