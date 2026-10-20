import { mergeAttributes, Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PageMentionView } from "./PageMentionView";

export const PageMention = Node.create({
  name: "pageMention",

  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      pageId: { default: "" },
      label: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-page-mention]",
        getAttrs: (element) => {
          const el = element as HTMLElement;
          return {
            pageId: el.getAttribute("data-page-mention") ?? "",
            label: el.getAttribute("data-mention-label") ?? "",
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const pageId = String(node.attrs.pageId ?? "");
    const label = String(node.attrs.label ?? "");
    return [
      "span",
      mergeAttributes({
        "data-page-mention": pageId,
        "data-mention-label": label,
        class: "pg-mention",
      }),
      `@${label}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageMentionView);
  },
});
