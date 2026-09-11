import { useState } from "react";
import { Activity, BookOpen, ChevronRight, CircleDollarSign, LayoutDashboard, Settings2, WalletCards } from "lucide-react";
import type { SourceModule } from "@keuangan-apotek/shared";

const foundationSourceModule: SourceModule = "GENERAL";

const modules = [
  { label: "Ringkasan", icon: LayoutDashboard },
  { label: "Bagan Akun", icon: BookOpen },
  { label: "Jurnal Umum", icon: Activity },
  { label: "POS Clearing", icon: CircleDollarSign },
  { label: "Kas & Bank", icon: WalletCards },
];

function App() {
  const [activeModule, setActiveModule] = useState("Ringkasan");

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white">KA</div>
          <div>
            <p className="text-sm font-bold tracking-tight">Keuangan Apotek</p>
            <p className="text-[11px] text-muted">Finance workspace</p>
          </div>
        </div>
        <nav className="space-y-1 px-3 py-5" aria-label="Navigasi utama">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Menu utama</p>
          {modules.map(({ label, icon: Icon }) => (
            <button
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${activeModule === label ? "bg-blue-50 font-semibold text-brand" : "text-slate-600 hover:bg-slate-50"}`}
              key={label}
              onClick={() => setActiveModule(label)}
              type="button"
            >
              <Icon size={17} strokeWidth={activeModule === label ? 2.4 : 1.8} />
              <span>{label}</span>
              {activeModule === label && <ChevronRight className="ml-auto" size={15} />}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-5 left-3 right-3">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50" type="button">
            <Settings2 size={17} /> Pengaturan
          </button>
        </div>
      </aside>

      <main className="lg:pl-64" data-source-module={foundationSourceModule}>
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-10">
          <div>
            <p className="text-xs text-muted">Workspace / Modul</p>
            <h1 className="text-lg font-semibold">{activeModule}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">Sistem siap</span>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">IZ</div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-10">
          <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">Phase 0 · Foundation</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ruang kerja finansial apotek yang rapi dan terukur.</h2>
              <p className="mt-3 leading-7 text-muted">Fondasi aplikasi telah disiapkan untuk pencatatan double-entry, data grid cepat, dan laporan yang dapat ditelusuri sampai ke jurnal pembentuknya.</p>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            {[
              ["Saldo kas & bank", "Rp 0", "Belum ada transaksi"],
              ["Jurnal bulan ini", "0", "Draft & posted"],
              ["Status database", "Ready", "SQLite WAL enabled"],
            ].map(([label, value, note]) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
                <p className="text-sm text-muted">{label}</p>
                <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-slate-400">{note}</p>
              </article>
            ))}
          </section>

          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="text-sm font-semibold">Modul {activeModule} siap dikembangkan</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Shell navigasi ini menjadi titik awal implementasi modul sesuai roadmap. Data nyata akan muncul setelah database dan alur transaksi diaktifkan.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
