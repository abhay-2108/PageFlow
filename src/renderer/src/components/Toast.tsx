import { useEffect } from "react";

export interface ToastData {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

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

  return (
    <div className="toast" role="status">
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
    </div>
  );
}
