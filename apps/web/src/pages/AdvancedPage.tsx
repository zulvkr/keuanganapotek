import { Activity, BookOpen, Settings2, SlidersHorizontal } from "lucide-react";
import CoAPage from "./CoAPage";
import GeneralJournalPage from "./GeneralJournalPage";
import MasterTransactionPage from "./MasterTransactionPage";
import SettingsPage from "./SettingsPage";

export type AdvancedTab = "Master Transaksi" | "Jurnal Umum" | "Bagan Akun" | "Pengaturan";

export interface AdvancedTabItem {
  id: AdvancedTab;
  label: string;
  icon: typeof SlidersHorizontal;
  path: string;
}

export const advancedTabs: AdvancedTabItem[] = [
  {
    id: "Master Transaksi",
    label: "Master Transaksi",
    icon: SlidersHorizontal,
    path: "/master-transaksi",
  },
  {
    id: "Jurnal Umum",
    label: "Jurnal Umum",
    icon: Activity,
    path: "/jurnal",
  },
  {
    id: "Bagan Akun",
    label: "Bagan Akun",
    icon: BookOpen,
    path: "/coa",
  },
  {
    id: "Pengaturan",
    label: "Pengaturan",
    icon: Settings2,
    path: "/pengaturan",
  },
];

interface AdvancedPageProps {
  activeTab: AdvancedTab;
  onTabChange: (tab: AdvancedTab) => void;
}

export default function AdvancedPage({ activeTab, onTabChange }: AdvancedPageProps) {
  return (
    <div className="space-y-1.5">
      <section className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-white px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 pr-1">
            <span className="text-xs font-bold text-slate-800">Advanced</span>
            <span className="text-[11px] text-slate-300">|</span>
          </div>
          <nav aria-label="Tab modul advanced" className="flex flex-wrap items-center gap-1">
            {advancedTabs.map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTabChange(id)}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition ${
                    isActive
                      ? "bg-brand text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={13} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </section>

      <div>
        {activeTab === "Master Transaksi" && <MasterTransactionPage />}
        {activeTab === "Jurnal Umum" && <GeneralJournalPage />}
        {activeTab === "Bagan Akun" && <CoAPage />}
        {activeTab === "Pengaturan" && <SettingsPage />}
      </div>
    </div>
  );
}
