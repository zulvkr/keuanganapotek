import { type TransactionType, todayIsoDate } from "@keuangan-apotek/shared";
import { Check, Tag, X } from "lucide-react";
import type { Account } from "../../lib/queries";
import { toast } from "../../lib/toast";
import { DynamicMetadataForm } from "../metadata/DynamicMetadataForm";
import { formatAmountInput, type DraftRow } from "./daily-transaction.types";
import { IsoDateInput } from "./IsoDateInput";
import { SearchableTransactionTypeSelect } from "./SearchableTransactionTypeSelect";

export type TransactionMobileModalProps = {
  isOpen: boolean;
  draft: DraftRow | null;
  transactionTypes: TransactionType[];
  typeById: Map<string, TransactionType>;
  accountById: Map<string, Account>;
  isSubmitting: boolean;
  onClose: () => void;
  onChangeDraft: (updater: (prev: DraftRow | null) => DraftRow | null) => void;
  onSubmit: (draft: DraftRow) => Promise<void>;
};

export function TransactionMobileModal({
  isOpen,
  draft,
  transactionTypes,
  typeById,
  accountById,
  isSubmitting,
  onClose,
  onChangeDraft,
  onSubmit,
}: TransactionMobileModalProps) {
  if (!isOpen || !draft) return null;

  const curType = typeById.get(draft.transactionTypeId);
  const debAcc = curType ? accountById.get(curType.debitAccountId) : null;
  const credAcc = curType ? accountById.get(curType.creditAccountId) : null;
  const schema = curType?.metadataSchema || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-2xl space-y-3.5 my-auto max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-800">
            {draft.isNew ? "Tambah Transaksi Baru" : "Ubah Transaksi"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Tutup form"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3 text-xs">
          {/* Tanggal */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">Tanggal Transaksi</label>
              <button
                type="button"
                onClick={() =>
                  onChangeDraft((prev) =>
                    prev ? { ...prev, transactionDate: todayIsoDate() } : null,
                  )
                }
                className="text-[11px] font-semibold text-brand hover:underline"
              >
                Hari Ini
              </button>
            </div>
            <IsoDateInput
              value={draft.transactionDate}
              onChange={(val) =>
                onChangeDraft((prev) => (prev ? { ...prev, transactionDate: val } : null))
              }
              className="h-8 px-2"
            />
          </div>

          {/* Tipe Transaksi */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tipe Transaksi</label>
            <SearchableTransactionTypeSelect
              value={draft.transactionTypeId}
              onChange={(newTypeId) => {
                const newType = typeById.get(newTypeId);
                onChangeDraft((prev) => {
                  if (!prev) return null;
                  const newMeta: Record<string, any> = {};
                  if (newType?.metadataSchema) {
                    for (const f of newType.metadataSchema) {
                      if (f.type === "boolean") {
                        newMeta[f.key] =
                          prev.metadata?.[f.key] !== undefined
                            ? Boolean(prev.metadata[f.key])
                            : false;
                      } else if (!prev.isNew && prev.metadata?.[f.key] !== undefined) {
                        newMeta[f.key] = prev.metadata[f.key];
                      }
                    }
                  }
                  return {
                    ...prev,
                    transactionTypeId: newTypeId,
                    metadata: newMeta,
                  };
                });
              }}
              transactionTypes={transactionTypes}
              accountById={accountById}
              className="h-8 px-2"
            />

            {/* Automatic debit/credit preview */}
            {curType && (
              <div className="mt-1 flex items-center justify-between rounded bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600">
                <span className="truncate">
                  <span className="font-bold text-emerald-700">D:</span>{" "}
                  {debAcc ? `${debAcc.code} · ${debAcc.name}` : "—"}
                </span>
                <span className="truncate ml-2 text-right">
                  <span className="font-bold text-amber-700">K:</span>{" "}
                  {credAcc ? `${credAcc.code} · ${credAcc.name}` : "—"}
                </span>
              </div>
            )}
          </div>

          {/* Nominal */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nominal (Rp)</label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs font-semibold text-slate-400 select-none">
                Rp
              </span>
              <input
                type="text"
                placeholder="0,00"
                value={draft.amount}
                onBlur={(e) => {
                  const formatted = formatAmountInput(e.target.value);
                  onChangeDraft((prev) => (prev ? { ...prev, amount: formatted } : null));
                }}
                onChange={(e) =>
                  onChangeDraft((prev) => (prev ? { ...prev, amount: e.target.value } : null))
                }
                className="w-full h-8 pl-8 pr-2.5 rounded border border-slate-300 bg-white font-mono text-xs tabular-nums outline-none focus:border-brand"
              />
            </div>
          </div>

          {/* PIC */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">PIC</label>
            <input
              type="text"
              placeholder="Contoh: ADM, KSR, GUD"
              maxLength={10}
              value={draft.pic}
              onChange={(e) =>
                onChangeDraft((prev) =>
                  prev ? { ...prev, pic: e.target.value.toUpperCase() } : null,
                )
              }
              className="w-full h-8 rounded border border-slate-300 bg-white px-2.5 font-mono uppercase text-xs outline-none focus:border-brand"
            />
          </div>

          {/* Metadata Section if schema exists */}
          {schema.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Tag size={13} className="text-brand" />
                <span>Metadata Tambahan ({schema.length} atribut)</span>
              </label>
              <DynamicMetadataForm
                schema={schema}
                values={draft.metadata}
                onChange={(newMeta) => {
                  onChangeDraft((prev) => (prev ? { ...prev, metadata: newMeta } : null));
                }}
                layout="vertical"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3.5 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isSubmitting || !draft.transactionTypeId}
            onClick={() => {
              for (const field of schema) {
                if (field.required) {
                  const val = draft.metadata?.[field.key];
                  if (
                    val === undefined ||
                    val === null ||
                    val === "" ||
                    (Array.isArray(val) && val.length === 0)
                  ) {
                    toast.error(`Metadata wajib belum diisi: ${field.label}`);
                    return;
                  }
                }
              }
              onSubmit(draft);
            }}
            className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded bg-brand text-xs font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Check size={13} />
            <span>{draft.isNew ? "Simpan Transaksi" : "Simpan Perubahan"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
