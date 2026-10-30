import { createPortal } from "react-dom";
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
  if (!visible) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <aside
        aria-label="Rincian jurnal akun"
        aria-modal="true"
        className="fixed inset-y-0 right-0 z-[9999] flex w-full max-w-xl flex-col bg-white shadow-2xl transition-transform translate-x-0"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
          <div>
            <h2 className="text-xs font-bold text-slate-800">
              {data ? data.account.code + " · " + data.account.name : "Rincian Akun"}
            </h2>
            <p className="text-[11px] text-slate-500">
              Drill-down jurnal pembentuk nominal laporan
            </p>
          </div>
          <button
            aria-label="Tutup rincian jurnal"
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <X size={15} />
          </button>
        </header>
        {loading && <p className="p-3 text-xs text-slate-500">Memuat jurnal...</p>}
        {error && (
          <p className="m-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        )}
        {data && !loading && (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1 text-xs">
              <span>
                Total Debit:{" "}
                <strong className="font-mono tabular-nums text-slate-800">
                  Rp {formatMoney(data.totalDebit)}
                </strong>
              </span>
              <span>
                Total Kredit:{" "}
                <strong className="font-mono tabular-nums text-slate-800">
                  Rp {formatMoney(data.totalCredit)}
                </strong>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-2 py-1">Jurnal</th>
                    <th className="px-2 py-1">Sumber</th>
                    <th className="px-2 py-1 text-right">Debit</th>
                    <th className="px-2 py-1 text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry, index) => (
                    <tr
                      className={
                        (index % 2 ? "bg-slate-50/60" : "bg-white") +
                        " hover:bg-blue-50/40 border-b border-slate-100 align-top"
                      }
                      key={entry.lineId}
                    >
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold tabular-nums text-slate-800">
                            {entry.journalNo}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-slate-500">
                            {entry.entryDate}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          {entry.description || entry.memo || entry.referenceNo || "—"}
                        </p>
                      </td>
                      <td className="px-2 py-1 text-[11px] font-mono text-slate-600">
                        {entry.sourceModule}
                      </td>
                      <td className="px-2 py-1 text-right font-mono tabular-nums text-slate-800">
                        {entry.debit ? "Rp " + formatMoney(entry.debit) : "—"}
                      </td>
                      <td className="px-2 py-1 text-right font-mono tabular-nums text-slate-800">
                        {entry.credit ? "Rp " + formatMoney(entry.credit) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.entries.length === 0 && (
                <p className="p-4 text-center text-xs text-slate-500">
                  Tidak ada jurnal pada periode ini.
                </p>
              )}
            </div>
          </>
        )}
      </aside>
    </>,
    document.body,
  );
}
