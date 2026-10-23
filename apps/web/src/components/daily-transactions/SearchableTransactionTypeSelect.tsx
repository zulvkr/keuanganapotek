import { useState, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
} from "@floating-ui/react";
import { Search, ChevronDown, Check, X } from "lucide-react";
import {
  type TransactionType,
  type TransactionGroup,
  TRANSACTION_GROUPS,
  TRANSACTION_GROUP_LABELS,
  inferTransactionGroup,
} from "@keuangan-apotek/shared";
import type { Account } from "../../lib/queries";

export interface SearchableTransactionTypeSelectProps {
  value: string;
  onChange: (typeId: string) => void;
  transactionTypes: TransactionType[];
  accountById: Map<string, Account>;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const SearchableTransactionTypeSelect = forwardRef<
  HTMLButtonElement,
  SearchableTransactionTypeSelectProps
>(
  (
    {
      value,
      onChange,
      transactionTypes,
      accountById,
      onKeyDown,
      autoFocus = false,
      disabled = false,
      placeholder = "Pilih tipe transaksi...",
      className = "",
      id,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const buttonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement);

    const selectedType = useMemo(
      () => transactionTypes.find((t) => t.id === value),
      [transactionTypes, value],
    );

    // Floating UI configuration
    const { refs, floatingStyles, context } = useFloating({
      open: isOpen,
      onOpenChange: (open) => {
        setIsOpen(open);
        if (open) {
          setSearchQuery("");
          setHighlightedIndex(0);
        }
      },
      placement: "bottom-start",
      whileElementsMounted: autoUpdate,
      middleware: [offset(4), flip({ fallbackAxisSideDirection: "start" }), shift({ padding: 8 })],
    });

    const dismiss = useDismiss(context);
    const role = useRole(context, { role: "listbox" });
    const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

    // Filter transaction types based on search query
    const filteredTypes = useMemo(() => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return transactionTypes;

      return transactionTypes.filter((t) => {
        const debitAcc = accountById.get(t.debitAccountId);
        const creditAcc = accountById.get(t.creditAccountId);
        const group = t.group || inferTransactionGroup(debitAcc, creditAcc);
        const groupLabel = (TRANSACTION_GROUP_LABELS[group] || "").toLowerCase();

        const matchCode = t.code.toLowerCase().includes(q);
        const matchName = t.name.toLowerCase().includes(q);
        const matchDesc = (t.description || "").toLowerCase().includes(q);
        const matchDebitCode = debitAcc?.code.toLowerCase().includes(q) ?? false;
        const matchDebitName = debitAcc?.name.toLowerCase().includes(q) ?? false;
        const matchCreditCode = creditAcc?.code.toLowerCase().includes(q) ?? false;
        const matchCreditName = creditAcc?.name.toLowerCase().includes(q) ?? false;
        const matchGroup = groupLabel.includes(q);

        return (
          matchCode ||
          matchName ||
          matchDesc ||
          matchDebitCode ||
          matchDebitName ||
          matchCreditCode ||
          matchCreditName ||
          matchGroup
        );
      });
    }, [transactionTypes, searchQuery, accountById]);

    // Group the filtered items for visual sections
    const groupedResults = useMemo(() => {
      const map = new Map<TransactionGroup, TransactionType[]>();
      for (const grp of TRANSACTION_GROUPS) {
        map.set(grp.key, []);
      }
      for (const t of filteredTypes) {
        const g =
          t.group ||
          inferTransactionGroup(
            accountById.get(t.debitAccountId),
            accountById.get(t.creditAccountId),
          );
        const list = map.get(g) ?? [];
        list.push(t);
        map.set(g, list);
      }
      return map;
    }, [filteredTypes, accountById]);

    // Keep highlighted index in bounds
    useEffect(() => {
      if (highlightedIndex >= filteredTypes.length) {
        setHighlightedIndex(Math.max(0, filteredTypes.length - 1));
      }
    }, [filteredTypes.length, highlightedIndex]);

    // Scroll active item into view
    useEffect(() => {
      if (!isOpen || !listRef.current) return;
      const activeEl = listRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`,
      ) as HTMLElement | null;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }, [highlightedIndex, isOpen]);

    function handleSelectType(type: TransactionType) {
      onChange(type.id);
      setIsOpen(false);
      buttonRef.current?.focus();
    }

    function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
      // Forward row-saving combinations (Ctrl+Enter, Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key.toLowerCase() === "s")) {
        onKeyDown?.(e);
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      // If user starts typing alphanumeric character, open and put in search
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setSearchQuery(e.key);
        setIsOpen(true);
        return;
      }

      onKeyDown?.(e);
    }

    function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % Math.max(1, filteredTypes.length));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex(
          (prev) => (prev - 1 + filteredTypes.length) % Math.max(1, filteredTypes.length),
        );
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const target = filteredTypes[highlightedIndex];
        if (target) {
          handleSelectType(target);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        return;
      }

      if (e.key === "Tab") {
        // Close dropdown and let Tab navigate to next field naturally
        const target = filteredTypes[highlightedIndex];
        if (target && searchQuery.trim().length > 0) {
          onChange(target.id);
        }
        setIsOpen(false);
        return;
      }

      // Forward Ctrl+Enter to save row
      if ((e.ctrlKey || e.metaKey) && (e.key === "Enter" || e.key.toLowerCase() === "s")) {
        onKeyDown?.(e);
      }
    }

    // Connect ref with Floating UI
    const setReferenceRef = (node: HTMLButtonElement | null) => {
      (buttonRef as any).current = node;
      refs.setReference(node);
    };

    return (
      <div className="relative inline-block w-full">
        {/* Trigger Button */}
        <button
          ref={setReferenceRef}
          id={id}
          type="button"
          disabled={disabled}
          autoFocus={autoFocus}
          {...getReferenceProps({
            onClick: () => setIsOpen((prev) => !prev),
            onKeyDown: handleTriggerKeyDown,
          })}
          className={`flex items-center justify-between gap-1 w-full h-6 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-left outline-none transition hover:border-slate-300 focus:border-brand disabled:bg-slate-50 disabled:text-slate-400 ${className}`}
          title={selectedType ? `${selectedType.code} · ${selectedType.name}` : placeholder}
        >
          <span className="truncate font-medium text-slate-800">
            {selectedType ? (
              <span className="flex items-center gap-1 truncate">
                <span className="font-mono text-[10px] text-slate-500 font-semibold shrink-0">
                  [{selectedType.code}]
                </span>
                <span className="truncate">{selectedType.name}</span>
              </span>
            ) : (
              <span className="text-slate-400 italic">{placeholder}</span>
            )}
          </span>
          <ChevronDown size={11} className="text-slate-400 shrink-0 ml-0.5" />
        </button>

        {/* Dropdown Popover */}
        {isOpen && (
          <FloatingPortal>
            <FloatingFocusManager context={context} initialFocus={searchInputRef} modal={false}>
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                {...getFloatingProps()}
                className="z-[9999] w-[340px] max-w-[95vw] rounded-lg border border-slate-200 bg-white shadow-xl text-xs overflow-hidden flex flex-col"
              >
                {/* Search Bar Header */}
                <div className="p-1.5 border-b border-slate-100 bg-slate-50/70 flex items-center gap-1.5">
                  <Search size={13} className="text-slate-400 shrink-0 ml-1" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setHighlightedIndex(0);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Ketik nama, kode, akun debit/kredit..."
                    className="w-full bg-transparent text-xs text-slate-800 outline-none placeholder:text-slate-400 py-0.5"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setHighlightedIndex(0);
                        searchInputRef.current?.focus();
                      }}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-600"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Quick Hint Header */}
                <div className="px-2 py-1 bg-slate-50 text-[10px] text-slate-400 border-b border-slate-100 flex items-center justify-between">
                  <span>
                    Gunakan <kbd className="font-mono bg-white px-1 py-0.2 rounded border">↑</kbd>{" "}
                    <kbd className="font-mono bg-white px-1 py-0.2 rounded border">↓</kbd> &{" "}
                    <kbd className="font-mono bg-white px-1 py-0.2 rounded border">Enter</kbd>
                  </span>
                  <span className="tabular-nums">{filteredTypes.length} hasil</span>
                </div>

                {/* Items List */}
                <div
                  ref={listRef}
                  className="max-h-[260px] overflow-y-auto divide-y divide-slate-50 p-1"
                >
                  {filteredTypes.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs">
                      Tidak ditemukan tipe transaksi yang sesuai.
                    </div>
                  ) : (
                    TRANSACTION_GROUPS.map((grp) => {
                      const items = groupedResults.get(grp.key) || [];
                      if (items.length === 0) return null;

                      return (
                        <div key={grp.key} className="py-1">
                          {/* Group Section Header */}
                          <div className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                            <span>{grp.label}</span>
                            <span className="text-[9px] font-normal lowercase">
                              {items.length} opsi
                            </span>
                          </div>

                          {/* Group Items */}
                          <div className="space-y-0.5 mt-0.5">
                            {items.map((item) => {
                              const overallIndex = filteredTypes.indexOf(item);
                              const isHighlighted = overallIndex === highlightedIndex;
                              const isSelected = item.id === value;

                              const debitAcc = accountById.get(item.debitAccountId);
                              const creditAcc = accountById.get(item.creditAccountId);

                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  data-index={overallIndex}
                                  onClick={() => handleSelectType(item)}
                                  onMouseEnter={() => setHighlightedIndex(overallIndex)}
                                  className={`w-full text-left rounded px-2 py-1.5 transition flex flex-col gap-0.5 ${
                                    isHighlighted
                                      ? "bg-blue-50 text-brand"
                                      : isSelected
                                        ? "bg-slate-100 text-slate-900 font-medium"
                                        : "text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="font-mono font-bold text-[11px] text-slate-800 shrink-0">
                                        {item.code}
                                      </span>
                                      <span className="font-medium text-xs truncate">
                                        {item.name}
                                      </span>
                                    </div>
                                    {isSelected && (
                                      <Check size={12} className="text-brand shrink-0" />
                                    )}
                                  </div>

                                  {/* Journal Rule Subtitle (Debit & Credit) */}
                                  <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                                    <span className="truncate">
                                      <span className="font-semibold text-emerald-700">D:</span>{" "}
                                      {debitAcc ? `${debitAcc.code} ${debitAcc.name}` : "—"}
                                    </span>
                                    <span className="text-slate-300">|</span>
                                    <span className="truncate">
                                      <span className="font-semibold text-amber-700">K:</span>{" "}
                                      {creditAcc ? `${creditAcc.code} ${creditAcc.name}` : "—"}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
      </div>
    );
  },
);

SearchableTransactionTypeSelect.displayName = "SearchableTransactionTypeSelect";
