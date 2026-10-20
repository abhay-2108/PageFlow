import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

function formatEmbedUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  // YouTube watch link conversion to embed
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  // Figma embed
  if (url.includes("figma.com/file/") || url.includes("figma.com/design/")) {
    return `https://www.figma.com/embed?embed_host=pageflow&url=${encodeURIComponent(url)}`;
  }
  return url;
}

export function EmbedView({ node, updateAttributes }: NodeViewProps) {
  const currentSrc = (node.attrs.src as string) || "";
  const [inputUrl, setInputUrl] = useState(currentSrc);
  const [isEditing, setIsEditing] = useState(!currentSrc);

  const handleSave = () => {
    const formatted = formatEmbedUrl(inputUrl);
    updateAttributes({ src: formatted });
    setIsEditing(false);
  };

  return (
    <NodeViewWrapper className="pg-embed-wrapper" contentEditable={false}>
      {isEditing || !currentSrc ? (
        <div className="pg-embed-form">
          <div className="pg-embed-form__header">
            <span className="pg-embed-icon">🌐</span>
            <strong>Embed Web Content, Video, or Figma</strong>
          </div>
          <div className="pg-embed-form__input-group">
            <input
              type="url"
              className="pg-embed-input"
              placeholder="Paste YouTube, Figma, or website link..."
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              autoFocus
            />
            <button type="button" className="pg-btn pg-btn--primary" onClick={handleSave}>
              Embed
            </button>
          </div>
        </div>
      ) : (
        <div className="pg-embed-display">
          <div className="pg-embed-toolbar">
            <span className="pg-embed-badge">Embed</span>
            <span className="pg-embed-url" title={currentSrc}>
              {currentSrc}
            </span>
            <button
              type="button"
              className="pg-embed-edit-btn"
              onClick={() => setIsEditing(true)}
            >
              Edit link
            </button>
          </div>
          <iframe
            src={currentSrc}
            className="pg-embed-iframe"
            title="Embedded Web Content"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allowFullScreen
          />
        </div>
      )}
    </NodeViewWrapper>
  );
}
