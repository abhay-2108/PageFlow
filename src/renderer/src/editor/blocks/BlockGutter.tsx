import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { blockTools, type TurnTarget } from "./controller";

const GUTTER_WIDTH = 52;

const TURN_OPTIONS: { target: TurnTarget; label: string }[] = [
  { target: "paragraph", label: "Text" },
  { target: "heading-1", label: "Heading 1" },
  { target: "heading-2", label: "Heading 2" },
  { target: "heading-3", label: "Heading 3" },
  { target: "bulleted", label: "Bulleted list" },
  { target: "numbered", label: "Numbered list" },
  { target: "todo", label: "To-do list" },
  { target: "toggle", label: "Toggle" },
  { target: "quote", label: "Quote" },
  { target: "code", label: "Code" },
];

export function BlockGutter() {
  const state = useSyncExternalStore(blockTools.subscribe, blockTools.getState, blockTools.getState);
  const { hover, menu, indicator } = state;
  const menuRef = useRef<HTMLDivElement>(null);
  const gripRect = useRef<{ left: number; top: number; right: number }>({ left: 0, top: 0, right: 0 });
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) {
      setMenuPos(null);
      return;
    }
    const width = menuRef.current.offsetWidth;
    const height = menuRef.current.offsetHeight;
    setMenuPos({
      left: Math.max(12, Math.min(menu.left, window.innerWidth - width - 12)),
      top: Math.max(12, Math.min(menu.top, window.innerHeight - height - 12)),
    });
  }, [menu]);

  useEffect(() => {
    if (!menu) {
      return;
    }
    menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]')?.focus();
    const onDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        blockTools.closeMenu();
      }
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) {
        return;
      }
      blockTools.closeMenu();
    };
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu]);

  if (!hover && !menu && !indicator) {
    return null;
  }

  const gutterLeft = hover ? Math.max(8, hover.left - GUTTER_WIDTH - 6) : 0;

  return createPortal(
    <>
      {indicator ? (
        <div
          className="pg-block-drop"
          style={{ top: indicator.top, left: indicator.left, width: indicator.width }}
        />
      ) : null}
      {hover && !menu && !indicator ? (
        <div
          className="pg-block-gutter"
          style={{ top: hover.top + 1, left: gutterLeft }}
          onMouseEnter={() => blockTools.hoverEnter()}
          onMouseLeave={() => blockTools.hoverLeave()}
        >
          <button
            type="button"
            className="pg-block-gutter__btn"
            aria-label="Insert block below"
            title="Insert block below"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => blockTools.run({ type: "insert-below", pos: hover.pos })}
          >
            +
          </button>
          <button
            type="button"
            className="pg-block-gutter__btn pg-block-gutter__btn--grip"
            aria-label="Block options"
            title="Block options"
            onMouseDown={(event) => {
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              gripRect.current = { left: rect.left, top: rect.top, right: rect.right };
              blockTools.run({
                type: "grip-down",
                pos: hover.pos,
                grip: gripRect.current,
                pointer: { x: event.clientX, y: event.clientY },
              });
            }}
            onClick={() => {
              if (blockTools.getState().menu?.pos === hover.pos) {
                return;
              }
              blockTools.openMenu({
                pos: hover.pos,
                top: gripRect.current.top,
                left: gripRect.current.right + 6,
                turnable: hover.turnable,
              });
            }}
          >
            ⠿
          </button>
        </div>
      ) : null}
      {menu ? (
        <div
          ref={menuRef}
          className="pg-block-menu"
          role="menu"
          aria-label="Block menu"
          style={
            menuPos
              ? { left: menuPos.left, top: menuPos.top }
              : { left: menu.left, top: menu.top, visibility: "hidden" }
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              blockTools.closeMenu();
              return;
            }
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
              return;
            }
            event.preventDefault();
            const items = Array.from(
              menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ?? [],
            );
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            const next =
              event.key === "ArrowDown"
                ? (index + 1) % items.length
                : (index - 1 + items.length) % items.length;
            items[next]?.focus();
          }}
        >
          <button
            type="button"
            role="menuitem"
            className="pg-block-menu__item"
            onClick={() => blockTools.run({ type: "duplicate", pos: menu.pos })}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            className="pg-block-menu__item pg-block-menu__item--danger"
            onClick={() => blockTools.run({ type: "delete", pos: menu.pos })}
          >
            Delete
          </button>
          <button
            type="button"
            role="menuitem"
            className="pg-block-menu__item"
            onClick={() => blockTools.run({ type: "move-up", pos: menu.pos })}
          >
            Move up
          </button>
          <button
            type="button"
            role="menuitem"
            className="pg-block-menu__item"
            onClick={() => blockTools.run({ type: "move-down", pos: menu.pos })}
          >
            Move down
          </button>
          {menu.turnable ? (
            <>
              <div className="pg-block-menu__divider" />
              <div className="pg-block-menu__label">Turn into</div>
              {TURN_OPTIONS.map(({ target, label }) => (
                <button
                  key={target}
                  type="button"
                  role="menuitem"
                  className="pg-block-menu__item"
                  onClick={() => blockTools.run({ type: "turn-into", pos: menu.pos, target })}
                >
                  {label}
                </button>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </>,
    document.body,
  );
}
