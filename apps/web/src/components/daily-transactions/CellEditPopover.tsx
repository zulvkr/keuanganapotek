import React, { useState } from "react";
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
  type Placement,
} from "@floating-ui/react";

export type CellEditPopoverProps = {
  title?: string;
  trigger: React.ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: (helpers: { close: () => void }) => React.ReactNode;
  widthClass?: string;
  placement?: Placement;
  disabled?: boolean;
};

export function CellEditPopover({
  title,
  trigger,
  isOpen: controlledIsOpen,
  onOpenChange: controlledOnOpenChange,
  children,
  widthClass = "w-64",
  placement = "bottom-start",
  disabled = false,
}: CellEditPopoverProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = disabled ? false : isControlled ? controlledIsOpen : internalIsOpen;

  const setIsOpen = (next: boolean | ((prev: boolean) => boolean)) => {
    if (disabled) return;
    const resolvedNext = typeof next === "function" ? next(isOpen) : next;
    if (!isControlled) setInternalIsOpen(resolvedNext);
    controlledOnOpenChange?.(resolvedNext);
  };

  const { refs, floatingStyles, context, isPositioned } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip({ fallbackAxisSideDirection: "start" }), shift({ padding: 8 })],
  });

  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "dialog" });

  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss, role]);

  return (
    <>
      <span
        ref={refs.setReference}
        role="button"
        tabIndex={disabled ? undefined : 0}
        {...getReferenceProps({
          onClick: (e: React.MouseEvent) => {
            if (disabled) return;
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(true);
            }
          },
        })}
        className={`inline-flex items-center ${disabled ? "" : "cursor-pointer"} max-w-full`}
      >
        {trigger}
      </span>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className={`z-[9999] ${widthClass} rounded-lg border border-slate-200 bg-white p-2.5 shadow-xl text-xs space-y-2 text-slate-700 transition-opacity duration-100 ${
              isPositioned ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setIsOpen(false);
              }
            }}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-slate-100 pb-1 text-[11px] font-bold text-slate-700">
                <span>{title}</span>
              </div>
            )}
            {children({ close: () => setIsOpen(false) })}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
