import { useEffect, useState, useCallback } from "react";
import { X, Keyboard, HelpCircle } from "lucide-react";

export interface KeyTipsActions {
  onAddNewRow: () => void;
  onToggleFilter: () => void;
  onCurrentMonth: () => void;
  onPrevMonth: () => void;
  onAllPeriod: () => void;
  onCustomPeriod: () => void;
  onToggleView: () => void;
  onSaveCurrentRow?: () => void;
  canSaveCurrentRow?: boolean;
}

export function useKeyTips(actions: KeyTipsActions) {
  const [isKeyTipsActive, setIsKeyTipsActive] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Toggle help modal with '?' when not typing in an input
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput =
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select" ||
        (e.target as HTMLElement)?.isContentEditable;

      // Toggle Alt Key Tips
      if (e.key === "Alt") {
        e.preventDefault();
        setIsKeyTipsActive((prev) => !prev);
        return;
      }

      // If Key Tips are active, intercept mapped keys
      if (isKeyTipsActive) {
        const key = e.key.toLowerCase();
        if (key === "escape" || e.key === "Alt") {
          setIsKeyTipsActive(false);
          return;
        }

        let handled = true;
        switch (key) {
          case "n":
            actions.onAddNewRow();
            break;
          case "f":
            actions.onToggleFilter();
            break;
          case "m":
            actions.onCurrentMonth();
            break;
          case "l":
            actions.onPrevMonth();
            break;
          case "a":
            actions.onAllPeriod();
            break;
          case "k":
            actions.onCustomPeriod();
            break;
          case "v":
            actions.onToggleView();
            break;
          case "s":
            if (actions.onSaveCurrentRow && actions.canSaveCurrentRow) {
              actions.onSaveCurrentRow();
            }
            break;
          case "?":
          case "/":
            setIsHelpOpen(true);
            break;
          default:
            handled = false;
        }

        if (handled) {
          e.preventDefault();
          setIsKeyTipsActive(false);
          return;
        }
      }

      // Alt + Key combinations anytime (even if keytips visual wasn't toggled yet)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        let handled = true;
        switch (key) {
          case "n":
            actions.onAddNewRow();
            break;
          case "f":
            actions.onToggleFilter();
            break;
          case "m":
            actions.onCurrentMonth();
            break;
          case "l":
            actions.onPrevMonth();
            break;
          case "a":
            actions.onAllPeriod();
            break;
          case "k":
            actions.onCustomPeriod();
            break;
          case "v":
            actions.onToggleView();
            break;
          case "s":
            if (actions.onSaveCurrentRow && actions.canSaveCurrentRow) {
              actions.onSaveCurrentRow();
            }
            break;
          default:
            handled = false;
        }
        if (handled) {
          e.preventDefault();
          setIsKeyTipsActive(false);
          return;
        }
      }

      // Standalone shortcuts when not typing in any input
      if (!isInput) {
        if (e.key === "?" || (e.shiftKey && e.key === "/")) {
          e.preventDefault();
          setIsHelpOpen(true);
        } else if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          actions.onAddNewRow();
        }
      }
    },
    [isKeyTipsActive, actions],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [handleGlobalKeyDown]);

  return {
    isKeyTipsActive,
    setIsKeyTipsActive,
    isHelpOpen,
    setIsHelpOpen,
  };
}

export function KeyTipBadge({
  keyChar,
  visible,
  className = "",
}: {
  keyChar: string;
  visible: boolean;
  className?: string;
}) {
  if (!visible) return null;
  return (
    <span
      className={`absolute -top-2.5 -right-1 z-30 inline-flex items-center justify-center px-1.5 py-0.2 rounded bg-slate-900 text-white font-mono font-black text-[10px] shadow-md border border-white ring-1 ring-black/20 animate-in zoom-in-75 duration-100 select-none pointer-events-none ${className}`}
    >
      {keyChar}
    </span>
  );
}

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-brand">
              <Keyboard size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Pintasan Keyboard (Keyboard-Friendly)
              </h3>
              <p className="text-[11px] text-slate-500">
                Input data transaksi cepat tanpa perlu sering beralih ke mouse
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Tutup bantuan"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Section 1: Key Tips Mode */}
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-3 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-blue-950 text-xs">
              <span className="p-1 rounded bg-blue-100 text-brand">⚡</span>
              <span>Key Tips ala Microsoft Word</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Tekan tombol{" "}
              <kbd className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-300 shadow-2xs">
                Alt
              </kbd>{" "}
              untuk memunculkan badge huruf pintasan langsung di atas tombol layar:
            </p>
            <ul className="space-y-1.5 text-[11px] text-slate-700">
              <li className="flex items-center justify-between">
                <span>Tambah Baris Baru</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Alt + N
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Filter Akun Neraca</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Alt + F
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Pilih Bulan Ini / Bulan Lalu</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Alt + M / Alt + L
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Ganti Tampilan (Tabel/Kartu)</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Alt + V
                </span>
              </li>
            </ul>
          </div>

          {/* Section 2: Input Baris Transaksi */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <span className="p-1 rounded bg-slate-200 text-slate-700">✍️</span>
              <span>Input & Simpan Baris</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-700">
              <li className="flex items-center justify-between">
                <span>Simpan baris langsung</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 text-brand">
                  Ctrl + Enter
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Simpan dari kolom PIC</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Enter
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Batal edit / buang draf kosong</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Esc
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Pindah antar kolom</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Tab / Shift+Tab
                </span>
              </li>
            </ul>
          </div>

          {/* Section 3: Input Tanggal YYYY-MM-DD */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <span className="p-1 rounded bg-slate-200 text-slate-700">📅</span>
              <span>Kolom Tanggal (YYYY-MM-DD)</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-700">
              <li className="flex items-center justify-between">
                <span>Isi tanggal hari ini</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  t
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Tambah 1 hari</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  + atau ↑
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Kurang 1 hari</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  - atau ↓
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Ketik angka langsung</span>
                <span className="font-mono text-slate-500">Otomatis berformat YYYY-MM-DD</span>
              </li>
            </ul>
          </div>

          {/* Section 4: Pencarian Tipe Transaksi */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
              <span className="p-1 rounded bg-slate-200 text-slate-700">🔍</span>
              <span>Tipe Transaksi Searchable</span>
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-700">
              <li className="flex items-center justify-between">
                <span>Buka dropdown pencarian</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Enter / ↓ / Ketik
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Navigasi hasil pencarian</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  ↑ / ↓
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Pilih tipe transaksi</span>
                <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  Enter
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span>Pencarian fleksibel</span>
                <span className="font-mono text-slate-500">Nama, Kode, atau CoA Debit/Kredit</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-slate-500 text-[11px]">
          <div className="flex items-center gap-1.5">
            <HelpCircle size={13} className="text-slate-400" />
            <span>
              Tekan{" "}
              <kbd className="font-mono font-bold bg-slate-100 px-1 py-0.2 rounded border">Esc</kbd>{" "}
              untuk menutup bantuan
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-brand px-3 py-1 font-semibold text-white hover:bg-blue-700 transition"
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
