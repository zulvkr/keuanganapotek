import { useState, useEffect } from "react";
import { AlertTriangle, Calendar, User, Tag, X } from "lucide-react";
import { senToRupiah, todayIsoDate, type TransactionType } from "@keuangan-apotek/shared";
import type { Account } from "../../lib/queries";
import { IsoDateInput } from "./IsoDateInput";
import { SearchableTransactionTypeSelect } from "./SearchableTransactionTypeSelect";

function formatSen(value: number): string {
  const rupiah = senToRupiah(value);
  const fixed = rupiah.toFixed(2);
  const [whole, fraction] = fixed.split(".");
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}

// 1. Bulk Delete Modal
export interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  totalAmountSen: number;
  onConfirm: () => void;
  isPending: boolean;
}

export function BulkDeleteModal({
  isOpen,
  onClose,
  count,
  totalAmountSen,
  onConfirm,
  isPending,
}: BulkDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-delete-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <h3 id="bulk-delete-title" className="text-base font-semibold text-slate-900">
              Hapus {count} Transaksi?
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Tindakan ini akan menghapus <strong>{count} transaksi</strong> dengan total nominal{" "}
              <strong>Rp {formatSen(totalAmountSen)}</strong>.
            </p>
            <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 border border-amber-200">
              ⚠️ Jurnal terkait pada Jurnal Umum (double-entry) juga akan dihapus secara otomatis.
              Tindakan ini tidak dapat dibatalkan.
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs"
          >
            {isPending ? "Menghapus..." : `Ya, Hapus ${count} Transaksi`}
          </button>
        </div>
      </div>
    </div>
  );
}

// 2. Bulk Date Modal
export interface BulkDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  onConfirm: (targetDate: string) => void;
  isPending: boolean;
}

export function BulkDateModal({
  isOpen,
  onClose,
  count,
  onConfirm,
  isPending,
}: BulkDateModalProps) {
  const [date, setDate] = useState(todayIsoDate());

  useEffect(() => {
    if (isOpen) setDate(todayIsoDate());
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-date-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-800">
            <Calendar size={18} className="text-blue-500" />
            <h3 id="bulk-date-title" className="text-sm font-bold">
              Ubah Tanggal Masal
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-600">
            Pindahkan <strong>{count} transaksi terpilih</strong> ke tanggal berikut:
          </p>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Tanggal Baru (YYYY-MM-DD)
            </label>
            <IsoDateInput
              value={date}
              onChange={setDate}
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-brand focus:outline-hidden"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Tanggal jurnal terkait akan otomatis disinkronkan ke tanggal baru.
          </p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isPending || !date}
            onClick={() => onConfirm(date)}
            className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-xs"
          >
            {isPending ? "Menyimpan..." : "Terapkan Tanggal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 3. Bulk PIC Modal
export interface BulkPicModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  onConfirm: (pic: string | null) => void;
  isPending: boolean;
}

export function BulkPicModal({ isOpen, onClose, count, onConfirm, isPending }: BulkPicModalProps) {
  const [pic, setPic] = useState("");

  useEffect(() => {
    if (isOpen) setPic("");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-pic-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-800">
            <User size={18} className="text-amber-500" />
            <h3 id="bulk-pic-title" className="text-sm font-bold">
              Ubah PIC Masal
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-xs text-slate-600">
            Perbarui PIC untuk <strong>{count} transaksi terpilih</strong>:
          </p>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Nama / Kode PIC (Maks. 10 karakter)
            </label>
            <input
              type="text"
              maxLength={10}
              value={pic}
              placeholder="Contoh: KSR-1 (kosongkan untuk hapus PIC)"
              onChange={(e) => setPic(e.target.value)}
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 focus:border-brand focus:outline-hidden"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => onConfirm(pic.trim() ? pic.trim() : null)}
            className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-xs"
          >
            {isPending ? "Menyimpan..." : "Terapkan PIC"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 4. Bulk Type Modal
export interface BulkTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  transactionTypes: TransactionType[];
  accountById: Map<string, Account>;
  onConfirm: (transactionTypeId: string) => void;
  isPending: boolean;
}

export function BulkTypeModal({
  isOpen,
  onClose,
  count,
  transactionTypes,
  accountById,
  onConfirm,
  isPending,
}: BulkTypeModalProps) {
  const [selectedTypeId, setSelectedTypeId] = useState("");

  useEffect(() => {
    if (isOpen) setSelectedTypeId("");
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-type-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-800">
            <Tag size={18} className="text-purple-500" />
            <h3 id="bulk-type-title" className="text-sm font-bold">
              Ubah Tipe Transaksi Masal
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-600">
            Pilih tipe transaksi baru untuk <strong>{count} transaksi terpilih</strong>:
          </p>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Tipe Transaksi Baru
            </label>
            <SearchableTransactionTypeSelect
              value={selectedTypeId}
              onChange={setSelectedTypeId}
              transactionTypes={transactionTypes}
              accountById={accountById}
              placeholder="Cari tipe transaksi..."
              className="w-full"
            />
          </div>

          <div className="rounded-md bg-blue-50 p-2.5 text-xs text-blue-800 border border-blue-200">
            💡 Akun debit & kredit pada transaksi serta jurnal umumnya akan otomatis disesuaikan
            dengan tipe transaksi yang dipilih.
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isPending || !selectedTypeId}
            onClick={() => onConfirm(selectedTypeId)}
            className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-xs"
          >
            {isPending ? "Menyimpan..." : "Terapkan Tipe"}
          </button>
        </div>
      </div>
    </div>
  );
}
