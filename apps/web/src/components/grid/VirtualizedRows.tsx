import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

type VirtualizedRowsProps<T> = {
  rows: readonly T[];
  rowHeight: number;
  ariaLabel: string;
  renderRow: (row: T, index: number) => React.ReactNode;
};

/** Keeps DOM work proportional to the viewport while retaining keyboard-scrollable rows. */
export function VirtualizedRows<T>({
  rows,
  rowHeight,
  ariaLabel,
  renderRow,
}: VirtualizedRowsProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  return (
    <div aria-label={ariaLabel} className="max-h-[560px] overflow-auto" ref={scrollRef}>
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          return row === undefined ? null : (
            <div
              className="absolute left-0 top-0 w-full"
              data-index={item.index}
              key={item.key}
              ref={virtualizer.measureElement}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              {renderRow(row, item.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
