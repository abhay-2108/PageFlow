import CodeBlock from "@tiptap/extension-code-block";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { CodeBlockComponent } from "./CodeBlockComponent";

export const CodeBlockWithLang = CodeBlock.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: "javascript",
        parseHTML: (element) => element.getAttribute("data-language") || "javascript",
        renderHTML: (attributes) => ({
          "data-language": attributes.language,
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockComponent);
  },
});
