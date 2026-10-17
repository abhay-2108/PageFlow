import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { slash } from "./controller";

const MENU_WIDTH = 288;
const MENU_MAX_HEIGHT = 302;
const GAP = 8;
const VIEWPORT_MARGIN = 12;
const MIN_SPACE_BELOW = 200;
const MIN_HEIGHT = 128;

export function SlashMenu() {
  const state = useSyncExternalStore(slash.subscribe, slash.getState, slash.getState);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state.open) {
      return;
    }
    const selected = listRef.current?.children[state.index];
    if (selected instanceof HTMLElement) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [state.open, state.index, state.items]);

  if (!state.open || !state.rect || state.items.length === 0) {
    return null;
  }

  const spaceBelow = window.innerHeight - state.rect.bottom - GAP - VIEWPORT_MARGIN;
  const openUp =
    spaceBelow < Math.min(MENU_MAX_HEIGHT, MIN_SPACE_BELOW) && state.rect.top > spaceBelow;
  const maxHeight = Math.max(
    MIN_HEIGHT,
    openUp ? state.rect.top - GAP - VIEWPORT_MARGIN : spaceBelow,
  );
  const top = openUp ? state.rect.top - GAP - maxHeight : state.rect.bottom + GAP;
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(state.rect.left, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN),
  );

  return createPortal(
    <div
      className="pg-slash"
      style={{ left, top, width: MENU_WIDTH, maxHeight }}
      role="listbox"
      aria-label="Blocks"
    >
      <div className="pg-slash__list" ref={listRef}>
        {state.items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={index === state.index}
            className={
              index === state.index ? "pg-slash__item pg-slash__item--active" : "pg-slash__item"
            }
            onMouseEnter={() => slash.setIndex(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => slash.select(index)}
          >
            <span className="pg-slash__title">{item.title}</span>
            <span className="pg-slash__hint">{item.hint}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
