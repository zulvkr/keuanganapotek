import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronRight,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Table,
  SlidersHorizontal,
} from "lucide-react";
import type { SourceModule } from "@keuangan-apotek/shared";
import CoAPage from "./pages/CoAPage";
import GeneralJournalPage from "./pages/GeneralJournalPage";
import DailyTransactionsPage from "./pages/DailyTransactionsPage";
import MasterTransactionPage from "./pages/MasterTransactionPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import StressTestPage from "./pages/StressTestPage";

const foundationSourceModule: SourceModule = "GENERAL";

const modules = [
  { label: "Ringkasan", icon: LayoutDashboard },
  { label: "Buku Transaksi", icon: Table },
  { label: "Master Transaksi", icon: SlidersHorizontal },
  { label: "Jurnal Umum", icon: Activity },
  { label: "Bagan Akun", icon: BookOpen },
  { label: "Laporan Keuangan", icon: BarChart3 },
];

const modulePaths: Record<string, string> = {
  Ringkasan: "/",
  "Buku Transaksi": "/transaksi",
  "Master Transaksi": "/master-transaksi",
  "Jurnal Umum": "/jurnal",
  "Bagan Akun": "/coa",
  "Laporan Keuangan": "/laporan-keuangan",
  "Uji Beban": "/uji-beban",
  Pengaturan: "/pengaturan",
};

const moduleByPath = new Map(Object.entries(modulePaths).map(([label, path]) => [path, label]));

function routeForPath(pathname: string): string {
  return moduleByPath.get(pathname) ?? "Ringkasan";
}

function navigateTo(pathname: string) {
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function App() {
  const [activeModule, setActiveModule] = useState(() => routeForPath(window.location.pathname));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const handlePopState = () => setActiveModule(routeForPath(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    if (!moduleByPath.has(window.location.pathname)) {
      window.history.replaceState({}, "", modulePaths.Ringkasan);
    }
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside
        className={`fixed inset-y-0 left-0 hidden border-r border-slate-200 bg-white transition-[width] duration-200 lg:block ${sidebarCollapsed ? "w-20" : "w-64"}`}
      >
        <div
          className={`flex h-16 items-center border-b border-slate-100 ${sidebarCollapsed ? "justify-center px-3" : "gap-3 px-6"}`}
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white shadow-sm">
            KA
          </div>
          {!sidebarCollapsed && (
            <div>
              <p className="text-sm font-bold tracking-tight">Keuangan Apotek</p>
              <p className="text-[11px] text-muted">Akuntansi & Mutasi Kas</p>
            </div>
          )}
        </div>
        <nav className="space-y-1 px-3 py-5" aria-label="Navigasi utama">
          {!sidebarCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Menu Utama
            </p>
          )}
          {modules.map(({ label, icon: Icon }) => (
            <button
              aria-label={sidebarCollapsed ? label : undefined}
              className={`flex w-full items-center rounded-lg py-2.5 text-sm transition ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3 text-left"} ${activeModule === label ? "bg-blue-50 font-semibold text-brand" : "text-slate-600 hover:bg-slate-50"}`}
              key={label}
              onClick={() => navigateTo(modulePaths[label]!)}
              title={sidebarCollapsed ? label : undefined}
              type="button"
            >
              <Icon size={17} strokeWidth={activeModule === label ? 2.4 : 1.8} />
              {!sidebarCollapsed && <span>{label}</span>}
              {!sidebarCollapsed && activeModule === label && (
                <ChevronRight className="ml-auto" size={15} />
              )}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-5 left-3 right-3">
          <button
            aria-label={sidebarCollapsed ? "Pengaturan" : undefined}
            className={`flex w-full items-center rounded-lg py-2.5 text-sm transition ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3 text-left"} ${activeModule === "Pengaturan" ? "bg-blue-50 font-semibold text-brand" : "text-slate-600 hover:bg-slate-50"}`}
            onClick={() => navigateTo(modulePaths.Pengaturan!)}
            title={sidebarCollapsed ? "Pengaturan" : undefined}
            type="button"
          >
            <Settings2 size={17} strokeWidth={activeModule === "Pengaturan" ? 2.4 : 1.8} />
            {!sidebarCollapsed && (
              <>
                Pengaturan
                {activeModule === "Pengaturan" && <ChevronRight className="ml-auto" size={15} />}
              </>
            )}
          </button>
        </div>
      </aside>

      <main
        className={sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"}
        data-source-module={foundationSourceModule}
      >
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <button
              aria-label={sidebarCollapsed ? "Perluas navigasi" : "Ciutkan navigasi"}
              className="hidden rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 lg:inline-flex"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              title={sidebarCollapsed ? "Perluas navigasi" : "Ciutkan navigasi"}
              type="button"
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
            <div>
              <p className="text-xs text-muted">Workspace / Modul</p>
              <h1 className="text-lg font-semibold">{activeModule}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
              Sistem Aktif
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
              IZ
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-none space-y-6 p-6 lg:p-10">
          {activeModule === "Pengaturan" ? (
            <SettingsPage />
          ) : activeModule === "Buku Transaksi" ? (
            <DailyTransactionsPage />
          ) : activeModule === "Master Transaksi" ? (
            <MasterTransactionPage />
          ) : activeModule === "Jurnal Umum" ? (
            <GeneralJournalPage />
          ) : activeModule === "Bagan Akun" ? (
            <CoAPage />
          ) : activeModule === "Laporan Keuangan" ? (
            <ReportsPage />
          ) : activeModule === "Uji Beban" ? (
            <StressTestPage />
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="max-w-2xl">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                    Dashboard Keuangan Apotek
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Ruang kerja akuntansi dan pencatatan transaksi apotek.
                  </h2>
                  <p className="mt-3 leading-7 text-muted">
                    Sistem pencatatan terintegrasi dengan pembentukan jurnal double-entry otomatis,
                    pelacakan mutasi dan saldo berjalan 9 akun kas & bank, serta skema metadata
                    dinamis.
                  </p>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-3">
                <article
                  onClick={() => navigateTo(modulePaths["Buku Transaksi"]!)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand cursor-pointer transition"
                >
                  <p className="text-sm font-semibold text-brand">Buku Transaksi</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">Spreadsheet Harian</p>
                  <p className="mt-1 text-xs text-muted">
                    Input transaksi dengan 9 kolom saldo kas/bank live
                  </p>
                </article>
                <article
                  onClick={() => navigateTo(modulePaths["Master Transaksi"]!)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand cursor-pointer transition"
                >
                  <p className="text-sm font-semibold text-brand">Master Transaksi</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">Skema & Template</p>
                  <p className="mt-1 text-xs text-muted">
                    Atur pemetaan debit/kredit dan visual schema builder
                  </p>
                </article>
                <article
                  onClick={() => navigateTo(modulePaths["Laporan Keuangan"]!)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-brand cursor-pointer transition"
                >
                  <p className="text-sm font-semibold text-brand">Laporan Keuangan</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">Neraca & Laba Rugi</p>
                  <p className="mt-1 text-xs text-muted">
                    Sinkron otomatis dengan drill-down ke jurnal
                  </p>
                </article>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
