import { useState } from "react";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { EmojiPicker } from "../../components/EmojiPicker";

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <NodeViewWrapper className="pg-callout" data-callout="">
      <div className="pg-callout__emoji" contentEditable={false}>
        <button
          type="button"
          aria-label="Callout icon"
          title="Change icon"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPickerOpen((current) => !current)}
        >
          {node.attrs.emoji}
        </button>
        {pickerOpen ? (
          <div className="pg-callout__picker">
            <EmojiPicker
              current={node.attrs.emoji}
              label="Callout icon"
              onPick={(emoji) => {
                updateAttributes({ emoji });
                setPickerOpen(false);
              }}
              onRemove={() => {
                updateAttributes({ emoji: "💡" });
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        ) : null}
      </div>
      <NodeViewContent className="pg-callout__content" />
    </NodeViewWrapper>
  );
}
