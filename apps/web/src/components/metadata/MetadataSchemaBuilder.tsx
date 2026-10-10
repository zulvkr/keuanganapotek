import { useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Settings2, Eye } from "lucide-react";
import type { MetadataFieldDefinition, MetadataFieldType } from "@keuangan-apotek/shared";

const FIELD_TYPES: Array<{ value: MetadataFieldType; label: string }> = [
  { value: "text", label: "Teks Singkat (Text)" },
  { value: "textarea", label: "Teks Panjang (Textarea)" },
  { value: "number", label: "Angka (Number)" },
  { value: "currency", label: "Nominal Uang (Currency)" },
  { value: "date", label: "Tanggal (Date)" },
  { value: "select", label: "Pilihan Tunggal (Select)" },
  { value: "multi-select", label: "Pilihan Ganda (Multi-select)" },
  { value: "boolean", label: "Ya / Tidak (Boolean / Checkbox)" },
];

type Props = {
  schema: MetadataFieldDefinition[];
  onChange: (schema: MetadataFieldDefinition[]) => void;
};

export function MetadataSchemaBuilder({ schema, onChange }: Props) {
  const [activeTab, setActiveTab] = useState<"builder" | "preview">("builder");

  function addField() {
    let nextIdx = schema.length + 1;
    const existingKeys = new Set(schema.map((f) => f.key));
    while (existingKeys.has(`field_${nextIdx}`)) {
      nextIdx++;
    }
    const newKey = `field_${nextIdx}`;
    const newField: MetadataFieldDefinition = {
      key: newKey,
      label: `Field ${nextIdx}`,
      type: "text",
      required: false,
      placeholder: "",
      width: "full",
    };
    onChange([...schema, newField]);
  }

  function updateField(index: number, patch: Partial<MetadataFieldDefinition>) {
    const next = schema.map((field, i) => (i === index ? { ...field, ...patch } : field));
    onChange(next);
  }

  function removeField(index: number) {
    onChange(schema.filter((_, i) => i !== index));
  }

  function moveField(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= schema.length) return;
    const next = [...schema];
    const temp = next[index]!;
    next[index] = next[targetIndex]!;
    next[targetIndex] = temp;
    onChange(next);
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-brand" />
          <h4 className="text-sm font-semibold text-slate-800">Skema Metadata Dinamis</h4>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-brand">
            {schema.length} field
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1 font-medium transition ${activeTab === "builder" ? "bg-brand text-white" : "text-slate-600 hover:text-slate-900"}`}
              onClick={() => setActiveTab("builder")}
            >
              Editor Skema
            </button>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${activeTab === "preview" ? "bg-brand text-white" : "text-slate-600 hover:text-slate-900"}`}
              onClick={() => setActiveTab("preview")}
            >
              <Eye size={12} /> Live Preview
            </button>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition"
            onClick={addField}
          >
            <Plus size={14} /> Tambah Field
          </button>
        </div>
      </div>

      {activeTab === "builder" ? (
        <div className="space-y-3">
          {schema.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-muted">
              Belum ada field metadata tambahan. Klik tombol <strong>+ Tambah Field</strong> untuk
              membuat skema field khusus transaksi ini.
            </div>
          ) : (
            schema.map((field, index) => (
              <div
                key={index}
                className="group relative rounded-lg border border-slate-200 bg-slate-50/50 p-3 hover:border-blue-200 hover:bg-blue-50/10 transition"
              >
                <div className="grid gap-3 sm:grid-cols-12 items-start">
                  {/* Reorder and Delete controls */}
                  <div className="sm:col-span-1 flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveField(index, "up")}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                      title="Geser ke atas"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={index === schema.length - 1}
                      onClick={() => moveField(index, "down")}
                      className="rounded p-1 text-slate-400 hover:bg-slate-200 disabled:opacity-30"
                      title="Geser ke bawah"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>

                  {/* Key */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-500">Key ID</label>
                    <input
                      type="text"
                      value={field.key}
                      onChange={(e) =>
                        updateField(index, {
                          key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
                        })
                      }
                      placeholder="no_faktur"
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono outline-none focus:border-brand"
                    />
                  </div>

                  {/* Label */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-500">
                      Label Tampilan
                    </label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                      placeholder="Nomor Faktur"
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand"
                    />
                  </div>

                  {/* Type */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-500">
                      Tipe Input
                    </label>
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateField(index, { type: e.target.value as MetadataFieldType })
                      }
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-brand"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Width & Required */}
                  <div className="sm:col-span-2 flex items-center gap-3 pt-4">
                    <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required ?? false}
                        onChange={(e) => updateField(index, { required: e.target.checked })}
                        className="rounded border-slate-300 text-brand focus:ring-blue-100"
                      />
                      <span>Wajib</span>
                    </label>
                    <select
                      value={field.width ?? "full"}
                      onChange={(e) =>
                        updateField(index, { width: e.target.value as "full" | "half" })
                      }
                      className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
                      title="Lebar Form"
                    >
                      <option value="full">Lebar Penuh</option>
                      <option value="half">1/2 Kolom</option>
                    </select>
                  </div>

                  {/* Remove Button */}
                  <div className="sm:col-span-1 flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Hapus field"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Additional config for select / multi-select */}
                {(field.type === "select" || field.type === "multi-select") && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 pl-8">
                    <label className="block text-[11px] font-medium text-slate-500">
                      Opsi Pilihan (pisahkan dengan tanda koma)
                    </label>
                    <input
                      type="text"
                      value={(field.options || []).join(", ")}
                      onChange={(e) => {
                        const opts = e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                        updateField(index, { options: opts });
                      }}
                      placeholder="Contoh: Pagi, Siang, Malam"
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand"
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Live Preview tab */
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pratinjau Tampilan Form Popover
          </p>
          {schema.length === 0 ? (
            <p className="text-xs text-muted">Tidak ada field untuk ditampilkan.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {schema.map((f, i) => (
                <div
                  key={i}
                  className={`space-y-1 ${f.width === "half" ? "sm:col-span-1" : "sm:col-span-2"}`}
                >
                  <label className="block text-xs font-medium text-slate-700">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      placeholder={f.placeholder || `Masukkan ${f.label.toLowerCase()}`}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                      disabled
                    />
                  ) : f.type === "select" ? (
                    <select
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                      disabled
                    >
                      <option value="">-- Pilih {f.label} --</option>
                      {(f.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "boolean" ? (
                    <label className="flex items-center gap-2 text-xs text-slate-700">
                      <input type="checkbox" disabled className="rounded border-slate-300" />
                      <span>{f.label}</span>
                    </label>
                  ) : (
                    <input
                      type={
                        f.type === "number" || f.type === "currency"
                          ? "number"
                          : f.type === "date"
                            ? "date"
                            : "text"
                      }
                      placeholder={f.placeholder || `Contoh ${f.label.toLowerCase()}`}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                      disabled
                    />
                  )}
                  {f.helpText && <p className="text-[10px] text-slate-400">{f.helpText}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
