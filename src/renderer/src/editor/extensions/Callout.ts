import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CalloutView } from "./CalloutView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pagegroveCallout: {
      insertCalloutBlock: () => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: "💡",
        parseHTML: (element) => element.getAttribute("data-callout-emoji") ?? "💡",
        renderHTML: (attributes) => ({ "data-callout-emoji": String(attributes.emoji ?? "💡") }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-callout": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      insertCalloutBlock:
        () =>
        ({ state, chain }) => {
          const { $from } = state.selection;
          const blockPos = $from.before($from.depth);
          return chain()
            .focus()
            .insertContentAt(
              { from: blockPos, to: blockPos + 2 },
              {
                type: this.name,
                attrs: { emoji: "💡" },
                content: [{ type: "paragraph" }],
              },
            )
            .run();
        },
    };
  },
});
