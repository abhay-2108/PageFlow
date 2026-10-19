import { useMemo } from "react";
import { renderMarkdownToHtml } from "../../../shared/markdown";

export { renderMarkdownToHtml, parseInlineFormatting, escapeHtml } from "../../../shared/markdown";

export interface AiMarkdownViewProps {
  content: string;
  isStreaming?: boolean;
  className?: string;
}

export function AiMarkdownView({ content, isStreaming = false, className = "" }: AiMarkdownViewProps) {
  const html = useMemo(() => renderMarkdownToHtml(content), [content]);

  return (
    <div className={`pg-ai-markdown-view ${className}`}>
      <div
        className="pg-ai-markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {isStreaming ? <span className="pg-ai-streaming-cursor" aria-hidden="true" /> : null}
    </div>
  );
}
