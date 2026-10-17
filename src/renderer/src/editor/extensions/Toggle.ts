import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ToggleView } from "./ToggleView";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pagegroveToggle: {
      insertToggleBlock: () => ReturnType;
    };
  }
}

export const Toggle = Node.create({
  name: "toggle",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-collapsed") === "true",
        renderHTML: (attributes) => ({
          "data-collapsed": attributes.collapsed ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-toggle]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-toggle": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },

  addCommands() {
    return {
      insertToggleBlock:
        () =>
        ({ state, chain }) => {
          const { $from } = state.selection;
          const blockPos = $from.before($from.depth);
          return chain()
            .focus()
            .insertContentAt(
              { from: blockPos, to: blockPos + 2 },
              { type: this.name, content: [{ type: "paragraph" }] },
            )
            .run();
        },
    };
  },
});
