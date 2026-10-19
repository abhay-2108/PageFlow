import { Extension, InputRule } from "@tiptap/core";

export const NotionInputRules = Extension.create({
  name: "notionInputRules",

  addInputRules() {
    return [
      // > + Space -> Toggle block
      new InputRule({
        find: /^>\s$/,
        handler: ({ range, chain }) => {
          chain().focus().deleteRange(range).insertToggleBlock().run();
        },
      }),

      // [] or [ ] + Space -> To-do checklist
      new InputRule({
        find: /^(\[\]|\[ \])\s$/,
        handler: ({ range, chain }) => {
          chain().focus().deleteRange(range).toggleTaskList().run();
        },
      }),

      // --- or *** -> Horizontal rule / Divider
      new InputRule({
        find: /^(---|___|\*\*\*)\s?$/,
        handler: ({ range, chain }) => {
          chain().focus().deleteRange(range).setHorizontalRule().run();
        },
      }),

      // " + Space -> Blockquote
      new InputRule({
        find: /^"\s$/,
        handler: ({ range, chain }) => {
          chain().focus().deleteRange(range).toggleBlockquote().run();
        },
      }),
    ];
  },
});
