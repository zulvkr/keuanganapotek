import { useEffect, useRef, useState } from "react";
import type { MetadataFieldDefinition } from "@keuangan-apotek/shared";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { CellEditPopover } from "./CellEditPopover";
import { formatSen } from "./daily-transaction.types";

export type MetadataEntry = {
  key: string;
  label: string;
  val: string;
  isBoolean?: boolean;
  boolVal?: boolean;
};

function MetadataFieldQuickEditor({
  fDef,
  currentValue,
  onSave,
  onCancel,
}: {
  fDef?: MetadataFieldDefinition;
  currentValue: any;
  onSave: (val: any) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(() =>
    currentValue !== undefined && currentValue !== null ? currentValue : "",
  );
  const inputRef = useRef<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        if (typeof inputRef.current.select === "function") {
          inputRef.current.select();
        }
      }
    }, 20);
    return () => clearTimeout(timer);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave(
        fDef?.type === "number" || fDef?.type === "currency"
          ? val === ""
            ? null
            : Number(val)
          : val,
      );
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="space-y-2">
      {fDef?.type === "select" ? (
        <select
          ref={inputRef}
          value={String(val)}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
        >
          <option value="">-- Pilih {fDef.label} --</option>
          {fDef.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : fDef?.type === "date" ? (
        <input
          ref={inputRef}
          type="date"
          value={String(val)}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
        />
      ) : fDef?.type === "number" || fDef?.type === "currency" ? (
        <input
          ref={inputRef}
          type="number"
          step="any"
          value={val}
          placeholder={fDef?.placeholder || "0"}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={String(val)}
          placeholder={fDef?.placeholder || `Masukkan ${fDef?.label || "nilai"}...`}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
        />
      )}

      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={() =>
            onSave(
              fDef?.type === "number" || fDef?.type === "currency"
                ? val === ""
                  ? null
                  : Number(val)
                : val,
            )
          }
          className="inline-flex items-center gap-1 rounded bg-brand px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700 shadow-2xs"
        >
          <Check size={11} /> Simpan
        </button>
      </div>
    </div>
  );
}

export function MetadataCellDisplay({
  metadata,
  schema = [],
  isEditing,
  isOpen,
  onOpenEditor,
  onQuickUpdate,
  canEdit = true,
}: {
  metadata: Record<string, any>;
  schema: MetadataFieldDefinition[];
  isEditing?: boolean;
  isOpen?: boolean;
  onOpenEditor?: () => void;
  onQuickUpdate?: (key: string, value: any) => void;
  canEdit?: boolean;
}) {
  const meta = metadata || {};
  const entries: MetadataEntry[] = [];
  const processedKeys = new Set<string>();
  const schemaMap = new Map<string, MetadataFieldDefinition>();
  const missingSchemaFields: MetadataFieldDefinition[] = [];

  for (const fDef of schema) {
    schemaMap.set(fDef.key, fDef);
  }

  // 1. Follow the exact order configured in the schema setting
  for (const fDef of schema) {
    processedKeys.add(fDef.key);
    if (fDef.type === "boolean") {
      // Boolean defaults to false if not present or falsy
      const boolVal = Boolean(meta[fDef.key]);
      entries.push({
        key: fDef.key,
        label: fDef.label || fDef.key,
        val: boolVal ? "Ya" : "Tidak",
        isBoolean: true,
        boolVal,
      });
    } else {
      const rawVal = meta[fDef.key];
      if (
        rawVal !== undefined &&
        rawVal !== null &&
        rawVal !== "" &&
        (!Array.isArray(rawVal) || rawVal.length > 0)
      ) {
        let formattedVal = "";
        if (Array.isArray(rawVal)) {
          formattedVal = rawVal.join(", ");
        } else if (fDef.type === "currency" && typeof rawVal === "number") {
          formattedVal = `Rp ${formatSen(rawVal)}`;
        } else {
          formattedVal = String(rawVal);
        }
        entries.push({
          key: fDef.key,
          label: fDef.label || fDef.key,
          val: formattedVal,
          isBoolean: false,
        });
      } else {
        missingSchemaFields.push(fDef);
      }
    }
  }

  // 2. Include any remaining keys present in metadata that are not part of schema
  for (const key of Object.keys(meta)) {
    if (!processedKeys.has(key)) {
      const rawVal = meta[key];
      if (
        rawVal !== undefined &&
        rawVal !== null &&
        rawVal !== "" &&
        (!Array.isArray(rawVal) || rawVal.length > 0)
      ) {
        const isBool = typeof rawVal === "boolean";
        entries.push({
          key,
          label: key,
          val: isBool ? (rawVal ? "Ya" : "Tidak") : String(rawVal),
          isBoolean: isBool,
          boolVal: isBool ? rawVal : false,
        });
      }
    }
  }

  const allowQuickEdit = Boolean(canEdit && onQuickUpdate && !isEditing);

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      {/* Detail key-value tags in schema order */}
      {entries.length > 0 || (allowQuickEdit && missingSchemaFields.length > 0) ? (
        <div className="flex flex-wrap items-center gap-1">
          {entries.map(({ key, label, val, isBoolean, boolVal }) => {
            if (isBoolean) {
              return (
                <span
                  key={key}
                  onClick={(e) => {
                    if (allowQuickEdit) {
                      e.stopPropagation();
                      onQuickUpdate!(key, !boolVal);
                    }
                  }}
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border shadow-2xs ${
                    allowQuickEdit
                      ? "cursor-pointer hover:scale-105 active:scale-95 transition select-none"
                      : ""
                  } ${
                    boolVal
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                      : "bg-red-50 text-red-800 border-red-300 hover:bg-red-100"
                  }`}
                  title={
                    allowQuickEdit
                      ? `Klik untuk ubah ke ${boolVal ? "Tidak" : "Ya"}`
                      : `${label}: ${val}`
                  }
                >
                  <span
                    className={`font-semibold ${boolVal ? "text-emerald-700" : "text-red-700"}`}
                  >
                    {label}:
                  </span>
                  <span className={`font-bold ${boolVal ? "text-emerald-900" : "text-red-900"}`}>
                    {val}
                  </span>
                </span>
              );
            }

            // Non-boolean entry
            if (allowQuickEdit) {
              return (
                <CellEditPopover
                  key={key}
                  title={`Edit ${label}`}
                  trigger={
                    <span
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border shadow-2xs bg-slate-100 text-slate-800 border-slate-200/90 hover:bg-slate-200/90 hover:border-slate-300 transition"
                      title={`${label}: ${val} (Klik untuk edit)`}
                    >
                      <span className="font-semibold text-slate-500">{label}:</span>
                      <span className="font-bold text-slate-900 break-all">{val}</span>
                    </span>
                  }
                >
                  {({ close }) => (
                    <MetadataFieldQuickEditor
                      fDef={schemaMap.get(key)}
                      currentValue={meta[key]}
                      onSave={(newVal) => {
                        onQuickUpdate!(key, newVal);
                        close();
                      }}
                      onCancel={close}
                    />
                  )}
                </CellEditPopover>
              );
            }

            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border shadow-2xs bg-slate-100 text-slate-800 border-slate-200/90"
                title={`${label}: ${val}`}
              >
                <span className="font-semibold text-slate-500">{label}:</span>
                <span className="font-bold text-slate-900 break-all">{val}</span>
              </span>
            );
          })}

          {/* Missing schema fields: subtle clickable badge to add/fill */}
          {allowQuickEdit &&
            missingSchemaFields.map((fDef) => (
              <CellEditPopover
                key={fDef.key}
                title={`Isi ${fDef.label}`}
                trigger={
                  <span
                    className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] border border-dashed border-slate-300 text-slate-500 hover:text-brand hover:border-brand/40 bg-slate-50/60 hover:bg-blue-50/40 transition select-none"
                    title={`Klik untuk mengisi ${fDef.label}`}
                  >
                    <span className="font-semibold">+ {fDef.label}</span>
                  </span>
                }
              >
                {({ close }) => (
                  <MetadataFieldQuickEditor
                    fDef={fDef}
                    currentValue=""
                    onSave={(newVal) => {
                      onQuickUpdate!(fDef.key, newVal);
                      close();
                    }}
                    onCancel={close}
                  />
                )}
              </CellEditPopover>
            ))}
        </div>
      ) : isEditing && schema.length > 0 ? (
        <span className="text-amber-800/70 italic text-[10px]">Form di bawah</span>
      ) : (
        <span className="text-slate-400 italic text-[11px]">—</span>
      )}

      {/* Subtle collapse/expand toggle when editing */}
      {isEditing && schema.length > 0 && onOpenEditor && (
        <button
          type="button"
          onClick={onOpenEditor}
          className="inline-flex items-center rounded p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          title={isOpen ? "Sembunyikan form metadata" : "Tampilkan form metadata"}
          aria-label={isOpen ? "Sembunyikan form metadata" : "Tampilkan form metadata"}
        >
          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      )}
    </div>
  );
}
