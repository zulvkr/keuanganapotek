import { useState } from "react";
import { Check, X, AlertCircle } from "lucide-react";
import type { MetadataFieldDefinition } from "@keuangan-apotek/shared";

type Props = {
  schema: MetadataFieldDefinition[];
  initialValues: Record<string, any>;
  onSave: (values: Record<string, any>) => void;
  onCancel?: () => void;
  title?: string;
  className?: string;
};

export function DynamicMetadataForm({
  schema,
  initialValues,
  onSave,
  onCancel,
  title = "Isi Data Tambahan",
  className,
}: Props) {
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

  if (schema.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-slate-500">
          Tipe transaksi ini tidak memerlukan data metadata tambahan.
        </p>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="mt-3 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
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
        "w-full max-w-lg space-y-4 rounded-xl bg-white p-4 text-ink shadow-xl border border-slate-200"
      }
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 max-h-[60vh] overflow-y-auto px-0.5">
        {schema.map((field) => {
          const isHalf = field.width === "half";
          const error = errors[field.key];
          const val = formValues[field.key] ?? "";

          return (
            <div
              key={field.key}
              className={`space-y-1 ${isHalf ? "sm:col-span-1" : "sm:col-span-2"}`}
            >
              <label className="block text-xs font-medium text-slate-700">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>

              {field.type === "textarea" ? (
                <textarea
                  rows={2}
                  value={val}
                  placeholder={field.placeholder || `Masukkan ${field.label.toLowerCase()}`}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-100 ${error ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-brand"}`}
                />
              ) : field.type === "select" ? (
                <select
                  value={val}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-100 ${error ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-brand"}`}
                >
                  <option value="">-- Pilih {field.label} --</option>
                  {(field.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === "multi-select" ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap gap-1.5">
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
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition ${isSelected ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : field.type === "boolean" ? (
                <label className="flex items-center gap-2 pt-1 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) => handleChange(field.key, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-blue-100"
                  />
                  <span>{field.label}</span>
                </label>
              ) : field.type === "number" || field.type === "currency" ? (
                <input
                  type="number"
                  step="any"
                  value={val}
                  placeholder={field.placeholder || "0"}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-xs font-mono tabular-nums outline-none focus:ring-2 focus:ring-blue-100 ${error ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-brand"}`}
                />
              ) : field.type === "date" ? (
                <input
                  type="date"
                  value={val}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-xs tabular-nums outline-none focus:ring-2 focus:ring-blue-100 ${error ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-brand"}`}
                />
              ) : (
                <input
                  type="text"
                  value={val}
                  placeholder={field.placeholder || `Masukkan ${field.label.toLowerCase()}`}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className={`w-full rounded-lg border px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-100 ${error ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-brand"}`}
                />
              )}

              {error && (
                <p className="flex items-center gap-1 text-[11px] text-red-500">
                  <AlertCircle size={11} /> {error}
                </p>
              )}
              {field.helpText && !error && (
                <p className="text-[10px] text-slate-400">{field.helpText}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Batal
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
        >
          <Check size={14} /> Terapkan Metadata
        </button>
      </div>
    </div>
  );
}
