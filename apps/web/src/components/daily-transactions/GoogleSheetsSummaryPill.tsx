import React, { useState } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { Check, ChevronDown } from "lucide-react";
import { senToRupiah } from "@keuangan-apotek/shared";

export type SummaryMetricKey = "sum" | "avg" | "min" | "max" | "count";

export interface SummaryStats {
  isSelected: boolean;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

export interface GoogleSheetsSummaryPillProps {
  summaryStats: SummaryStats;
}

const STORAGE_KEY = "ka_buku_summary_metric";

function formatSen(value: number): string {
  const rupiah = senToRupiah(value);
  const fixed = rupiah.toFixed(2);
  const [whole, fraction] = fixed.split(".");
  return `${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}

const METRIC_DEFINITIONS: Array<{
  key: SummaryMetricKey;
  label: string;
  getValue: (stats: SummaryStats) => string;
}> = [
  {
    key: "sum",
    label: "Sum",
    getValue: (stats) => `Rp ${formatSen(stats.sum)}`,
  },
  {
    key: "avg",
    label: "Avg",
    getValue: (stats) => `Rp ${formatSen(stats.avg)}`,
  },
  {
    key: "min",
    label: "Min",
    getValue: (stats) => `Rp ${formatSen(stats.min)}`,
  },
  {
    key: "max",
    label: "Max",
    getValue: (stats) => `Rp ${formatSen(stats.max)}`,
  },
  {
    key: "count",
    label: "Count",
    getValue: (stats) => `${stats.count}`,
  },
];

export function GoogleSheetsSummaryPill({ summaryStats }: GoogleSheetsSummaryPillProps) {
  const [activeMetric, setActiveMetric] = useState<SummaryMetricKey>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY) as SummaryMetricKey | null;
      if (saved && ["sum", "avg", "min", "max", "count"].includes(saved)) {
        return saved;
      }
    }
    return "sum";
  });

  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "top-end",
    middleware: [offset(4), flip(), shift({ padding: 6 })],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([click, dismiss]);

  const handleSelectMetric = (metricKey: SummaryMetricKey) => {
    setActiveMetric(metricKey);
    setIsOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, metricKey);
    }
  };

  const activeDef =
    METRIC_DEFINITIONS.find((m) => m.key === activeMetric) || METRIC_DEFINITIONS[0]!;
  const displayValue = activeDef.getValue(summaryStats);

  return (
    <div className="relative inline-flex items-center shrink-0">
      {/* Google Sheets Pill Button */}
      <button
        type="button"
        ref={refs.setReference}
        {...getReferenceProps()}
        className={`inline-flex items-center gap-1.5 rounded px-2.5 py-0.5 text-[11px] font-sans font-medium transition select-none cursor-pointer border ${
          summaryStats.isSelected
            ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300 font-semibold shadow-2xs"
            : "bg-emerald-50/80 hover:bg-emerald-100/90 text-emerald-800 border-emerald-200/80"
        }`}
        title="Klik untuk memilih metrik kalkulasi"
        aria-label="Pilih metrik kalkulasi Google Sheets"
        aria-expanded={isOpen}
      >
        {summaryStats.isSelected && (
          <span className="rounded bg-emerald-600 px-1 py-0 text-[9px] font-bold text-white uppercase tracking-wider">
            {summaryStats.count}
          </span>
        )}
        <span className="tabular-nums">
          <strong className="font-semibold text-emerald-950">{activeDef.label}:</strong>{" "}
          {displayValue}
        </span>
        <ChevronDown
          size={11}
          className={`text-emerald-700 transition-transform duration-150 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 min-w-[210px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl text-xs font-sans text-slate-800 animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="py-0.5">
              {METRIC_DEFINITIONS.map((metric) => {
                const isSelected = activeMetric === metric.key;
                const valueText = metric.getValue(summaryStats);
                return (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => handleSelectMetric(metric.key)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs transition ${
                      isSelected
                        ? "bg-slate-100/80 font-semibold text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 flex justify-center text-slate-700">
                        {isSelected && (
                          <Check size={13} className="text-emerald-600 stroke-[2.5]" />
                        )}
                      </span>
                      <span>{metric.label}:</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-900 text-right font-medium">
                      {valueText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
