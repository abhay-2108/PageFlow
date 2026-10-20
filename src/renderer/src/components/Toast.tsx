import { useEffect } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastData {
  message: string;
  type?: ToastType;
  actionLabel?: string;
  onAction?: () => void;
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(onDismiss, 10_000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast, onDismiss]);

  if (!toast) {
    return null;
  }

  const type = toast.type ?? "info";
  const icon = TOAST_ICONS[type];

  return (
    <div className={`toast toast--${type}`} role="status" aria-live="polite" aria-atomic="true">
      <span className="toast__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="toast__message">{toast.message}</span>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.onAction?.();
            onDismiss();
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        className="toast__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}
