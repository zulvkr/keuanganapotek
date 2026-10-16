import { useEffect, useState } from "react";
import {
  BarChart3,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  Table,
  Shield,
  Lock,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { SourceModule } from "@keuangan-apotek/shared";
import DailyTransactionsPage from "./pages/DailyTransactionsPage";
import ReportsPage from "./pages/ReportsPage";
import AdvancedPage, { advancedTabs, type AdvancedTab } from "./pages/AdvancedPage";
import LoginPage from "./pages/LoginPage";
import { ToastContainer } from "./components/ToastContainer";
import { useAuth } from "./lib/auth";
import { invalidateAccountingQueries } from "./lib/mutations";
import { toast } from "./lib/toast";

const foundationSourceModule: SourceModule = "GENERAL";

const modules = [
  { label: "Buku Transaksi", icon: Table, minRole: "asisten" },
  { label: "Laporan Keuangan", icon: BarChart3, minRole: "admin" },
  { label: "Advanced", icon: SlidersHorizontal, minRole: "admin" },
];

const modulePaths: Record<string, string> = {
  "Buku Transaksi": "/transaksi",
  "Laporan Keuangan": "/laporan-keuangan",
  Advanced: "/advanced",
};

const advancedPathToTab: Record<string, AdvancedTab> = {
  "/advanced": "Master Transaksi",
  "/master-transaksi": "Master Transaksi",
  "/jurnal": "Jurnal Umum",
  "/coa": "Bagan Akun",
  "/pengaturan": "Pengaturan",
};

const validPaths = new Set([
  "/",
  "/transaksi",
  "/laporan-keuangan",
  "/advanced",
  "/master-transaksi",
  "/jurnal",
  "/coa",
  "/pengaturan",
]);

function resolveRoute(pathname: string): { module: string; advancedTab: AdvancedTab } {
  if (pathname === "/" || pathname === "/transaksi") {
    return { module: "Buku Transaksi", advancedTab: "Master Transaksi" };
  }
  if (pathname === "/laporan-keuangan") {
    return { module: "Laporan Keuangan", advancedTab: "Master Transaksi" };
  }
  if (pathname in advancedPathToTab) {
    return { module: "Advanced", advancedTab: advancedPathToTab[pathname]! };
  }
  return { module: "Buku Transaksi", advancedTab: "Master Transaksi" };
}

function navigateTo(pathname: string) {
  window.history.pushState({}, "", pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function App() {
  const queryClient = useQueryClient();
  const { user, token, logout } = useAuth();

  const [route, setRoute] = useState(() => resolveRoute(window.location.pathname));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    const handlePopState = () => setRoute(resolveRoute(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    if (!validPaths.has(window.location.pathname)) {
      window.history.replaceState({}, "", modulePaths["Buku Transaksi"]);
    }
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // If user is not authenticated, show the Login Screen
  if (!user || !token) {
    return (
      <>
        <LoginPage
          onLoginSuccess={() => {
            invalidateAccountingQueries(queryClient);
          }}
        />
        <ToastContainer />
      </>
    );
  }

  const { module: activeModule, advancedTab: activeAdvancedTab } = route;
  const isAsisten = user.role === "asisten";

  function handleLogout() {
    setShowUserDropdown(false);
    logout();
    invalidateAccountingQueries(queryClient);
    toast.info("Anda telah keluar dari sistem");
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-ink text-xs font-sans">
      <aside
        className={`fixed inset-y-0 left-0 hidden border-r border-slate-200 bg-white transition-[width] duration-150 lg:block z-30 ${sidebarCollapsed ? "w-11" : "w-44"}`}
      >
        <div
          className={`flex h-8 items-center border-b border-slate-200 bg-slate-50 ${sidebarCollapsed ? "justify-center px-1" : "gap-2 px-2.5"}`}
        >
          <div className="grid h-5 w-5 place-items-center rounded bg-brand text-[10px] font-bold text-white shrink-0">
            KA
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold leading-none truncate text-slate-800">
                Keuangan Apotek
              </p>
              <p className="text-[10px] text-muted leading-tight truncate">Terminal Keuangan</p>
            </div>
          )}
        </div>

        <nav className="space-y-0.5 p-1" aria-label="Navigasi utama">
          {!sidebarCollapsed && (
            <p className="px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Menu Utama
            </p>
          )}
          {modules.map(({ label, icon: Icon, minRole }) => {
            const isRestricted = isAsisten && minRole === "admin";
            return (
              <button
                aria-label={sidebarCollapsed ? label : undefined}
                className={`flex w-full items-center rounded py-1 text-xs transition ${
                  sidebarCollapsed ? "justify-center px-1" : "gap-2 px-2 text-left"
                } ${
                  activeModule === label
                    ? "bg-brand text-white font-semibold"
                    : isRestricted
                      ? "text-slate-400 hover:bg-slate-50"
                      : "text-slate-700 hover:bg-slate-100"
                }`}
                key={label}
                onClick={() => navigateTo(modulePaths[label]!)}
                title={sidebarCollapsed ? label : undefined}
                type="button"
              >
                <Icon
                  size={14}
                  strokeWidth={activeModule === label ? 2.2 : 1.8}
                  className="shrink-0"
                />
                {!sidebarCollapsed && (
                  <span className="truncate flex items-center justify-between w-full">
                    <span>{label}</span>
                    {isRestricted && <Lock size={11} className="text-slate-400 ml-1 shrink-0" />}
                  </span>
                )}
                {!sidebarCollapsed && activeModule === label && (
                  <ChevronRight className="ml-auto shrink-0 opacity-80" size={13} />
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      <main
        className={`transition-[padding] duration-150 ${sidebarCollapsed ? "lg:pl-11" : "lg:pl-44"}`}
        data-source-module={foundationSourceModule}
      >
        <header className="sticky top-0 z-20 flex h-8 items-center justify-between border-b border-slate-200 bg-white/95 px-2.5 backdrop-blur-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              aria-label={sidebarCollapsed ? "Perluas navigasi" : "Ciutkan navigasi"}
              className="hidden rounded p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 lg:inline-flex"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              title={sidebarCollapsed ? "Perluas navigasi" : "Ciutkan navigasi"}
              type="button"
            >
              {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </button>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted">Apotek /</span>
              <h1 className="text-xs font-bold text-slate-900 truncate">
                {activeModule === "Advanced" ? "Advanced" : activeModule}
              </h1>
              {activeModule === "Advanced" && (
                <>
                  <span className="text-[11px] text-muted">/</span>
                  <span className="text-xs font-semibold text-slate-700 truncate">
                    {activeAdvancedTab}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 tabular-nums">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Sistem Aktif
            </span>

            {/* Role & User Badge */}
            <button
              type="button"
              onClick={() => setShowUserDropdown((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold transition ${
                isAsisten
                  ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                  : "border-purple-200 bg-purple-50 text-purple-900 hover:bg-purple-100"
              }`}
            >
              <Shield size={12} className={isAsisten ? "text-amber-600" : "text-purple-600"} />
              <span className="font-bold">{isAsisten ? "Asisten" : "Admin"}</span>
              <span className="text-[10px] opacity-75 font-normal">({user.username})</span>
            </button>

            {/* User Dropdown */}
            {showUserDropdown && (
              <div className="absolute right-0 top-8 z-50 w-56 rounded-lg border border-slate-200 bg-white shadow-xl p-2.5 space-y-2 text-xs">
                <div className="border-b border-slate-100 pb-2">
                  <p className="font-bold text-slate-800">{user.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">@{user.username}</p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[10px] font-bold ${
                        isAsisten
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-purple-100 text-purple-800 border border-purple-200"
                      }`}
                    >
                      {isAsisten
                        ? "Role: Asisten (Akses Terbatas: Non-Gaji)"
                        : "Role: Admin (Akses Lengkap)"}
                    </span>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                  >
                    <LogOut size={13} className="text-rose-500" />
                    <span>Keluar dari Akun</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="p-2 space-y-1.5 max-w-full">
          {/* If Asisten attempts to open restricted module */}
          {isAsisten && activeModule !== "Buku Transaksi" ? (
            <div className="rounded border border-amber-200 bg-amber-50/80 p-8 text-center space-y-3 max-w-lg mx-auto my-8">
              <ShieldAlert size={40} className="mx-auto text-amber-600" />
              <h2 className="text-sm font-bold text-slate-800">
                Akses Terbatas — Khusus Admin Apotek
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Modul <strong>{activeModule}</strong> hanya dapat diakses oleh Admin. Akun ber-role{" "}
                <strong>Asisten</strong> hanya memiliki akses ke <strong>Buku Transaksi</strong>{" "}
                dengan CoA yang telah diizinkan (transaksi sensitif seperti Gaji disembunyikan).
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo(modulePaths["Buku Transaksi"]!)}
                  className="rounded bg-brand px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  Buka Buku Transaksi
                </button>
              </div>
            </div>
          ) : activeModule === "Laporan Keuangan" ? (
            <ReportsPage />
          ) : activeModule === "Advanced" ? (
            <AdvancedPage
              activeTab={activeAdvancedTab}
              onTabChange={(tab) => {
                const target = advancedTabs.find((t) => t.id === tab);
                if (target) {
                  navigateTo(target.path);
                }
              }}
            />
          ) : (
            <DailyTransactionsPage />
          )}
        </div>
      </main>

      <ToastContainer />
    </div>
  );
}

export default App;
