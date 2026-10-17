import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";

export function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const collapsed = Boolean(node.attrs.collapsed);

  return (
    <NodeViewWrapper className="pg-toggle" data-collapsed={collapsed ? "true" : "false"}>
      <button
        type="button"
        className="pg-toggle__arrow"
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand toggle" : "Collapse toggle"}
        contentEditable={false}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => updateAttributes({ collapsed: !collapsed })}
      />
      <NodeViewContent className="pg-toggle__content" />
    </NodeViewWrapper>
  );
}
