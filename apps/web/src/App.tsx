import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronRight,
  CircleDollarSign,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  WalletCards,
} from "lucide-react";
import type { SourceModule } from "@keuangan-apotek/shared";
import CoAPage from "./pages/CoAPage";
import GeneralJournalPage from "./pages/GeneralJournalPage";
import CashBankPage from "./pages/CashBankPage";
import ConsignmentPage from "./pages/ConsignmentPage";
import PBFInvoicesPage from "./pages/PBFInvoicesPage";
import POSClearingPage from "./pages/POSClearingPage";
import BankReconPage from "./pages/BankReconPage";
import ReportsPage from "./pages/ReportsPage";
import StressTestPage from "./pages/StressTestPage";
import SettingsPage from "./pages/SettingsPage";

const foundationSourceModule: SourceModule = "GENERAL";

const modules = [
  { label: "Ringkasan", icon: LayoutDashboard },
  { label: "Bagan Akun", icon: BookOpen },
  { label: "Jurnal Umum", icon: Activity },
  { label: "POS Clearing", icon: CircleDollarSign },
  { label: "Faktur PBF", icon: CircleDollarSign },
  { label: "Konsinyasi", icon: CircleDollarSign },
  { label: "Kas & Bank", icon: WalletCards },
  { label: "Rekonsiliasi Bank", icon: WalletCards },
  { label: "Laporan Keuangan", icon: BarChart3 },
  { label: "Uji Beban", icon: Activity },
];

const modulePaths: Record<string, string> = {
  Ringkasan: "/",
  "Bagan Akun": "/coa",
  "Jurnal Umum": "/jurnal",
  "POS Clearing": "/pos-clearing",
  "Faktur PBF": "/faktur-pbf",
  Konsinyasi: "/konsinyasi",
  "Kas & Bank": "/kas-bank",
  "Rekonsiliasi Bank": "/rekonsiliasi-bank",
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

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
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-sm font-bold text-white">
            KA
          </div>
          {!sidebarCollapsed && (
            <div>
              <p className="text-sm font-bold tracking-tight">Keuangan Apotek</p>
              <p className="text-[11px] text-muted">Finance workspace</p>
            </div>
          )}
        </div>
        <nav className="space-y-1 px-3 py-5" aria-label="Navigasi utama">
          {!sidebarCollapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Menu utama
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
              Sistem siap
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
              IZ
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-none space-y-6 p-6 lg:p-10">
          {activeModule === "Pengaturan" ? (
            <SettingsPage />
          ) : activeModule === "Bagan Akun" ? (
            <CoAPage />
          ) : activeModule === "Jurnal Umum" ? (
            <GeneralJournalPage />
          ) : activeModule === "POS Clearing" ? (
            <POSClearingPage />
          ) : activeModule === "Faktur PBF" ? (
            <PBFInvoicesPage />
          ) : activeModule === "Konsinyasi" ? (
            <ConsignmentPage />
          ) : activeModule === "Kas & Bank" ? (
            <CashBankPage />
          ) : activeModule === "Rekonsiliasi Bank" ? (
            <BankReconPage />
          ) : activeModule === "Laporan Keuangan" ? (
            <ReportsPage />
          ) : activeModule === "Uji Beban" ? (
            <StressTestPage />
          ) : (
            <>
              <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="max-w-2xl">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                    Phase 0 · Foundation
                  </p>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    Ruang kerja finansial apotek yang rapi dan terukur.
                  </h2>
                  <p className="mt-3 leading-7 text-muted">
                    Fondasi aplikasi telah disiapkan untuk pencatatan double-entry, data grid cepat,
                    dan laporan yang dapat ditelusuri sampai ke jurnal pembentuknya.
                  </p>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-3">
                {[
                  ["Saldo kas & bank", "Rp 0", "Belum ada transaksi"],
                  ["Jurnal bulan ini", "0", "Draft & posted"],
                  ["Status database", "Ready", "SQLite WAL enabled"],
                ].map(([label, value, note]) => (
                  <article
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                    key={label}
                  >
                    <p className="text-sm text-muted">{label}</p>
                    <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">{value}</p>
                    <p className="mt-1 text-xs text-slate-400">{note}</p>
                  </article>
                ))}
              </section>

              <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-sm font-semibold">Modul {activeModule} siap dikembangkan</p>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
                  Shell navigasi ini menjadi titik awal implementasi modul sesuai roadmap. Data
                  nyata akan muncul setelah database dan alur transaksi diaktifkan.
                </p>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
