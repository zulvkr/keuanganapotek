import React from "react";
import {
  type TransactionType,
  type TransactionGroupDetail,
  TRANSACTION_GROUPS,
  inferTransactionGroup,
  senToRupiah,
} from "@keuangan-apotek/shared";
import { Check, Pencil, Plus, RotateCcw, Tag, Trash2 } from "lucide-react";
import type { Account } from "../../lib/queries";
import { DynamicMetadataForm } from "../metadata/DynamicMetadataForm";
import { CellEditPopover } from "./CellEditPopover";
import { formatAmountInput, formatSen, type DraftRow } from "./daily-transaction.types";
import { IsoDateInput } from "./IsoDateInput";
import { KeyTipBadge } from "./KeyboardTipsOverlay";
import { MetadataCellDisplay } from "./MetadataCellDisplay";
import { SearchableTransactionTypeSelect } from "./SearchableTransactionTypeSelect";
import { TransactionTypeInfoTooltip } from "./TransactionTypeInfoTooltip";

function DateQuickEditor({
  initialDate,
  onSave,
  onCancel,
}: {
  initialDate: string;
  onSave: (date: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = React.useState(initialDate);
  const inputRef = React.useRef<any>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 20);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-2">
      <IsoDateInput
        ref={inputRef}
        autoFocus
        value={date}
        onChange={(val) => setDate(val)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(date);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
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
          onClick={() => onSave(date)}
          className="inline-flex items-center gap-1 rounded bg-brand px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700 shadow-2xs"
        >
          <Check size={11} /> Simpan
        </button>
      </div>
    </div>
  );
}

function TransactionTypeQuickEditor({
  currentTypeId,
  transactionTypes,
  accountById,
  onSave,
  onCancel,
}: {
  currentTypeId: string;
  transactionTypes: TransactionType[];
  accountById: Map<string, Account>;
  onSave: (typeId: string) => void;
  onCancel: () => void;
}) {
  const [typeId, setTypeId] = React.useState(currentTypeId);

  return (
    <div className="space-y-2">
      <SearchableTransactionTypeSelect
        value={typeId}
        autoFocus
        onChange={(newId) => {
          setTypeId(newId);
          onSave(newId);
        }}
        transactionTypes={transactionTypes}
        accountById={accountById}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

function AmountQuickEditor({
  initialAmount,
  onSave,
  onCancel,
}: {
  initialAmount: string;
  onSave: (amount: string) => void;
  onCancel: () => void;
}) {
  const [amount, setAmount] = React.useState(initialAmount);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 20);
    return () => clearTimeout(timer);
  }, []);

  const handleSave = () => {
    const formatted = formatAmountInput(amount);
    onSave(formatted);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="text"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => {
          setAmount(formatAmountInput(amount));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSave();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        placeholder="0,00"
        className="w-full h-7 rounded border border-slate-300 px-2 py-1 text-right font-mono text-xs tabular-nums outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
      />
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
          onClick={handleSave}
          className="inline-flex items-center gap-1 rounded bg-brand px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700 shadow-2xs"
        >
          <Check size={11} /> Simpan
        </button>
      </div>
    </div>
  );
}

function PicQuickEditor({
  initialPic,
  onSave,
  onCancel,
}: {
  initialPic: string;
  onSave: (pic: string) => void;
  onCancel: () => void;
}) {
  const [pic, setPic] = React.useState(initialPic);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 20);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="text"
        value={pic}
        maxLength={10}
        placeholder="PIC"
        onChange={(e) => setPic(e.target.value.toUpperCase())}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(pic.trim());
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        className="w-full h-7 text-center uppercase font-mono rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
      />
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
          onClick={() => onSave(pic.trim())}
          className="inline-flex items-center gap-1 rounded bg-brand px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-blue-700 shadow-2xs"
        >
          <Check size={11} /> Simpan
        </button>
      </div>
    </div>
  );
}

export type TransactionTableRowProps = {
  tx: any;
  txIdx: number;
  isEditing: boolean;
  currentDraft: DraftRow | null;
  isSelected: boolean;
  isMetadataOpen: boolean;
  selectedAccounts: Account[];
  accountRunningMaps: Map<string, Map<string, { balance: number; mutation: number }>>;
  transactionTypes: TransactionType[];
  typeById: Map<string, TransactionType>;
  accountById: Map<string, Account>;
  totalColumns: number;
  isKeyTipsActive: boolean;
  canEdit?: boolean;
  onToggleSelect: (shiftKey: boolean) => void;
  onChangeDraft: (updater: (prev: DraftRow | null) => DraftRow | null) => void;
  onEditKeyDown: (e: React.KeyboardEvent, isPicField?: boolean) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onInsertRelative: (pos: "above" | "below") => void;
  onToggleMetadata: (open: boolean) => void;
  onQuickUpdate?: (patch: Record<string, any>) => void;
  groupByKey?: Map<string, TransactionGroupDetail>;
};

export function TransactionTableRow({
  tx,
  txIdx,
  isEditing,
  currentDraft,
  isSelected,
  isMetadataOpen,
  selectedAccounts,
  accountRunningMaps,
  transactionTypes,
  typeById,
  accountById,
  totalColumns,
  isKeyTipsActive,
  canEdit = true,
  onToggleSelect,
  onChangeDraft,
  onEditKeyDown,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDelete,
  onInsertRelative,
  onToggleMetadata,
  onQuickUpdate,
  groupByKey,
}: TransactionTableRowProps) {
  const selectedType = typeById.get(
    isEditing ? currentDraft!.transactionTypeId : tx.transactionTypeId,
  );
  const schema = selectedType?.metadataSchema || [];

  const editingDebitAcc = selectedType ? accountById.get(selectedType.debitAccountId) : null;
  const editingCreditAcc = selectedType ? accountById.get(selectedType.creditAccountId) : null;

  return (
    <>
      <tr
        onDoubleClick={canEdit ? onStartEdit : undefined}
        className={`transition ${
          isEditing
            ? "bg-amber-100/70"
            : isSelected
              ? "bg-blue-50/80 hover:bg-blue-100/60"
              : txIdx % 2 === 0
                ? "bg-white hover:bg-blue-50/40"
                : "bg-slate-50/70 hover:bg-blue-50/40"
        }`}
      >
        {/* Checkbox */}
        <td className="px-2 py-1 border-r border-slate-200 text-center">
          {canEdit ? (
            <input
              type="checkbox"
              aria-label={`Pilih transaksi ${tx.id}`}
              checked={isSelected}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const nativeEvent = e.nativeEvent as MouseEvent;
                onToggleSelect(nativeEvent.shiftKey);
              }}
              className="rounded border-slate-300 text-brand focus:ring-brand/20 cursor-pointer h-3.5 w-3.5"
            />
          ) : (
            <span className="text-[10px] text-slate-300 font-mono">#{txIdx + 1}</span>
          )}
        </td>

        {/* Tanggal */}
        <td className="px-2 py-1 border-r border-slate-200 tabular-nums">
          {isEditing ? (
            <IsoDateInput
              value={currentDraft!.transactionDate}
              onChange={(val) =>
                onChangeDraft((prev) => (prev ? { ...prev, transactionDate: val } : null))
              }
              onKeyDown={(e) => onEditKeyDown(e)}
            />
          ) : canEdit && onQuickUpdate ? (
            <CellEditPopover
              title="Edit Tanggal"
              trigger={
                <span
                  className="hover:bg-blue-50 hover:text-brand px-1 py-0.5 -mx-1 rounded cursor-pointer transition font-mono"
                  title="Klik untuk edit tanggal"
                >
                  {tx.transactionDate}
                </span>
              }
            >
              {({ close }) => (
                <DateQuickEditor
                  initialDate={tx.transactionDate}
                  onSave={(newDate) => {
                    onQuickUpdate({ transactionDate: newDate });
                    close();
                  }}
                  onCancel={close}
                />
              )}
            </CellEditPopover>
          ) : (
            tx.transactionDate
          )}
        </td>

        {/* Tipe Transaksi with Group badge & (i) Tooltip */}
        <td className="px-2 py-1 border-r border-slate-200">
          {isEditing ? (
            <div className="flex items-center gap-1 min-w-0">
              <SearchableTransactionTypeSelect
                value={currentDraft!.transactionTypeId}
                onChange={(newTypeId) => {
                  const newType = typeById.get(newTypeId);
                  onChangeDraft((prev) => {
                    if (!prev) return null;
                    const nextMeta = { ...prev.metadata };
                    if (newType?.metadataSchema) {
                      for (const f of newType.metadataSchema) {
                        if (f.type === "boolean" && nextMeta[f.key] === undefined) {
                          nextMeta[f.key] = false;
                        }
                      }
                    }
                    return { ...prev, transactionTypeId: newTypeId, metadata: nextMeta };
                  });
                }}
                transactionTypes={transactionTypes}
                accountById={accountById}
                onKeyDown={(e) => onEditKeyDown(e)}
              />
              <TransactionTypeInfoTooltip
                debitCode={editingDebitAcc?.code}
                debitName={editingDebitAcc?.name}
                creditCode={editingCreditAcc?.code}
                creditName={editingCreditAcc?.name}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-1.5 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                {(() => {
                  const txType = typeById.get(tx.transactionTypeId);
                  const txGroup =
                    txType?.group ||
                    tx.group ||
                    inferTransactionGroup(
                      accountById.get(tx.debitAccountId) ?? {
                        code: tx.debitAccountCode,
                        name: tx.debitAccountName,
                      },
                      accountById.get(tx.creditAccountId) ?? {
                        code: tx.creditAccountCode,
                        name: tx.creditAccountName,
                      },
                    );
                  const gConf =
                    groupByKey?.get(txGroup) || TRANSACTION_GROUPS.find((g) => g.key === txGroup);
                  return gConf ? (
                    <span
                      className={`shrink-0 inline-flex items-center rounded px-1.5 py-0 text-[10px] font-semibold border ${gConf.badgeClass}`}
                    >
                      {gConf.badgeLabel || gConf.label}
                    </span>
                  ) : null;
                })()}
                {canEdit && onQuickUpdate ? (
                  <CellEditPopover
                    title="Ganti Tipe Transaksi"
                    widthClass="w-80"
                    trigger={
                      <span
                        className="font-semibold text-slate-900 truncate hover:text-brand hover:underline cursor-pointer transition"
                        title={`${tx.transactionTypeName || "Tipe Transaksi"} (Klik untuk ganti tipe)`}
                      >
                        {tx.transactionTypeName || "Tipe Transaksi"}
                      </span>
                    }
                  >
                    {({ close }) => (
                      <TransactionTypeQuickEditor
                        currentTypeId={tx.transactionTypeId}
                        transactionTypes={transactionTypes}
                        accountById={accountById}
                        onSave={(newTypeId) => {
                          onQuickUpdate({ transactionTypeId: newTypeId });
                          close();
                        }}
                        onCancel={close}
                      />
                    )}
                  </CellEditPopover>
                ) : (
                  <span
                    className="font-semibold text-slate-900 truncate"
                    title={tx.transactionTypeName || "Tipe Transaksi"}
                  >
                    {tx.transactionTypeName || "Tipe Transaksi"}
                  </span>
                )}
              </div>
              <TransactionTypeInfoTooltip
                debitCode={tx.debitAccountCode}
                debitName={tx.debitAccountName}
                creditCode={tx.creditAccountCode}
                creditName={tx.creditAccountName}
              />
            </div>
          )}
        </td>

        {/* Nominal */}
        <td className="px-2 py-1 text-right font-mono tabular-nums border-r border-slate-200">
          {isEditing ? (
            <input
              type="text"
              value={currentDraft!.amount}
              onBlur={(e) => {
                const formatted = formatAmountInput(e.target.value);
                onChangeDraft((prev) => (prev ? { ...prev, amount: formatted } : null));
              }}
              onChange={(e) =>
                onChangeDraft((prev) => (prev ? { ...prev, amount: e.target.value } : null))
              }
              onKeyDown={(e) => onEditKeyDown(e)}
              className="w-full h-6 rounded border border-slate-200 px-1.5 py-0.5 text-right font-mono text-xs tabular-nums outline-none focus:border-brand"
            />
          ) : canEdit && onQuickUpdate ? (
            <CellEditPopover
              title="Edit Nominal (Rp)"
              placement="bottom-end"
              trigger={
                <span
                  className="font-semibold text-slate-900 hover:bg-blue-50 hover:text-brand px-1 py-0.5 -mx-1 rounded cursor-pointer transition inline-block text-right"
                  title="Klik untuk edit nominal"
                >
                  Rp {formatSen(tx.amount)}
                </span>
              }
            >
              {({ close }) => (
                <AmountQuickEditor
                  initialAmount={senToRupiah(tx.amount).toFixed(2)}
                  onSave={(newAmount) => {
                    onQuickUpdate({ amount: newAmount });
                    close();
                  }}
                  onCancel={close}
                />
              )}
            </CellEditPopover>
          ) : (
            <span className="font-semibold text-slate-900">Rp {formatSen(tx.amount)}</span>
          )}
        </td>

        {/* PIC */}
        <td className="px-2 py-1 border-r border-slate-200 text-center">
          {isEditing ? (
            <input
              type="text"
              placeholder="PIC"
              maxLength={10}
              value={currentDraft!.pic}
              onChange={(e) =>
                onChangeDraft((prev) => (prev ? { ...prev, pic: e.target.value } : null))
              }
              onKeyDown={(e) => onEditKeyDown(e, true)}
              className="w-full h-6 text-center uppercase font-mono rounded border border-slate-200 px-1 py-0.5 text-xs outline-none focus:border-brand"
            />
          ) : canEdit && onQuickUpdate ? (
            <CellEditPopover
              title="Edit PIC"
              placement="bottom"
              widthClass="w-48"
              trigger={
                <span
                  className="font-mono text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-brand px-1.5 py-0.5 rounded cursor-pointer transition inline-block"
                  title="Klik untuk edit PIC"
                >
                  {tx.pic || "—"}
                </span>
              }
            >
              {({ close }) => (
                <PicQuickEditor
                  initialPic={tx.pic || ""}
                  onSave={(newPic) => {
                    onQuickUpdate({ pic: newPic || null });
                    close();
                  }}
                  onCancel={close}
                />
              )}
            </CellEditPopover>
          ) : (
            <span className="font-mono text-xs font-semibold text-slate-700">{tx.pic || "—"}</span>
          )}
        </td>

        {/* Metadata Clean Content Display */}
        <td className="px-2 py-1 border-r border-slate-200">
          <MetadataCellDisplay
            metadata={isEditing ? currentDraft!.metadata : tx.metadata}
            schema={schema}
            isEditing={isEditing}
            canEdit={canEdit}
            onQuickUpdate={(key, val) => {
              if (isEditing) {
                onChangeDraft((prev) => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    metadata: { ...prev.metadata, [key]: val },
                  };
                });
              } else {
                const nextMeta = { ...tx.metadata, [key]: val };
                onQuickUpdate?.({ metadata: nextMeta });
              }
            }}
            onOpenEditor={() => onToggleMetadata(!isMetadataOpen)}
          />
        </td>

        {/* Saldo Kas Cell(s): visible for each active filter account (max 2) */}
        {selectedAccounts.map((acc) => {
          const item = accountRunningMaps.get(acc.id)?.get(tx.id);
          const balance = item?.balance ?? 0;
          const mutation = item?.mutation ?? 0;
          return (
            <td
              key={acc.id}
              className="px-2 py-1 text-right border-r border-slate-200 font-mono text-xs tabular-nums bg-blue-50/20"
            >
              <div className="font-semibold text-slate-800">Rp {formatSen(balance)}</div>
              {mutation !== 0 && (
                <div
                  className={`text-[10px] font-bold ${mutation > 0 ? "text-emerald-600" : "text-red-500"}`}
                >
                  {mutation > 0 ? `+${formatSen(mutation)}` : formatSen(mutation)}
                </div>
              )}
            </td>
          );
        })}

        {/* Action buttons: Hapus tombol sisipkan di aksi, sisakan Edit & Hapus */}
        <td className="px-2 py-1 text-center sticky right-0 bg-white/95">
          {isEditing ? (
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={onSaveEdit}
                className="relative rounded bg-brand p-1 text-white hover:bg-blue-700 transition"
                title="Simpan perubahan (Ctrl+Enter)"
              >
                <Check size={12} />
                <KeyTipBadge keyChar="S" visible={isKeyTipsActive} />
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 transition"
                title="Batal (Esc)"
              >
                <RotateCcw size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-0.5">
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={onStartEdit}
                    className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-brand transition"
                    title="Edit transaksi"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                    title="Hapus transaksi"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          )}
        </td>
      </tr>

      {/* Expandable Inline Sub-row for Existing Transaction Metadata */}
      {isEditing && isMetadataOpen && schema.length > 0 && (
        <tr key={`${tx.id}-metadata`} className="bg-amber-50/50 border-b border-amber-200">
          <td colSpan={totalColumns} className="px-3 py-1 bg-amber-50/30 border-b border-amber-100">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Tag size={12} /> Metadata:
              </span>
              <DynamicMetadataForm
                schema={schema}
                values={currentDraft ? currentDraft.metadata : tx.metadata}
                onChange={(newMeta) => {
                  onChangeDraft((prev) => (prev ? { ...prev, metadata: newMeta } : null));
                }}
                onKeyDown={(e, isLastField) => onEditKeyDown(e, isLastField)}
                className="flex items-center gap-2.5 overflow-x-auto py-0.5 min-w-0 flex-1 bg-transparent border-none p-0"
              />
            </div>
          </td>
        </tr>
      )}

      {/* Hover divider between rows to insert a new row */}
      <tr key={`${tx.id}-hover-divider`} className="h-0 p-0 m-0 border-none group/divider">
        <td colSpan={totalColumns} className="p-0 relative h-0">
          <div className="absolute inset-x-0 -top-2.5 h-5 z-10 flex items-center justify-center opacity-0 group-hover/divider:opacity-100 hover:opacity-100 transition-opacity pointer-events-none">
            <button
              type="button"
              onClick={() => onInsertRelative("below")}
              className="pointer-events-auto inline-flex items-center gap-1 bg-brand text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-md hover:bg-blue-700 hover:scale-105 transition"
              title="Sisipkan baris di antara sini"
            >
              <Plus size={10} /> Sisipkan Baris
            </button>
          </div>
        </td>
      </tr>
    </>
  );
}
