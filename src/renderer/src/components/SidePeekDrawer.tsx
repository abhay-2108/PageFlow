import { useEffect, useState } from "react";
import { getApi } from "../lib/api";
import { BRAND } from "../../../shared/brand";
import type { PageRecord, TipTapDocument } from "../../../shared/types";
import { Editor } from "../editor/Editor";

interface SidePeekDrawerProps {
  pageId: string;
  onClose: () => void;
  onOpenFullPage: (id: string) => void;
}

export function SidePeekDrawer({ pageId, onClose, onOpenFullPage }: SidePeekDrawerProps) {
  const [record, setRecord] = useState<PageRecord | null>(null);
  const api = getApi();

  useEffect(() => {
    void api.pages
      .get(pageId)
      .then((rec) => {
        if (rec) setRecord(rec);
      })
      .catch(() => undefined);
  }, [api, pageId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!record) return null;

  const displayTitle = record.meta.title?.trim() || BRAND.empty.untitled;
  const icon = record.meta.icon || "📄";

  return (
    <>
      <div className="pg-side-peek-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="pg-side-peek" role="dialog" aria-label={`Side peek for ${displayTitle}`}>
        <div className="pg-side-peek__header">
          <div className="pg-side-peek__title-wrap">
            <span className="pg-side-peek__icon">{icon}</span>
            <span className="pg-side-peek__title">{displayTitle}</span>
          </div>
          <div className="pg-side-peek__actions">
            <button
              type="button"
              className="pg-side-peek__btn"
              title="Open as full page"
              onClick={() => onOpenFullPage(pageId)}
            >
              ↗ Open full page
            </button>
            <button
              type="button"
              className="pg-side-peek__btn pg-side-peek__btn--close"
              title="Close peek (Esc)"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="pg-side-peek__body">
          <div className="pg-side-peek__page-header">
            {record.meta.icon ? (
              <span className="pg-side-peek__page-icon" aria-hidden="true">
                {record.meta.icon}
              </span>
            ) : null}
            <h1 className="pg-side-peek__page-title">{displayTitle}</h1>
          </div>

          <div className="pg-side-peek__editor">
            <Editor
              key={pageId}
              pageId={pageId}
              onDocChange={(doc: TipTapDocument) => {
                void api.pages.updateDoc(pageId, doc);
              }}
              autoFocus={false}
              onOpenPage={onOpenFullPage}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
