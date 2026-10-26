import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter,
  Keyboard,
  Plus,
  RotateCcw,
} from "lucide-react";
import { formatMonthYearId, stepMonth } from "./daily-transaction.types";
import { KeyTipBadge } from "./KeyboardTipsOverlay";

export type TransactionToolbarProps = {
  selectedMonth: string;
  thisMonthKey: string;
  filterMode: "month" | "custom" | "all";
  startDate: string;
  endDate: string;
  showNeracaFilter: boolean;
  selectedAccountCount: number;
  hasActiveFiltersAndSort: boolean;
  activeFiltersCount: number;
  filteredCount: number;
  viewMode: "cards" | "table";
  isKeyTipsActive: boolean;
  onSelectMonth: (month: string) => void;
  onStepMonth: (offset: number) => void;
  onCurrentMonth: () => void;
  onPrevMonth: () => void;
  onAllPeriod: () => void;
  onToggleCustomMode: () => void;
  onChangeStartDate: (date: string) => void;
  onChangeEndDate: (date: string) => void;
  onToggleNeracaFilter: () => void;
  onResetAllFiltersAndSort: () => void;
  onChangeViewMode: (mode: "cards" | "table") => void;
  onOpenHelp: () => void;
  onAddNew: () => void;
};

/**
 * ATURAN TATA LETAK UI (UI LAYOUT RULE):
 * Tombol "Reset Filter & Sort" HARUS selalu berada inline pada baris toolbar utama (primary toolbar row),
 * dan DILARANG KERAS diletakkan pada extra row terpisah yang muncul-hilang secara dinamis.
 * Penempatan inline ini mencegah pergeseran layout (layout shift) dan menjaga stabilitas perhitungan tinggi tabel spreadsheet.
 */
export function TransactionToolbar({
  selectedMonth,
  thisMonthKey,
  filterMode,
  startDate,
  endDate,
  showNeracaFilter,
  selectedAccountCount,
  hasActiveFiltersAndSort,
  activeFiltersCount,
  filteredCount,
  viewMode,
  isKeyTipsActive,
  onSelectMonth,
  onStepMonth,
  onCurrentMonth,
  onPrevMonth,
  onAllPeriod,
  onToggleCustomMode,
  onChangeStartDate,
  onChangeEndDate,
  onToggleNeracaFilter,
  onResetAllFiltersAndSort,
  onChangeViewMode,
  onOpenHelp,
  onAddNew,
}: TransactionToolbarProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-1.5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        {/* Left: Navigation, Presets, Filter Akun, and Inline Reset Filter & Sort */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Monthly Stepper & Selector */}
          <div className="inline-flex items-center rounded border border-slate-200 bg-slate-50 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => onStepMonth(-1)}
              className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900 transition"
              title="Bulan sebelumnya"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft size={13} />
            </button>

            <div className="flex items-center px-0.5">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  if (e.target.value) {
                    onSelectMonth(e.target.value);
                  }
                }}
                className="rounded border-0 bg-transparent px-1 py-0.5 text-xs font-semibold text-slate-800 outline-none hover:bg-white transition cursor-pointer"
                title={
                  selectedMonth
                    ? `Pilih bulan (${formatMonthYearId(selectedMonth)})`
                    : "Pilih bulan"
                }
              />
            </div>

            <button
              type="button"
              onClick={() => onStepMonth(1)}
              className="rounded p-1 text-slate-600 hover:bg-white hover:text-slate-900 transition"
              title="Bulan berikutnya"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          {/* Quick Presets */}
          <div className="inline-flex items-center rounded border border-slate-200 bg-slate-50 p-0.5 shrink-0">
            <button
              type="button"
              onClick={onCurrentMonth}
              className={`relative rounded px-1.5 py-0.5 text-xs font-medium transition ${
                filterMode === "month" && selectedMonth === thisMonthKey
                  ? "bg-white font-semibold text-brand shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bulan Ini
              <KeyTipBadge keyChar="M" visible={isKeyTipsActive} />
            </button>
            <button
              type="button"
              onClick={onPrevMonth}
              className={`relative rounded px-1.5 py-0.5 text-xs font-medium transition hidden sm:inline-block ${
                filterMode === "month" && selectedMonth === stepMonth(thisMonthKey, -1)
                  ? "bg-white font-semibold text-brand shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bulan Lalu
              <KeyTipBadge keyChar="L" visible={isKeyTipsActive} />
            </button>
            <button
              type="button"
              onClick={onAllPeriod}
              className={`relative rounded px-1.5 py-0.5 text-xs font-medium transition ${
                filterMode === "all"
                  ? "bg-white font-semibold text-brand shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua
              <KeyTipBadge keyChar="A" visible={isKeyTipsActive} />
            </button>
            <button
              type="button"
              onClick={onToggleCustomMode}
              className={`relative rounded px-1.5 py-0.5 text-xs font-medium transition ${
                filterMode === "custom"
                  ? "bg-white font-semibold text-brand shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Rentang tanggal kustom"
            >
              <Calendar size={12} className="inline mr-0.5" />
              Kustom
              <KeyTipBadge keyChar="K" visible={isKeyTipsActive} />
            </button>
          </div>

          {/* Custom Range (muncul inline jika mode kustom aktif) */}
          {filterMode === "custom" && (
            <div className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50/50 px-1 py-0.5 text-xs text-slate-700 shrink-0">
              <input
                type="date"
                value={startDate}
                onChange={(e) => onChangeStartDate(e.target.value)}
                className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs tabular-nums outline-none focus:border-brand"
              />
              <span className="text-slate-400 text-[10px]">s/d</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => onChangeEndDate(e.target.value)}
                className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs tabular-nums outline-none focus:border-brand"
              />
            </div>
          )}

          {/* Filter Toggle Button */}
          <button
            type="button"
            onClick={onToggleNeracaFilter}
            className={`relative inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-semibold transition shrink-0 ${
              showNeracaFilter
                ? "border-brand bg-blue-50 text-brand"
                : selectedAccountCount > 0
                  ? "border-blue-300 bg-blue-50/70 text-brand"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            title="Filter akun dari Saldo Akhir Neraca (Maksimal 2 akun)"
          >
            <Filter
              size={12}
              className={
                selectedAccountCount > 0 || showNeracaFilter ? "text-brand" : "text-slate-500"
              }
            />
            <span>Filter Akun {selectedAccountCount > 0 ? `(${selectedAccountCount}/2)` : ""}</span>
            {showNeracaFilter ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <KeyTipBadge keyChar="F" visible={isKeyTipsActive} />
          </button>

          {/*
            UI RULE: Tombol Reset Filter & Sort selalu diletakkan inline di sini!
            TIDAK menggunakan extra row terpisah agar layout tabel tetap stabil tanpa pergeseran vertikal.
          */}
          {hasActiveFiltersAndSort && (
            <button
              type="button"
              onClick={onResetAllFiltersAndSort}
              className="relative inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800 transition shrink-0 cursor-pointer shadow-2xs"
              title="Reset semua filter dan kembalikan urutan sortir ke default buku kas"
            >
              <RotateCcw size={11} className="stroke-[2.5]" />
              <span>Reset Filter & Sort</span>
              {activeFiltersCount > 0 && (
                <span className="rounded-full bg-rose-200 px-1.5 py-0.2 text-[10px] font-bold text-rose-800">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Right: Actions, View Switcher & Shortcuts */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <span className="text-[11px] text-slate-400 tabular-nums hidden lg:inline mr-1">
            {filteredCount} transaksi
          </span>

          {/* View Mode Toggle */}
          <div className="relative inline-flex items-center rounded border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => onChangeViewMode("cards")}
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition ${
                viewMode === "cards"
                  ? "bg-white text-brand shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Tampilan Kartu (Ramah Mobile)"
            >
              Kartu
            </button>
            <button
              type="button"
              onClick={() => onChangeViewMode("table")}
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition ${
                viewMode === "table"
                  ? "bg-white text-brand shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Tampilan Tabel Spreadsheet"
            >
              Tabel
            </button>
            <KeyTipBadge keyChar="V" visible={isKeyTipsActive} />
          </div>

          {/* Keyboard Shortcuts Help Button */}
          <button
            type="button"
            onClick={onOpenHelp}
            className="relative inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-brand transition shrink-0"
            title="Bantuan Pintasan Keyboard (Alt / ?)"
            aria-label="Bantuan Pintasan Keyboard"
          >
            <Keyboard size={13} />
            <span className="hidden sm:inline">Pintasan</span>
            <KeyTipBadge keyChar="?" visible={isKeyTipsActive} />
          </button>

          <button
            type="button"
            onClick={onAddNew}
            className="relative inline-flex items-center gap-1 rounded bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 transition shrink-0 shadow-xs"
          >
            <Plus size={13} /> Baris Baru
            <KeyTipBadge keyChar="N" visible={isKeyTipsActive} />
          </button>
        </div>
      </div>
    </div>
  );
}
