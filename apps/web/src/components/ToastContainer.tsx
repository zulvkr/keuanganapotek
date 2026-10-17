import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { useToastStore, type ToastItem } from "../lib/toast";

function ToastNotification({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (!item.duration) return;
    const timer = window.setTimeout(() => {
      onDismiss(item.id);
    }, item.duration);
    return () => window.clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  const config = {
    success: {
      border: "border-emerald-200",
      bg: "bg-white",
      text: "text-slate-800",
      icon: <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />,
      role: "status" as const,
    },
    error: {
      border: "border-rose-200",
      bg: "bg-white",
      text: "text-slate-800",
      icon: <AlertCircle size={14} className="text-rose-600 shrink-0" />,
      role: "alert" as const,
    },
    warning: {
      border: "border-amber-200",
      bg: "bg-white",
      text: "text-slate-800",
      icon: <AlertTriangle size={14} className="text-amber-600 shrink-0" />,
      role: "status" as const,
    },
    info: {
      border: "border-blue-200",
      bg: "bg-white",
      text: "text-slate-800",
      icon: <Info size={14} className="text-brand shrink-0" />,
      role: "status" as const,
    },
  }[item.type];

  return (
    <div
      role={config.role}
      className={`pointer-events-auto flex items-start gap-2 rounded-md border ${config.border} ${config.bg} px-3 py-2 text-xs shadow-md transition-all min-w-[260px] max-w-md md:max-w-lg`}
    >
      <div className="mt-0.5 shrink-0">{config.icon}</div>
      <span
        className={`font-medium ${config.text} text-[11px] leading-relaxed flex-1 whitespace-pre-line`}
      >
        {item.message}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Tutup notifikasi"
        className="ml-1 -mr-0.5 mt-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-2.5 right-3 z-50 flex flex-col gap-1.5 pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastNotification key={toast.id} item={toast} onDismiss={removeToast} />
      ))}
    </div>
  );
}
