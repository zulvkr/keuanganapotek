import { useState } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { Info } from "lucide-react";

export function TransactionTypeInfoTooltip({
  debitCode,
  debitName,
  creditCode,
  creditName,
}: {
  debitCode?: string;
  debitName?: string;
  creditCode?: string;
  creditName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({
        fallbackAxisSideDirection: "start",
      }),
      shift({ padding: 8 }),
    ],
  });

  const hover = useHover(context, { move: false });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  return (
    <>
      <span
        ref={refs.setReference}
        {...getReferenceProps()}
        className="inline-flex items-center justify-center rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-brand cursor-help transition shrink-0"
        tabIndex={0}
        aria-label="Lihat akun debit dan kredit otomatis"
      >
        <Info size={13} />
      </span>
      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="pointer-events-none z-[9999] min-w-[240px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-xs space-y-2"
          >
            <p className="font-bold text-[11px] text-slate-700 border-b border-slate-100 pb-1">
              Aturan Jurnal Otomatis
            </p>
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-100">
                  Debit (+)
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-800 text-right">
                  {debitCode ? `${debitCode} · ${debitName || ""}` : "—"}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-100">
                  Kredit (-)
                </span>
                <span className="font-mono text-[11px] font-semibold text-slate-800 text-right">
                  {creditCode ? `${creditCode} · ${creditName || ""}` : "—"}
                </span>
              </div>
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
