import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Calendar } from "lucide-react";
import { todayIsoDate } from "@keuangan-apotek/shared";

export interface IsoDateInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
}

function isValidIsoDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const testDate = new Date(Date.UTC(y, m - 1, d));
  return (
    testDate.getUTCFullYear() === y &&
    testDate.getUTCMonth() === m - 1 &&
    testDate.getUTCDate() === d
  );
}

function stepDay(iso: string, delta: number): string {
  const [y, m, d] = (iso || todayIsoDate()).split("-").map(Number);
  if (y && m && d) {
    const next = new Date(Date.UTC(y, m - 1, d + delta));
    const nextY = next.getUTCFullYear();
    const nextM = String(next.getUTCMonth() + 1).padStart(2, "0");
    const nextD = String(next.getUTCDate()).padStart(2, "0");
    return `${nextY}-${nextM}-${nextD}`;
  }
  return todayIsoDate();
}

function formatRawTyping(raw: string): string {
  // Extract digits and dashes only
  const clean = raw.replace(/[^\d-]/g, "");
  // If user typed digits only without dashes, e.g. 20261023
  const digits = clean.replace(/\D/g, "");
  if (clean.length > 4 && !clean.includes("-") && digits.length >= 5) {
    if (digits.length <= 6) {
      return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    }
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  return clean.slice(0, 10);
}

export const IsoDateInput = forwardRef<HTMLInputElement, IsoDateInputProps>(
  (
    {
      value,
      onChange,
      onKeyDown,
      autoFocus = false,
      disabled = false,
      className = "",
      id,
      placeholder = "YYYY-MM-DD",
    },
    ref,
  ) => {
    const [localValue, setLocalValue] = useState<string>(value || todayIsoDate());
    const inputRef = useRef<HTMLInputElement>(null);
    const hiddenPickerRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    useEffect(() => {
      setLocalValue(value || "");
    }, [value]);

    function commitChange(val: string) {
      if (isValidIsoDate(val)) {
        setLocalValue(val);
        onChange(val);
      } else {
        // Revert to valid prop value or today
        setLocalValue(value || todayIsoDate());
      }
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
      const formatted = formatRawTyping(e.target.value);
      setLocalValue(formatted);
      if (isValidIsoDate(formatted)) {
        onChange(formatted);
      }
    }

    function handleInputBlur() {
      commitChange(localValue);
    }

    function handleKeyDownInternal(e: React.KeyboardEvent<HTMLInputElement>) {
      // Hotkey 't' or 'T': set today
      if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        const today = todayIsoDate();
        setLocalValue(today);
        onChange(today);
        return;
      }

      // Hotkey '+' or 'ArrowUp': increment day
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "+" || e.key === "=" || e.key === "ArrowUp")
      ) {
        e.preventDefault();
        const next = stepDay(isValidIsoDate(localValue) ? localValue : value, 1);
        setLocalValue(next);
        onChange(next);
        return;
      }

      // Hotkey '-' or 'ArrowDown': decrement day
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.key === "-" || e.key === "_" || e.key === "ArrowDown")
      ) {
        e.preventDefault();
        const prev = stepDay(isValidIsoDate(localValue) ? localValue : value, -1);
        setLocalValue(prev);
        onChange(prev);
        return;
      }

      // Forward to parent handler (e.g. Ctrl+Enter to save row)
      onKeyDown?.(e);
    }

    function openNativePicker() {
      if (disabled) return;
      try {
        const picker = hiddenPickerRef.current;
        if (picker) {
          if (typeof (picker as any).showPicker === "function") {
            (picker as any).showPicker();
          } else {
            picker.focus();
          }
        }
      } catch {
        hiddenPickerRef.current?.focus();
      }
    }

    return (
      <div className="relative flex items-center w-full min-w-[105px]">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={localValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDownInternal}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={10}
          className={`w-full h-6 rounded border border-slate-200 bg-white pl-1.5 pr-5 py-0.5 font-mono text-xs tabular-nums outline-none focus:border-brand disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
          title="Format: YYYY-MM-DD. Tekan 't' untuk hari ini, '+' / '-' untuk ubah hari"
        />

        {/* Mini Calendar Picker Icon Button */}
        <button
          type="button"
          tabIndex={-1}
          onClick={openNativePicker}
          disabled={disabled}
          className="absolute right-1 text-slate-400 hover:text-brand focus:outline-none transition p-0.5 rounded cursor-pointer"
          title="Buka kalender"
          aria-label="Pilih tanggal dari kalender"
        >
          <Calendar size={11} />
        </button>

        {/* Hidden native date input for showPicker */}
        <input
          ref={hiddenPickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={isValidIsoDate(localValue) ? localValue : todayIsoDate()}
          onChange={(e) => {
            if (e.target.value) {
              setLocalValue(e.target.value);
              onChange(e.target.value);
            }
          }}
          className="sr-only pointer-events-none"
        />
      </div>
    );
  },
);

IsoDateInput.displayName = "IsoDateInput";
