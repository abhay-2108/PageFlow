import { useState, useEffect } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { getApi } from "../../lib/api";
import { BRAND } from "../../../../shared/brand";
import type { PageRecord } from "../../../../shared/types";

export function PageMentionView({ node }: NodeViewProps) {
  const pageId = String(node.attrs.pageId ?? "");
  const fallbackLabel = String(node.attrs.label ?? "");

  const [hovered, setHovered] = useState(false);
  const [pageData, setPageData] = useState<PageRecord | null>(null);

  useEffect(() => {
    if (hovered && !pageData && pageId) {
      void getApi()
        .pages.get(pageId)
        .then((rec) => {
          if (rec) setPageData(rec);
        })
        .catch(() => undefined);
    }
  }, [hovered, pageData, pageId]);

  const displayTitle = pageData?.meta.title?.trim() || fallbackLabel || BRAND.empty.untitled;
  const icon = pageData?.meta.icon ?? "📄";

  return (
    <NodeViewWrapper
      as="span"
      className="pg-mention-wrapper"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="pg-mention" data-page-mention={pageId} data-mention-label={displayTitle}>
        <span className="pg-mention-icon">{icon}</span>
        <span className="pg-mention-text">@{displayTitle}</span>
      </span>

      {hovered ? (
        <div className="pg-mention-popover" role="tooltip">
          <div className="pg-mention-popover__header">
            <span className="pg-mention-popover__icon">{icon}</span>
            <div className="pg-mention-popover__details">
              <strong>{displayTitle}</strong>
              <span className="pg-mention-popover__sub">
                {pageData?.meta.updatedAt
                  ? `Updated ${new Date(pageData.meta.updatedAt).toLocaleDateString()}`
                  : "Workspace Page"}
              </span>
            </div>
          </div>
          {pageData?.doc?.content?.[0]?.content?.[0]?.text ? (
            <p className="pg-mention-popover__preview">
              {String(pageData.doc.content[0].content[0].text).slice(0, 100)}...
            </p>
          ) : null}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}
