import React from "react";
import type { TransactionType } from "@keuangan-apotek/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Account } from "../../lib/queries";
import { ColumnFilterSortPopover, type FilterOption } from "./ColumnFilterSortPopover";
import type { DraftRow, SortColumn } from "./daily-transaction.types";
import { GoogleSheetsSummaryPill } from "./GoogleSheetsSummaryPill";
import { TransactionDraftRow } from "./TransactionDraftRow";
import { TransactionTableRow } from "./TransactionTableRow";

export type TransactionTableProps = {
  tableWrapperRef: React.Ref<HTMLDivElement>;
  tableBodyHeight: number | null;
  showNeracaFilter: boolean;
  isAssistant: boolean;
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll: () => void;
  // Sort & Filter
  columnSort: { column: SortColumn; direction: "asc" | "desc" };
  onSort: (column: SortColumn, direction: "asc" | "desc") => void;
  dateFilterOptions: FilterOption[];
  colFilterDate: Set<string> | null;
  onApplyColFilterDate: (keys: Set<string> | null) => void;
  typeFilterOptions: FilterOption[];
  colFilterType: Set<string> | null;
  onApplyColFilterType: (keys: Set<string> | null) => void;
  nominalFilterNode: React.ReactNode;
  colFilterAmount: { min?: number; max?: number } | null;
  picFilterOptions: FilterOption[];
  colFilterPic: Set<string> | null;
  onApplyColFilterPic: (keys: Set<string> | null) => void;
  // Data
  selectedAccounts: Account[];
  topDraftRows: DraftRow[];
  beforeDraftsMap: Map<string, DraftRow[]>;
  afterDraftsMap: Map<string, DraftRow[]>;
  filteredTransactionsList: any[];
  isLoading: boolean;
  totalColumns: number;
  selectedTxIds: Set<string>;
  editingRowId: string | null;
  editingRowState: DraftRow | null;
  collapsedMetadataIds?: Set<string>;
  transactionTypes: TransactionType[];
  typeById: Map<string, TransactionType>;
  accountById: Map<string, Account>;
  accountRunningMaps: Map<string, Map<string, { balance: number; mutation: number }>>;
  isKeyTipsActive: boolean;
  isSubmitting: boolean;
  canEdit?: boolean;
  // Handlers
  onUpdateDraft: (draft: DraftRow) => void;
  onDeleteDraft: (id: string) => void;
  onSaveDraft: (draft: DraftRow) => void;
  onToggleMetadata: (isDraft: boolean, idOrIndex: string | number) => void;
  onDraftKeyDown: (e: React.KeyboardEvent, draft: DraftRow) => void;
  onToggleRowSelect: (id: string, shiftKey?: boolean) => void;
  onChangeEditingDraft: (updater: (prev: DraftRow | null) => DraftRow | null) => void;
  onEditKeyDown: (
    e: React.KeyboardEvent,
    id: string,
    draft: DraftRow,
    isPicField?: boolean,
  ) => void;
  onSaveEdit: (id: string, draft: DraftRow) => void;
  onCancelEdit: () => void;
  onStartEdit: (tx: any) => void;
  onDeleteTx: (id: string) => void;
  onInsertRelative: (tx: any, pos: "above" | "below") => void;
  onClearAccountFilters: () => void;
  // Bottom Bar
  groupTabsRef: React.Ref<HTMLDivElement>;
  scrollGroupTabs: (amount: number) => void;
  groupPillsNode: React.ReactNode;
  summaryStats: any;
};

export function TransactionTable({
  tableWrapperRef,
  tableBodyHeight,
  showNeracaFilter,
  isAssistant,
  isAllSelected,
  isSomeSelected,
  onToggleSelectAll,
  columnSort,
  onSort,
  dateFilterOptions,
  colFilterDate,
  onApplyColFilterDate,
  typeFilterOptions,
  colFilterType,
  onApplyColFilterType,
  nominalFilterNode,
  colFilterAmount,
  picFilterOptions,
  colFilterPic,
  onApplyColFilterPic,
  selectedAccounts,
  topDraftRows,
  beforeDraftsMap,
  afterDraftsMap,
  filteredTransactionsList,
  isLoading,
  totalColumns,
  selectedTxIds,
  editingRowId,
  editingRowState,
  collapsedMetadataIds,
  transactionTypes,
  typeById,
  accountById,
  accountRunningMaps,
  isKeyTipsActive,
  isSubmitting,
  canEdit = true,
  onUpdateDraft,
  onDeleteDraft,
  onSaveDraft,
  onToggleMetadata,
  onDraftKeyDown,
  onToggleRowSelect,
  onChangeEditingDraft,
  onEditKeyDown,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onDeleteTx,
  onInsertRelative,
  onClearAccountFilters,
  groupTabsRef,
  scrollGroupTabs,
  groupPillsNode,
  summaryStats,
}: TransactionTableProps) {
  return (
    <div
      ref={tableWrapperRef}
      className="rounded border border-slate-200 bg-white flex flex-col shadow-2xs overflow-hidden"
    >
      <div
        style={tableBodyHeight ? { height: `${tableBodyHeight}px` } : undefined}
        className={`max-w-full overflow-auto ${
          !tableBodyHeight
            ? showNeracaFilter
              ? "h-[calc(100vh-360px)] min-h-[220px]"
              : isAssistant
                ? "h-[calc(100vh-172px)] min-h-[300px]"
                : "h-[calc(100vh-136px)] min-h-[300px]"
            : ""
        }`}
      >
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 text-[11px] font-semibold text-slate-700 shadow-2xs">
            <tr>
              <th className="sticky top-0 z-20 px-2 py-1 w-8 text-center border-r border-slate-200 bg-slate-100">
                <input
                  type="checkbox"
                  aria-label="Pilih semua transaksi"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isSomeSelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-brand focus:ring-brand/20 cursor-pointer h-3.5 w-3.5"
                />
              </th>

              <th className="sticky top-0 z-20 px-2 py-1 w-32 border-r border-slate-200 bg-slate-100">
                <ColumnFilterSortPopover
                  title="Tanggal"
                  columnKey="transactionDate"
                  activeSortColumn={columnSort.column}
                  activeSortDirection={columnSort.direction}
                  onSort={(dir) => onSort("transactionDate", dir)}
                  ascLabel="Terlama → Terbaru"
                  descLabel="Terbaru → Terlama"
                  filterOptions={dateFilterOptions}
                  selectedKeys={colFilterDate}
                  onApplyFilter={onApplyColFilterDate}
                  isFiltered={colFilterDate !== null}
                />
              </th>

              <th className="sticky top-0 z-20 px-2 py-1 min-w-[200px] border-r border-slate-200 bg-slate-100">
                <ColumnFilterSortPopover
                  title="Tipe Transaksi"
                  columnKey="transactionTypeName"
                  activeSortColumn={columnSort.column}
                  activeSortDirection={columnSort.direction}
                  onSort={(dir) => onSort("transactionTypeName", dir)}
                  ascLabel="Nama A → Z"
                  descLabel="Nama Z → A"
                  filterOptions={typeFilterOptions}
                  selectedKeys={colFilterType}
                  onApplyFilter={onApplyColFilterType}
                  isFiltered={colFilterType !== null}
                />
              </th>

              <th className="sticky top-0 z-20 px-2 py-1 w-36 text-right border-r border-slate-200 bg-slate-100">
                <ColumnFilterSortPopover
                  title="Nominal (Rp)"
                  columnKey="amount"
                  align="right"
                  activeSortColumn={columnSort.column}
                  activeSortDirection={columnSort.direction}
                  onSort={(dir) => onSort("amount", dir)}
                  ascLabel="Terkecil → Terbesar"
                  descLabel="Terbesar → Terkecil"
                  customFilterNode={nominalFilterNode}
                  isFiltered={colFilterAmount !== null}
                />
              </th>

              <th className="sticky top-0 z-20 px-2 py-1 w-24 text-center border-r border-slate-200 bg-slate-100">
                <ColumnFilterSortPopover
                  title="PIC"
                  columnKey="pic"
                  align="center"
                  activeSortColumn={columnSort.column}
                  activeSortDirection={columnSort.direction}
                  onSort={(dir) => onSort("pic", dir)}
                  ascLabel="Nama A → Z"
                  descLabel="Nama Z → A"
                  filterOptions={picFilterOptions}
                  selectedKeys={colFilterPic}
                  onApplyFilter={onApplyColFilterPic}
                  isFiltered={colFilterPic !== null}
                />
              </th>

              <th className="sticky top-0 z-20 px-2 py-1 min-w-[160px] border-r border-slate-200 bg-slate-100">
                Metadata
              </th>

              {/* Saldo Kas Column(s): visible for each active filter account (max 2) */}
              {selectedAccounts.map((acc, idx) => (
                <th
                  key={acc.id}
                  className="sticky top-0 z-20 px-2 py-1 min-w-[130px] text-right border-r border-slate-200 bg-blue-100 font-mono text-slate-800"
                  title={`Saldo ${acc.code} · ${acc.name}`}
                >
                  <div className="text-[10px] font-bold text-brand uppercase tracking-wider font-sans leading-none">
                    Saldo Kas {selectedAccounts.length > 1 ? `(#${idx + 1})` : ""}
                  </div>
                  <div className="truncate font-semibold text-[11px]">
                    {acc.code} · {acc.name}
                  </div>
                </th>
              ))}

              <th className="sticky top-0 right-0 z-30 px-2 py-1 w-28 text-center bg-slate-100 border-l border-slate-200">
                Aksi
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {/* Top Draft Rows */}
            {topDraftRows.map((draft, idx) => {
              const curType = typeById.get(draft.transactionTypeId);
              const hasSchema = (curType?.metadataSchema?.length ?? 0) > 0;
              const isMetadataOpen =
                hasSchema && (!collapsedMetadataIds ? true : !collapsedMetadataIds.has(draft.id));

              return (
                <TransactionDraftRow
                  key={draft.id}
                  draft={draft}
                  transactionTypes={transactionTypes}
                  typeById={typeById}
                  accountById={accountById}
                  selectedAccounts={selectedAccounts}
                  totalColumns={totalColumns}
                  isMetadataOpen={isMetadataOpen}
                  isKeyTipsActive={isKeyTipsActive}
                  isFirstDraft={idx === 0}
                  isSubmitting={isSubmitting}
                  onUpdateDraft={onUpdateDraft}
                  onDeleteDraft={onDeleteDraft}
                  onSaveDraft={onSaveDraft}
                  onToggleMetadata={() => onToggleMetadata(true, draft.id)}
                  onDraftKeyDown={onDraftKeyDown}
                />
              );
            })}

            {/* Transactions List */}
            {isLoading ? (
              <tr>
                <td colSpan={totalColumns} className="px-2 py-6 text-center text-muted">
                  Memuat transaksi...
                </td>
              </tr>
            ) : filteredTransactionsList.length === 0 && topDraftRows.length === 0 ? (
              <tr>
                <td colSpan={totalColumns} className="px-2 py-6 text-center text-muted">
                  {selectedAccounts.length > 0 ? (
                    <div className="space-y-1">
                      <p>
                        Tidak ada transaksi yang terkait dengan akun{" "}
                        <strong>
                          {selectedAccounts.map((a) => `${a.code} · ${a.name}`).join(" atau ")}
                        </strong>{" "}
                        pada periode ini.
                      </p>
                      <button
                        type="button"
                        onClick={onClearAccountFilters}
                        className="text-xs font-semibold text-brand underline"
                      >
                        Tampilkan semua transaksi
                      </button>
                    </div>
                  ) : (
                    <>
                      Belum ada transaksi. Klik <strong>+ Baris Baru</strong> untuk menambah
                      transaksi pertama Anda.
                    </>
                  )}
                </td>
              </tr>
            ) : (
              filteredTransactionsList.map((tx, txIdx) => {
                const isEditing = editingRowId === tx.id;
                const currentDraft = isEditing ? editingRowState : null;
                const curType = typeById.get(
                  currentDraft ? currentDraft.transactionTypeId : tx.transactionTypeId,
                );
                const hasSchema = (curType?.metadataSchema?.length ?? 0) > 0;
                const isMetadataOpen =
                  isEditing &&
                  hasSchema &&
                  (!collapsedMetadataIds ? true : !collapsedMetadataIds.has(tx.id));

                const beforeDrafts = beforeDraftsMap.get(tx.id) || [];
                const afterDrafts = afterDraftsMap.get(tx.id) || [];

                return (
                  <React.Fragment key={tx.id}>
                    {/* Before Drafts */}
                    {beforeDrafts.map((d) => {
                      const dType = typeById.get(d.transactionTypeId);
                      const dHasSchema = (dType?.metadataSchema?.length ?? 0) > 0;
                      const dMetadataOpen =
                        dHasSchema &&
                        (!collapsedMetadataIds ? true : !collapsedMetadataIds.has(d.id));

                      return (
                        <TransactionDraftRow
                          key={d.id}
                          draft={d}
                          transactionTypes={transactionTypes}
                          typeById={typeById}
                          accountById={accountById}
                          selectedAccounts={selectedAccounts}
                          totalColumns={totalColumns}
                          isMetadataOpen={dMetadataOpen}
                          isKeyTipsActive={isKeyTipsActive}
                          isFirstDraft={false}
                          isSubmitting={isSubmitting}
                          onUpdateDraft={onUpdateDraft}
                          onDeleteDraft={onDeleteDraft}
                          onSaveDraft={onSaveDraft}
                          onToggleMetadata={() => onToggleMetadata(true, d.id)}
                          onDraftKeyDown={onDraftKeyDown}
                        />
                      );
                    })}

                    <TransactionTableRow
                      tx={tx}
                      txIdx={txIdx}
                      isEditing={isEditing}
                      currentDraft={currentDraft}
                      isSelected={selectedTxIds.has(tx.id)}
                      isMetadataOpen={isMetadataOpen}
                      selectedAccounts={selectedAccounts}
                      accountRunningMaps={accountRunningMaps}
                      transactionTypes={transactionTypes}
                      typeById={typeById}
                      accountById={accountById}
                      totalColumns={totalColumns}
                      isKeyTipsActive={isKeyTipsActive}
                      canEdit={canEdit}
                      onToggleSelect={(shiftKey) => onToggleRowSelect(tx.id, shiftKey)}
                      onChangeDraft={onChangeEditingDraft}
                      onEditKeyDown={(e, isPicField) =>
                        onEditKeyDown(e, tx.id, currentDraft!, isPicField)
                      }
                      onSaveEdit={() => onSaveEdit(tx.id, currentDraft!)}
                      onCancelEdit={onCancelEdit}
                      onStartEdit={() => onStartEdit(tx)}
                      onDelete={() => onDeleteTx(tx.id)}
                      onInsertRelative={(pos) => onInsertRelative(tx, pos)}
                      onToggleMetadata={() => onToggleMetadata(false, tx.id)}
                    />

                    {/* After Drafts */}
                    {afterDrafts.map((d) => {
                      const dType = typeById.get(d.transactionTypeId);
                      const dHasSchema = (dType?.metadataSchema?.length ?? 0) > 0;
                      const dMetadataOpen =
                        dHasSchema &&
                        (!collapsedMetadataIds ? true : !collapsedMetadataIds.has(d.id));

                      return (
                        <TransactionDraftRow
                          key={d.id}
                          draft={d}
                          transactionTypes={transactionTypes}
                          typeById={typeById}
                          accountById={accountById}
                          selectedAccounts={selectedAccounts}
                          totalColumns={totalColumns}
                          isMetadataOpen={dMetadataOpen}
                          isKeyTipsActive={isKeyTipsActive}
                          isFirstDraft={false}
                          isSubmitting={isSubmitting}
                          onUpdateDraft={onUpdateDraft}
                          onDeleteDraft={onDeleteDraft}
                          onSaveDraft={onSaveDraft}
                          onToggleMetadata={() => onToggleMetadata(true, d.id)}
                          onDraftKeyDown={onDraftKeyDown}
                        />
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Google Sheets-style Bottom Status & Group Bar */}
      <div className="flex flex-nowrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-2 h-[34px] min-h-[34px] text-xs select-none overflow-hidden shrink-0 shadow-2xs">
        {/* Left: Group Filter Tabs with Scroll Controls */}
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 pl-0.5 mr-0.5">
            Grup:
          </span>

          <button
            type="button"
            onClick={() => scrollGroupTabs(-150)}
            className="hidden sm:inline-flex items-center justify-center h-6 w-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition shrink-0"
            title="Geser tab grup ke kiri"
            aria-label="Geser tab grup ke kiri"
          >
            <ChevronLeft size={13} />
          </button>

          <div
            ref={groupTabsRef}
            onWheel={(e) => {
              if (e.deltaY !== 0) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
            className="flex items-center gap-1 overflow-x-auto min-w-0 py-0.5 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {groupPillsNode}
          </div>

          <button
            type="button"
            onClick={() => scrollGroupTabs(150)}
            className="hidden sm:inline-flex items-center justify-center h-6 w-5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition shrink-0"
            title="Geser tab grup ke kanan"
            aria-label="Geser tab grup ke kanan"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Right: Google Sheets Summary Pill with Dropdown Popover */}
        <GoogleSheetsSummaryPill summaryStats={summaryStats} />
      </div>
    </div>
  );
}
