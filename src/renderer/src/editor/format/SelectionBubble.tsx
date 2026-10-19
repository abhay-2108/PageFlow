import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { inlineAi } from "../ai/controller";
import { commentTools } from "../comments/controller";
import { formatTools, type FormatAction, type FormatState } from "./controller";
import { COLOR_PALETTE } from "./marks";

const TOGGLES: {
  action: FormatAction;
  label: string;
  glyph: string;
  key: keyof Pick<FormatState, "bold" | "italic" | "underline" | "strike" | "code">;
}[] = [
  { action: { type: "toggle-bold" }, label: "Bold", glyph: "B", key: "bold" },
  { action: { type: "toggle-italic" }, label: "Italic", glyph: "I", key: "italic" },
  { action: { type: "toggle-underline" }, label: "Underline", glyph: "U", key: "underline" },
  { action: { type: "toggle-strike" }, label: "Strikethrough", glyph: "S", key: "strike" },
  { action: { type: "toggle-code" }, label: "Code", glyph: "</>", key: "code" },
];

const BAR_WIDTH = 340;
const BAR_HEIGHT = 40;

export interface SelectionBubbleProps {
  onCommentRequest?: (quote: string) => void;
}

export function SelectionBubble({ onCommentRequest }: SelectionBubbleProps) {
  const format = useSyncExternalStore(formatTools.subscribe, formatTools.getState, formatTools.getState);
  const comment = useSyncExternalStore(commentTools.subscribe, commentTools.getState, commentTools.getState);
  const [picker, setPicker] = useState<"text" | "bg" | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ width: BAR_WIDTH, height: BAR_HEIGHT });
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const showComment = Boolean(onCommentRequest) && comment.open;
  const open = format.open || showComment;
  const rect = format.rect ?? comment.rect;

  useEffect(() => {
    if (!format.open) {
      setPicker(null);
    }
  }, [format.open]);

  useLayoutEffect(() => {
    if (!open || !rect || !barRef.current) {
      setPos(null);
      return;
    }
    const width = barRef.current.offsetWidth;
    const height = barRef.current.offsetHeight;
    sizeRef.current = { width, height };
    setPos({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      top: Math.max(height + 12, rect.top - height - 10),
    });
  }, [open, rect, picker]);

  if (!open || !rect) {
    return null;
  }

  const { width, height } = sizeRef.current;
  const position = pos ?? {
    left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
    top: Math.max(height + 12, rect.top - height - 10),
  };

  const pickerColors = picker === "text" ? format.textColor : picker === "bg" ? format.bgColor : null;

  return createPortal(
    <div
      ref={barRef}
      className="pg-format-bar"
      role="toolbar"
      aria-label="Formatting"
      style={{ left: position.left, top: position.top, visibility: pos ? "visible" : "hidden" }}
    >
      <div className="pg-format-bar__row">
        <button
          type="button"
          className="pg-format-bar__btn pg-format-bar__btn--ai"
          aria-label="Ask AI"
          title="Ask AI (Ctrl+J)"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const editor = formatTools.getEditor();
            if (editor) {
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to, " ");
              inlineAi.openWithSelection(editor, { from, to }, selectedText);
            }
          }}
        >
          Ask AI
        </button>
        <span className="pg-format-bar__divider" />
        {TOGGLES.map(({ action, label, glyph, key }) => (
          <button
            key={label}
            type="button"
            className="pg-format-bar__btn"
            aria-label={label}
            aria-pressed={format[key]}
            title={label}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              formatTools.run(action);
            }}
          >
            {glyph}
          </button>
        ))}
        <span className="pg-format-bar__divider" />
        <button
          type="button"
          className="pg-format-bar__btn"
          aria-label="Text color"
          aria-expanded={picker === "text"}
          title="Text color"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPicker((current) => (current === "text" ? null : "text"))}
        >
          <span
            className="pg-format-bar__swatch-text"
            data-color={format.textColor ?? "default"}
            aria-hidden="true"
          >
            A
          </span>
        </button>
        <button
          type="button"
          className="pg-format-bar__btn"
          aria-label="Background color"
          aria-expanded={picker === "bg"}
          title="Background color"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPicker((current) => (current === "bg" ? null : "bg"))}
        >
          <span
            className="pg-format-bar__swatch-bg"
            data-color={format.bgColor ?? "default"}
            aria-hidden="true"
          />
        </button>
        {showComment ? (
          <>
            <span className="pg-format-bar__divider" />
            <button
              type="button"
              className="pg-format-bar__btn pg-format-bar__btn--text"
              aria-label="Comment"
              title="Comment"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const quote = commentTools.pendingQuote();
                if (quote) {
                  onCommentRequest?.(quote);
                }
              }}
            >
              Comment
            </button>
          </>
        ) : null}
      </div>
      {picker ? (
        <div
          className={`pg-format-bar__panel pg-format-bar__panel--${picker}`}
          role="group"
          aria-label={picker === "text" ? "Text colors" : "Background colors"}
        >
          <button
            type="button"
            className={`pg-format-bar__color pg-format-bar__color--${picker} pg-format-bar__color--default`}
            aria-label={picker === "text" ? "Default text color" : "Default background color"}
            data-color="default"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              formatTools.run(
                picker === "text" ? { type: "text-color", name: null } : { type: "bg-color", name: null },
              );
            }}
          >
            {picker === "text" ? "A" : ""}
          </button>
          {COLOR_PALETTE.map(({ name, label }) => {
            const isActive = pickerColors === name;
            return (
              <button
                key={name}
                type="button"
                className={`pg-format-bar__color pg-format-bar__color--${picker}`}
                aria-label={`${picker === "text" ? "Text" : "Background"} color ${label}`}
                aria-pressed={isActive}
                data-color={name}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  const next = isActive ? null : name;
                  formatTools.run(
                    picker === "text" ? { type: "text-color", name: next } : { type: "bg-color", name: next },
                  );
                }}
              >
                {picker === "text" ? "A" : ""}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
