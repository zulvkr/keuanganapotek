import { useEffect, useRef, useState } from "react";
import {
  generateStressInvoices,
  generateStressJournals,
  type StressInvoice,
  type StressJournal,
} from "../test-utils/stress-data";
import { VirtualizedRows } from "../components/grid/VirtualizedRows";

const numberFormat = new Intl.NumberFormat("id-ID");
const stressJournals = generateStressJournals();
const stressInvoices = generateStressInvoices();

function JournalGrid({ rows }: { rows: StressJournal[] }) {
  return (
    <VirtualizedRows
      rows={rows}
      rowHeight={54}
      ariaLabel="Grid stress jurnal"
      renderRow={(row) => (
        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] items-center gap-4 border-b border-slate-50 px-5 py-3 text-sm">
          <span className="font-mono font-semibold tabular-nums">{row.journalNo}</span>
          <span className="tabular-nums text-slate-500">{row.entryDate}</span>
          <span className="text-xs text-slate-500">{row.sourceModule}</span>
          <span className="text-right font-mono tabular-nums">
            Rp {numberFormat.format(row.debit / 100)}
          </span>
        </div>
      )}
    />
  );
}

function InvoiceGrid({ rows }: { rows: StressInvoice[] }) {
  return (
    <VirtualizedRows
      rows={rows}
      rowHeight={54}
      ariaLabel="Grid stress faktur PBF"
      renderRow={(row) => (
        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] items-center gap-4 border-b border-slate-50 px-5 py-3 text-sm">
          <span className="font-mono font-semibold tabular-nums">{row.invoiceNumber}</span>
          <span className="text-slate-500">{row.pbfName}</span>
          <span className="text-right font-mono tabular-nums">
            Rp {numberFormat.format(row.dppAmount / 100)}
          </span>
          <span className="text-right font-mono tabular-nums">
            Rp {numberFormat.format(row.totalAmount / 100)}
          </span>
        </div>
      )}
    />
  );
}

function StressTestPage() {
  const [kind, setKind] = useState<"journals" | "invoices">("journals");
  const renderStartedAt = useRef(performance.now());
  useEffect(() => {
    (window as Window & { __phase6GridRenderMs?: number }).__phase6GridRenderMs =
      performance.now() - renderStartedAt.current;
  }, []);
  const startedAt = performance.now();
  const renderElapsed = Math.max(0, performance.now() - startedAt);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Phase 6 · Hardening
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight">Stress test data grid</h2>
        <p className="mt-1 text-sm text-muted">
          TanStack Virtual hanya memasang baris yang terlihat; navigasi scroll tetap mencakup
          seluruh fixture.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${kind === "journals" ? "bg-brand text-white" : "border border-slate-200 text-slate-600"}`}
            onClick={() => setKind("journals")}
            type="button"
          >
            5.000 jurnal
          </button>
          <button
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${kind === "invoices" ? "bg-brand text-white" : "border border-slate-200 text-slate-600"}`}
            onClick={() => setKind("invoices")}
            type="button"
          >
            2.000 faktur PBF
          </button>
          <span className="ml-auto rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            Virtualizer aktif · {renderElapsed.toFixed(1)} ms
          </span>
        </div>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr] gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {kind === "journals" ? (
            <>
              <span>Nomor jurnal</span>
              <span>Tanggal</span>
              <span>Sumber</span>
              <span className="text-right">Nominal</span>
            </>
          ) : (
            <>
              <span>Nomor faktur</span>
              <span>Distributor</span>
              <span>DPP</span>
              <span className="text-right">Total</span>
            </>
          )}
        </div>
        {kind === "journals" ? (
          <JournalGrid rows={stressJournals} />
        ) : (
          <InvoiceGrid rows={stressInvoices} />
        )}
      </section>
    </div>
  );
}

export default StressTestPage;
