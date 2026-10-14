import { useState, type KeyboardEvent } from "react";
import { Check } from "lucide-react";
import type { MetadataFieldDefinition } from "@keuangan-apotek/shared";

type Props = {
  schema: MetadataFieldDefinition[];
  initialValues: Record<string, any>;
  onSave: (values: Record<string, any>) => void;
  onCancel?: () => void;
  title?: string;
  className?: string;
};

export function DynamicMetadataForm({ schema, initialValues, onSave, onCancel, className }: Props) {
  const [formValues, setFormValues] = useState<Record<string, any>>({ ...initialValues });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleChange(key: string, value: any) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function handleSave() {
    const nextErrors: Record<string, string> = {};
    for (const field of schema) {
      if (field.required) {
        const val = formValues[field.key];
        if (
          val === undefined ||
          val === null ||
          val === "" ||
          (Array.isArray(val) && val.length === 0)
        ) {
          nextErrors[field.key] = `${field.label} wajib diisi`;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave(formValues);
  }

  function handleKeyDown(e: KeyboardEvent<any>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
    }
  }

  if (schema.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2 py-0.5 text-xs text-slate-500">
        <span>Tipe transaksi ini tidak memerlukan metadata tambahan.</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-6 rounded border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-50"
          >
            Tutup
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={
        className ||
        "flex items-center gap-2.5 overflow-x-auto py-1 px-1 bg-blue-50/40 rounded border border-blue-200/80 text-xs text-slate-800"
      }
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel?.();
        }
      }}
    >
      {/* 1-line horizontal input fields */}
      {schema.map((field) => {
        const error = errors[field.key];
        const val = formValues[field.key] ?? "";

        return (
          <div
            key={field.key}
            className="flex items-center gap-1.5 shrink-0"
            title={error || field.helpText || field.label}
          >
            {field.type !== "boolean" && (
              <span className="text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}:
              </span>
            )}

            {field.type === "select" ? (
              <select
                value={val}
                onChange={(e) => handleChange(field.key, e.target.value)}
                onKeyDown={handleKeyDown}
                className={`h-6 w-32 rounded border bg-white px-1.5 py-0 text-xs outline-none focus:border-brand ${
                  error ? "border-red-400 bg-red-50/40" : "border-slate-300"
                }`}
              >
                <option value="">-- Pilih --</option>
                {(field.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : field.type === "multi-select" ? (
              <div className="flex items-center gap-1">
                {(field.options || []).map((opt) => {
                  const selectedList = Array.isArray(val)
                    ? val
                    : typeof val === "string" && val.length > 0
                      ? val.split(",").map((s: string) => s.trim())
                      : [];
                  const isSelected = selectedList.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        const next = isSelected
                          ? selectedList.filter((x: string) => x !== opt)
                          : [...selectedList, opt];
                        handleChange(field.key, next);
                      }}
                      className={`h-6 rounded px-1.5 text-[11px] font-medium border transition ${
                        isSelected
                          ? "border-brand bg-brand text-white"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : field.type === "boolean" ? (
              <label className="h-6 flex items-center gap-1 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(val)}
                  onChange={(e) => handleChange(field.key, e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-brand focus:ring-0"
                />
                <span>{field.label}</span>
              </label>
            ) : field.type === "number" ? (
              <input
                type="number"
                step="any"
                value={val}
                placeholder={field.placeholder || "0"}
                onChange={(e) => handleChange(field.key, e.target.value)}
                onKeyDown={handleKeyDown}
                className={`h-6 w-24 text-right rounded border bg-white px-1.5 py-0 text-xs tabular-nums outline-none focus:border-brand ${
                  error ? "border-red-400 bg-red-50/40" : "border-slate-300"
                }`}
              />
            ) : field.type === "currency" ? (
              <div className="relative flex items-center">
                <span className="absolute left-1.5 text-[10px] text-slate-400 select-none">Rp</span>
                <input
                  type="text"
                  value={val}
                  placeholder={field.placeholder || "0"}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  onKeyDown={handleKeyDown}
                  className={`h-6 w-28 pl-6 pr-1.5 text-right rounded border bg-white py-0 text-xs tabular-nums outline-none focus:border-brand ${
                    error ? "border-red-400 bg-red-50/40" : "border-slate-300"
                  }`}
                />
              </div>
            ) : field.type === "date" ? (
              <input
                type="date"
                value={val}
                onChange={(e) => handleChange(field.key, e.target.value)}
                onKeyDown={handleKeyDown}
                className={`h-6 w-32 rounded border bg-white px-1 py-0 text-xs tabular-nums outline-none focus:border-brand ${
                  error ? "border-red-400 bg-red-50/40" : "border-slate-300"
                }`}
              />
            ) : (
              <input
                type="text"
                value={val}
                placeholder={field.placeholder || `Masukkan ${field.label.toLowerCase()}`}
                onChange={(e) => handleChange(field.key, e.target.value)}
                onKeyDown={handleKeyDown}
                className={`h-6 ${field.type === "textarea" ? "w-44" : "w-32"} rounded border bg-white px-1.5 py-0 text-xs outline-none focus:border-brand ${
                  error ? "border-red-400 bg-red-50/40" : "border-slate-300"
                }`}
              />
            )}
          </div>
        );
      })}

      {/* Action buttons at the end of the horizontal row */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0 pl-2">
        <button
          type="button"
          onClick={handleSave}
          className="h-6 inline-flex items-center gap-1 rounded bg-brand px-2.5 py-0 text-xs font-semibold text-white hover:bg-blue-700 transition"
        >
          <Check size={12} /> Terapkan Metadata
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-6 rounded border border-slate-300 bg-white px-2 py-0 text-xs text-slate-600 hover:bg-slate-50 transition"
          >
            Batal
          </button>
        )}
      </div>
    </div>
  );
}
