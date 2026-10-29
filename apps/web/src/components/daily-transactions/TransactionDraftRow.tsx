import { Fragment } from "react";
import type { TransactionType } from "@keuangan-apotek/shared";
import { Check, Tag, Trash2 } from "lucide-react";
import type { Account } from "../../lib/queries";
import { DynamicMetadataForm } from "../metadata/DynamicMetadataForm";
import { formatAmountInput, type DraftRow } from "./daily-transaction.types";
import { IsoDateInput } from "./IsoDateInput";
import { KeyTipBadge } from "./KeyboardTipsOverlay";
import { MetadataCellDisplay } from "./MetadataCellDisplay";
import { SearchableTransactionTypeSelect } from "./SearchableTransactionTypeSelect";
import { TransactionTypeInfoTooltip } from "./TransactionTypeInfoTooltip";

export type TransactionDraftRowProps = {
  draft: DraftRow;
  transactionTypes: TransactionType[];
  typeById: Map<string, TransactionType>;
  accountById: Map<string, Account>;
  selectedAccounts: Account[];
  totalColumns: number;
  isMetadataOpen: boolean;
  isKeyTipsActive: boolean;
  isFirstDraft: boolean;
  isSubmitting: boolean;
  onUpdateDraft: (updated: DraftRow) => void;
  onDeleteDraft: (id: string) => void;
  onSaveDraft: (draft: DraftRow) => void;
  onToggleMetadata: (open: boolean) => void;
  onDraftKeyDown: (e: React.KeyboardEvent, draft: DraftRow, isLastField?: boolean) => void;
};

export function TransactionDraftRow({
  draft,
  transactionTypes,
  typeById,
  accountById,
  selectedAccounts,
  totalColumns,
  isMetadataOpen,
  isKeyTipsActive,
  isFirstDraft,
  isSubmitting,
  onUpdateDraft,
  onDeleteDraft,
  onSaveDraft,
  onToggleMetadata,
  onDraftKeyDown,
}: TransactionDraftRowProps) {
  const selectedType = typeById.get(draft.transactionTypeId);
  const debitAcc = selectedType ? accountById.get(selectedType.debitAccountId) : null;
  const creditAcc = selectedType ? accountById.get(selectedType.creditAccountId) : null;
  const schema = selectedType?.metadataSchema || [];

  return (
    <Fragment key={draft.id}>
      <tr
        className={`border-b transition ${
          isMetadataOpen ? "bg-blue-100/70 border-blue-200" : "bg-blue-50/50 border-blue-100"
        }`}
      >
        {/* Checkbox Placeholder */}
        <td className="px-2 py-1 border-r border-slate-200 text-center text-slate-300">-</td>

        {/* Date */}
        <td className="px-2 py-1 border-r border-slate-200">
          <IsoDateInput
            value={draft.transactionDate}
            onChange={(val) => onUpdateDraft({ ...draft, transactionDate: val })}
            onKeyDown={(e) => onDraftKeyDown(e, draft)}
          />
        </td>

        {/* Transaction Type with Group badge & (i) Tooltip */}
        <td className="px-2 py-1 border-r border-slate-200">
          <div className="flex items-center gap-1 min-w-0">
            <SearchableTransactionTypeSelect
              value={draft.transactionTypeId}
              onChange={(newTypeId) => {
                const newType = transactionTypes.find((t) => t.id === newTypeId);
                const hasShift = newType?.metadataSchema?.some((f) => f.key === "shift");
                const lastShift = draft.metadata?.shift;
                const newMeta: Record<string, any> = {};
                if (newType?.metadataSchema) {
                  for (const f of newType.metadataSchema) {
                    if (f.type === "boolean") {
                      newMeta[f.key] =
                        draft.metadata?.[f.key] !== undefined
                          ? Boolean(draft.metadata[f.key])
                          : false;
                    }
                  }
                }
                if (hasShift && lastShift) {
                  newMeta.shift = lastShift;
                }
                onUpdateDraft({
                  ...draft,
                  transactionTypeId: newTypeId,
                  metadata: newMeta,
                });
              }}
              transactionTypes={transactionTypes}
              accountById={accountById}
              onKeyDown={(e) => onDraftKeyDown(e, draft)}
            />
            {selectedType && (
              <TransactionTypeInfoTooltip
                debitCode={debitAcc?.code}
                debitName={debitAcc?.name}
                creditCode={creditAcc?.code}
                creditName={creditAcc?.name}
              />
            )}
          </div>
        </td>

        {/* Nominal */}
        <td className="px-2 py-1 border-r border-slate-200">
          <input
            type="text"
            aria-label="Nominal Transaksi Baru"
            value={draft.amount}
            onBlur={(e) => {
              const formatted = formatAmountInput(e.target.value);
              onUpdateDraft({ ...draft, amount: formatted });
            }}
            onChange={(e) => onUpdateDraft({ ...draft, amount: e.target.value })}
            onKeyDown={(e) => onDraftKeyDown(e, draft)}
            placeholder="0,00"
            className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-right font-mono text-xs focus:border-brand focus:outline-none"
          />
        </td>

        {/* PIC */}
        <td className="px-2 py-1 border-r border-slate-200">
          <input
            type="text"
            value={draft.pic}
            maxLength={10}
            onChange={(e) => onUpdateDraft({ ...draft, pic: e.target.value })}
            onKeyDown={(e) => onDraftKeyDown(e, draft)}
            placeholder="PIC"
            className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-center text-xs focus:border-brand focus:outline-none"
          />
        </td>

        {/* Metadata Cell */}
        <td className="px-2 py-1 border-r border-slate-200">
          <MetadataCellDisplay
            metadata={draft.metadata}
            schema={schema}
            isEditing={true}
            isOpen={isMetadataOpen}
            onOpenEditor={() => onToggleMetadata(!isMetadataOpen)}
          />
        </td>

        {/* Saldo Kas Draft Cell(s): visible for each active filter account */}
        {selectedAccounts.map((acc) => (
          <td
            key={acc.id}
            className="px-2 py-1 text-right font-mono text-slate-400 border-r border-slate-200 bg-blue-50/30 italic text-[11px]"
          >
            (baru)
          </td>
        ))}

        {/* Actions */}
        <td className="px-2 py-1 text-center sticky right-0 bg-blue-50/95">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              disabled={isSubmitting || !draft.transactionTypeId}
              onClick={() => onSaveDraft(draft)}
              className="relative rounded bg-brand p-1 text-white hover:bg-blue-700 disabled:opacity-50 transition"
              title="Simpan baris transaksi (Ctrl+Enter)"
            >
              <Check size={12} />
              <KeyTipBadge keyChar="S" visible={isKeyTipsActive && isFirstDraft} />
            </button>
            <button
              type="button"
              onClick={() => onDeleteDraft(draft.id)}
              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
              title="Batal (Esc)"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expandable Inline Sub-row for Draft Metadata */}
      {isMetadataOpen && schema.length > 0 && (
        <tr key={`${draft.id}-metadata`} className="bg-blue-50/50 border-b border-blue-200">
          <td colSpan={totalColumns} className="px-3 py-1 bg-blue-50/30 border-b border-blue-100">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Tag size={12} /> Metadata:
              </span>
              <DynamicMetadataForm
                schema={schema}
                values={draft.metadata}
                onChange={(newMeta) => {
                  onUpdateDraft({ ...draft, metadata: newMeta });
                }}
                onKeyDown={(e, isLastField) => onDraftKeyDown(e, draft, isLastField)}
                className="flex items-center gap-2.5 overflow-x-auto py-0.5 min-w-0 flex-1 bg-transparent border-none p-0"
              />
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
