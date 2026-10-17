import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { PgImageView } from "./PgImageView";
import { assetUrl } from "../../lib/assetUrl";

export const PgImage = Node.create({
  name: "pgImage",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset"),
        renderHTML: (attributes) => (attributes.src ? { "data-asset": String(attributes.src) } : {}),
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("alt") ?? "",
        renderHTML: (attributes) => ({ alt: String(attributes.alt ?? "") }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-pg-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const src = typeof HTMLAttributes["data-asset"] === "string" ? HTMLAttributes["data-asset"] : "";
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-pg-image": "" }),
      ["img", { src: src ? assetUrl(src) : "", alt: String(HTMLAttributes.alt ?? "") }],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PgImageView);
  },
});
