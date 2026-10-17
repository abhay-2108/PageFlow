import { Mark, mergeAttributes } from "@tiptap/core";

export const CommentAnchor = Mark.create({
  name: "commentAnchor",

  inclusive: false,

  addAttributes() {
    return {
      threadId: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-comment-thread") ?? "",
        renderHTML: (attributes) => ({ "data-comment-thread": String(attributes.threadId ?? "") }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-thread]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "pg-comment-mark" }), 0];
  },
});
