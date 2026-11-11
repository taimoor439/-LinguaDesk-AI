"use client";

import { useCallback, useRef, useState } from "react";

export type ToastVariant = "success" | "error" | "info";

export type ToastData = {
  id: number;
  title?: string;
  message: string;
  variant: ToastVariant;
};

export type ToastOptions = {
  title?: string;
  variant?: ToastVariant;
  /** Auto-dismiss after this many ms. Defaults to 5000. */
  durationMs?: number;
};

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-teal-500 bg-teal-50 text-teal-900",
  error: "border-red-500 bg-red-50 text-red-900",
  info: "border-slate-400 bg-white text-slate-900",
};

/** Single toast. Render inside a ToastList, or standalone in a fixed container. */
export function Toast({ toast, onClose }: { toast: ToastData; onClose: () => void }) {
  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border-l-4 p-4 shadow-lg ${VARIANT_STYLES[toast.variant]}`}
    >
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
        <p className="text-sm">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="rounded p-1 text-slate-500 hover:bg-black/5 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

/** Fixed bottom-right stack rendering the toasts from useToast. */
export function ToastList({ toasts, onDismiss }: { toasts: ToastData[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

/**
 * Lightweight toast state. No context/provider needed:
 * const { toasts, push, dismiss } = useToast();
 * push("Saved", { variant: "success" });
 * <ToastList toasts={toasts} onDismiss={dismiss} />
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = nextId.current;
      nextId.current += 1;
      const toast: ToastData = {
        id,
        message,
        title: options.title,
        variant: options.variant ?? "info",
      };
      setToasts((current) => [...current, toast]);
      const durationMs = options.durationMs ?? 5000;
      if (durationMs > 0) {
        window.setTimeout(() => dismiss(id), durationMs);
      }
      return id;
    },
    [dismiss],
  );

  return { toasts, push, dismiss };
}

export default Toast;
