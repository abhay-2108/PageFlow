import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { commentTools } from "./controller";

export interface CommentBubbleProps {
  onRequest: (quote: string) => void;
}

export function CommentBubble({ onRequest }: CommentBubbleProps) {
  const state = useSyncExternalStore(commentTools.subscribe, commentTools.getState, commentTools.getState);

  if (!state.open || !state.rect) {
    return null;
  }

  const top = state.rect.top - 40 >= 8 ? state.rect.top - 40 : state.rect.bottom + 8;
  const left = Math.max(12, Math.min(state.rect.left, window.innerWidth - 120));

  return createPortal(
    <button
      type="button"
      className="pg-comment-bubble"
      style={{ left, top }}
      aria-label="Comment"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        const quote = commentTools.pendingQuote();
        if (quote) {
          onRequest(quote);
        }
      }}
    >
      Comment
    </button>,
    document.body,
  );
}
