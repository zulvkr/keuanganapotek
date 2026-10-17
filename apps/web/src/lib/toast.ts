import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      // Limit to 4 toasts at once to keep the terminal interface tidy
      toasts: [...state.toasts.slice(-3), { ...toast, id }],
    }));
    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

export const toast = {
  success: (message: string, duration = 3500) => {
    return useToastStore.getState().addToast({ type: "success", message, duration });
  },
  error: (message: string, duration?: number) => {
    const autoDuration = duration ?? (message.length > 80 ? 9000 : 4500);
    return useToastStore.getState().addToast({ type: "error", message, duration: autoDuration });
  },
  info: (message: string, duration = 3500) => {
    return useToastStore.getState().addToast({ type: "info", message, duration });
  },
  warning: (message: string, duration = 4000) => {
    return useToastStore.getState().addToast({ type: "warning", message, duration });
  },
  dismiss: (id: string) => {
    useToastStore.getState().removeToast(id);
  },
};
