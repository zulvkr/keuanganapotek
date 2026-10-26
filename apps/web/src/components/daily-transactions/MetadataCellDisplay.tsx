import type { MetadataFieldDefinition } from "@keuangan-apotek/shared";
import { ChevronUp, Pencil, Tag } from "lucide-react";
import { formatSen } from "./daily-transaction.types";

export function MetadataCellDisplay({
  metadata,
  schema,
  isEditing,
  isOpen,
  onOpenEditor,
}: {
  metadata: Record<string, any>;
  schema: MetadataFieldDefinition[];
  isEditing?: boolean;
  isOpen?: boolean;
  onOpenEditor: () => void;
}) {
  const entries = Object.keys(metadata || {})
    .filter((key) => {
      const val = metadata[key];
      return (
        val !== undefined && val !== null && val !== "" && (!Array.isArray(val) || val.length > 0)
      );
    })
    .map((key) => {
      const fDef = schema.find((f) => f.key === key);
      const label = fDef?.label || key;
      const rawVal = metadata[key];
      let formattedVal = "";
      if (typeof rawVal === "boolean") {
        formattedVal = rawVal ? "Ya" : "Tidak";
      } else if (Array.isArray(rawVal)) {
        formattedVal = rawVal.join(", ");
      } else if (fDef?.type === "currency" && typeof rawVal === "number") {
        formattedVal = `Rp ${formatSen(rawVal)}`;
      } else {
        formattedVal = String(rawVal);
      }
      return { key, label, val: formattedVal };
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      {/* Detail key-value tags: always visible in full detail both in view and edit mode */}
      {entries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          {entries.map(({ key, label, val }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800 border border-slate-200/90 shadow-2xs"
              title={`${label}: ${val}`}
            >
              <span className="font-semibold text-slate-500">{label}:</span>
              <span className="font-semibold text-slate-900 break-all">{val}</span>
            </span>
          ))}
        </div>
      ) : !isEditing ? (
        <span className="text-slate-400 italic text-[11px]">—</span>
      ) : null}

      {/* In edit mode: compact action trigger next to the detailed tags */}
      {isEditing && (
        <div className="inline-flex items-center">
          {isOpen ? (
            <button
              type="button"
              onClick={onOpenEditor}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition"
              title="Tutup editor metadata"
            >
              <ChevronUp size={11} /> Tutup Form
            </button>
          ) : entries.length > 0 ? (
            <button
              type="button"
              onClick={onOpenEditor}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-brand border border-blue-200 hover:bg-blue-100 transition"
              title="Ubah rincian metadata"
            >
              <Pencil size={10} /> Ubah
            </button>
          ) : schema.length > 0 ? (
            <button
              type="button"
              onClick={onOpenEditor}
              className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-blue-100 transition"
              title="Isi metadata tambahan"
            >
              <Tag size={12} /> + Metadata
            </button>
          ) : (
            <span className="text-slate-400 italic text-[10px]">—</span>
          )}
        </div>
      )}
    </div>
  );
}
