import { useState, useMemo } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { Filter, ArrowUp, ArrowDown, Search, Check, RotateCcw } from "lucide-react";

export type FilterOption = {
  key: string;
  label: string;
  count: number;
};

type ColumnFilterSortPopoverProps = {
  title: string;
  columnKey: string;
  align?: "left" | "right" | "center";
  activeSortColumn?: string;
  activeSortDirection?: "asc" | "desc";
  onSort?: (direction: "asc" | "desc") => void;
  ascLabel?: string;
  descLabel?: string;
  filterOptions?: FilterOption[];
  selectedKeys?: Set<string> | null; // null = all active (no filter applied)
  onApplyFilter?: (selectedKeys: Set<string> | null) => void;
  customFilterNode?: React.ReactNode;
  isFiltered?: boolean;
};

export function ColumnFilterSortPopover({
  title,
  columnKey,
  align = "left",
  activeSortColumn,
  activeSortDirection,
  onSort,
  ascLabel = "Urutkan A → Z",
  descLabel = "Urutkan Z → A",
  filterOptions,
  selectedKeys,
  onApplyFilter,
  customFilterNode,
  isFiltered = false,
}: ColumnFilterSortPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Temporary state while popover is open
  const [tempSelected, setTempSelected] = useState<Set<string> | null>(selectedKeys ?? null);

  const isCurrentSort = activeSortColumn === columnKey;

  const { refs, floatingStyles, context, isPositioned } = useFloating({
    open: isOpen,
    onOpenChange: (open) => {
      setIsOpen(open);
      if (open) {
        setTempSelected(selectedKeys ?? null);
        setSearchQuery("");
      }
    },
    placement: align === "right" ? "bottom-end" : "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip({ fallbackAxisSideDirection: "start" }), shift({ padding: 8 })],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });

  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss, role]);

  const filteredOptions = useMemo(() => {
    if (!filterOptions) return [];
    if (!searchQuery.trim()) return filterOptions;
    const q = searchQuery.toLowerCase();
    return filterOptions.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [filterOptions, searchQuery]);

  const allKeys = useMemo(() => {
    return new Set((filterOptions || []).map((o) => o.key));
  }, [filterOptions]);

  function handleSelectAll() {
    setTempSelected(null); // null means all selected
  }

  function handleClearAll() {
    setTempSelected(new Set());
  }

  function handleToggleKey(key: string) {
    const next = new Set(tempSelected ?? allKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    if (next.size === allKeys.size) {
      setTempSelected(null);
    } else {
      setTempSelected(next);
    }
  }

  function handleApply() {
    if (onApplyFilter) {
      onApplyFilter(tempSelected);
    }
    setIsOpen(false);
  }

  function handleReset() {
    if (onApplyFilter) {
      onApplyFilter(null);
    }
    setTempSelected(null);
    setIsOpen(false);
  }

  return (
    <div
      className={`inline-flex items-center gap-1 select-none ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}
    >
      <span className="font-semibold">{title}</span>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        title={`Filter & Urutkan ${title}`}
        className={`inline-flex items-center justify-center p-0.5 rounded transition ${
          isOpen
            ? "bg-brand text-white shadow-2xs"
            : isFiltered || isCurrentSort
              ? "bg-blue-100 text-brand ring-1 ring-brand/30"
              : "text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
        }`}
      >
        {isCurrentSort ? (
          activeSortDirection === "asc" ? (
            <ArrowUp size={12} className="stroke-[2.5]" />
          ) : (
            <ArrowDown size={12} className="stroke-[2.5]" />
          )
        ) : (
          <Filter size={11} className={isFiltered ? "fill-brand" : ""} />
        )}
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className={`z-[9999] w-64 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xl text-xs space-y-2.5 text-slate-700 transition-opacity duration-100 ${
              isPositioned ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {/* Header / Title */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">
                {title}
              </span>
              {(isFiltered || isCurrentSort) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 text-[10px] text-brand hover:text-blue-800 font-medium"
                >
                  <RotateCcw size={10} /> Reset
                </button>
              )}
            </div>

            {/* Sort Actions */}
            {onSort && (
              <div className="space-y-1 border-b border-slate-100 pb-2">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Urutan
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSort("asc");
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition ${
                    isCurrentSort && activeSortDirection === "asc"
                      ? "bg-blue-50 text-brand font-semibold"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowUp size={12} className="text-slate-400" />
                    <span>{ascLabel}</span>
                  </span>
                  {isCurrentSort && activeSortDirection === "asc" && <Check size={12} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSort("desc");
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-left transition ${
                    isCurrentSort && activeSortDirection === "desc"
                      ? "bg-blue-50 text-brand font-semibold"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowDown size={12} className="text-slate-400" />
                    <span>{descLabel}</span>
                  </span>
                  {isCurrentSort && activeSortDirection === "desc" && <Check size={12} />}
                </button>
              </div>
            )}

            {/* Custom Filter (e.g. Min - Max for nominal) */}
            {customFilterNode && (
              <div className="border-b border-slate-100 pb-2">{customFilterNode}</div>
            )}

            {/* Filter Checklist */}
            {filterOptions && filterOptions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Saring Nilai
                  </span>
                  <div className="flex items-center gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-brand hover:underline font-medium"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="text-slate-500 hover:underline"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                {/* Search Box */}
                {filterOptions.length > 5 && (
                  <div className="relative">
                    <Search
                      size={12}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      placeholder="Cari..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-[11px] rounded border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-brand"
                    />
                  </div>
                )}

                {/* Items List */}
                <div className="max-h-36 overflow-y-auto space-y-0.5 pr-0.5 divide-y divide-slate-50">
                  {filteredOptions.length === 0 ? (
                    <div className="py-2 text-center text-slate-400 text-[11px]">
                      Tidak ada hasil
                    </div>
                  ) : (
                    filteredOptions.map((opt) => {
                      const isChecked = tempSelected === null || tempSelected.has(opt.key);
                      return (
                        <label
                          key={opt.key}
                          className="flex items-center justify-between gap-1.5 px-1 py-1 rounded hover:bg-slate-50 cursor-pointer text-[11px]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleKey(opt.key)}
                              className="rounded border-slate-300 text-brand focus:ring-brand/20 h-3 w-3 cursor-pointer"
                            />
                            <span className="truncate text-slate-700" title={opt.label}>
                              {opt.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">
                            ({opt.count})
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="rounded px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="rounded bg-brand px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 shadow-2xs"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            )}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
