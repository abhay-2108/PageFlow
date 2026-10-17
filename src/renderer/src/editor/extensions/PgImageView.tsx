import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { assetUrl } from "../../lib/assetUrl";

export function PgImageView({ node, selected, deleteNode }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");

  return (
    <NodeViewWrapper
      className={selected ? "pg-image pg-image--selected" : "pg-image"}
      data-pg-image=""
    >
      {src ? (
        <img
          src={assetUrl(src)}
          alt={String(node.attrs.alt ?? "")}
          draggable={false}
          contentEditable={false}
        />
      ) : null}
      {selected ? (
        <button
          type="button"
          className="pg-image__remove"
          aria-label="Delete image"
          contentEditable={false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => deleteNode()}
        >
          Delete image
        </button>
      ) : null}
    </NodeViewWrapper>
  );
}
