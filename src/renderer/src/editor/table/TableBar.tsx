import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { tableTools, type TableAction } from "./controller";

const BAR_WIDTH = 216;
const BAR_HEIGHT = 44;

const ACTIONS: { action: TableAction; label: string }[] = [
  { action: "add-row", label: "Add row" },
  { action: "add-column", label: "Add column" },
  { action: "delete-row", label: "Delete row" },
  { action: "delete-column", label: "Delete column" },
  { action: "delete-table", label: "Delete table" },
];

function clamp(left: number, top: number, width: number, height: number) {
  return {
    left: Math.max(12, Math.min(left, window.innerWidth - width - 12)),
    top: Math.max(12, Math.min(top, window.innerHeight - height - 12)),
  };
}

export function TableBar() {
  const state = useSyncExternalStore(tableTools.subscribe, tableTools.getState, tableTools.getState);
  const barRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ width: BAR_WIDTH, height: BAR_HEIGHT });
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const open = state.open;
  const rect = state.rect;

  useLayoutEffect(() => {
    if (!open || !rect || !barRef.current) {
      setPos(null);
      return;
    }
    const width = barRef.current.offsetWidth;
    const height = barRef.current.offsetHeight;
    sizeRef.current = { width, height };
    setPos(clamp(rect.left + 8, rect.top, width, height));
  }, [open, rect]);

  if (!open || !rect) {
    return null;
  }

  const { width, height } = sizeRef.current;
  const { left, top } = pos ?? clamp(rect.left + 8, rect.top, width, height);

  return createPortal(
    <div ref={barRef} className="pg-table-bar" style={{ left, top }} aria-label="Table tools">
      {ACTIONS.map(({ action, label }) => (
        <button
          key={action}
          type="button"
          className="pg-table-bar__btn"
          aria-label={label}
          title={label}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            tableTools.run(action);
          }}
        >
          {label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
