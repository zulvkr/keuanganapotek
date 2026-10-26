import React from "react";
import { Trash2, Calendar, User, Tag, Download, X } from "lucide-react";

export interface BulkActionBarProps {
  selectedCount: number;
  totalAmountSen?: number;
  onClearSelection: () => void;
  onOpenBulkDelete: () => void;
  onOpenBulkDate: () => void;
  onOpenBulkPic: () => void;
  onOpenBulkType: () => void;
  onExportCsv: () => void;
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onOpenBulkDelete,
  onOpenBulkDate,
  onOpenBulkPic,
  onOpenBulkType,
  onExportCsv,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="region"
      aria-label="Bulk actions toolbar"
      className="fixed bottom-12 sm:bottom-14 left-1/2 -translate-x-1/2 z-40 flex max-w-[95vw] items-center gap-2 md:gap-3 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 text-white shadow-2xl backdrop-blur-md transition-all sm:px-4"
    >
      {/* Compact Count Badge */}
      <div className="flex items-center gap-1.5 border-r border-slate-700 pr-2 md:pr-3 shrink-0">
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
          {selectedCount}
        </span>
        <span className="text-xs font-medium text-slate-200">Terpilih</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
        <button
          type="button"
          onClick={onOpenBulkDate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
          title="Ubah tanggal untuk transaksi terpilih"
        >
          <Calendar size={13} className="text-blue-400" />
          <span className="hidden sm:inline">Ubah Tanggal</span>
          <span className="sm:hidden">Tanggal</span>
        </button>

        <button
          type="button"
          onClick={onOpenBulkPic}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
          title="Ubah PIC untuk transaksi terpilih"
        >
          <User size={13} className="text-amber-400" />
          <span>PIC</span>
        </button>

        <button
          type="button"
          onClick={onOpenBulkType}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
          title="Ubah tipe transaksi untuk transaksi terpilih"
        >
          <Tag size={13} className="text-purple-400" />
          <span className="hidden sm:inline">Ubah Tipe</span>
          <span className="sm:hidden">Tipe</span>
        </button>

        <button
          type="button"
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
          title="Ekspor transaksi terpilih ke CSV"
        >
          <Download size={13} className="text-emerald-400" />
          <span className="hidden sm:inline">Ekspor CSV</span>
          <span className="sm:hidden">CSV</span>
        </button>

        <button
          type="button"
          onClick={onOpenBulkDelete}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600/90 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-600"
          title="Hapus transaksi terpilih beserta jurnalnya"
        >
          <Trash2 size={13} />
          <span>Hapus</span>
        </button>
      </div>

      {/* Clear selection */}
      <button
        type="button"
        onClick={onClearSelection}
        className="ml-1 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        title="Batalkan pilihan"
        aria-label="Batalkan pilihan"
      >
        <X size={15} />
      </button>
    </div>
  );
}
