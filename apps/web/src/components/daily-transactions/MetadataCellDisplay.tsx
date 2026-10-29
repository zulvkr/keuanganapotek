import type { MetadataFieldDefinition } from "@keuangan-apotek/shared";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatSen } from "./daily-transaction.types";

export type MetadataEntry = {
  key: string;
  label: string;
  val: string;
  isBoolean?: boolean;
  boolVal?: boolean;
};

export function MetadataCellDisplay({
  metadata,
  schema = [],
  isEditing,
  isOpen,
  onOpenEditor,
}: {
  metadata: Record<string, any>;
  schema: MetadataFieldDefinition[];
  isEditing?: boolean;
  isOpen?: boolean;
  onOpenEditor?: () => void;
}) {
  const meta = metadata || {};
  const entries: MetadataEntry[] = [];
  const processedKeys = new Set<string>();

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

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      {/* Detail key-value tags in schema order */}
      {entries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {entries.map(({ key, label, val, isBoolean, boolVal }) => (
            <span
              key={key}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] border shadow-2xs ${
                isBoolean
                  ? boolVal
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : "bg-red-50 text-red-800 border-red-300"
                  : "bg-slate-100 text-slate-800 border-slate-200/90"
              }`}
              title={`${label}: ${val}`}
            >
              <span
                className={`font-semibold ${
                  isBoolean ? (boolVal ? "text-emerald-700" : "text-red-700") : "text-slate-500"
                }`}
              >
                {label}:
              </span>
              <span
                className={`font-bold ${
                  isBoolean
                    ? boolVal
                      ? "text-emerald-900"
                      : "text-red-900"
                    : "text-slate-900 break-all"
                }`}
              >
                {val}
              </span>
            </span>
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
