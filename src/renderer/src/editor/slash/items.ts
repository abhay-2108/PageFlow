import type { Editor, Range } from "@tiptap/core";
import { getApi } from "../../lib/api";
import { inlineAi } from "../ai/controller";

export interface SlashItem {
  id: string;
  title: string;
  aliases: string[];
  hint: string;
  run: (editor: Editor, range: Range) => void;
}

function replaceBlock(editor: Editor, range: Range) {
  return editor.chain().focus().deleteRange(range);
}

async function insertImageFromPicker(editor: Editor, range: Range) {
  const api = getApi();
  const result = await api.assets.pickImage();
  if (!result.ok || !result.src) {
    editor.chain().focus().deleteRange(range).run();
    return;
  }
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent({
      type: "pgImage",
      attrs: { src: result.src, alt: result.alt ?? "" },
    })
    .run();
}

export const slashItems: SlashItem[] = [
  {
    id: "ai",
    title: "Ask AI...",
    aliases: ["ai", "ollama", "qwen", "write", "generate"],
    hint: "Draft or edit with local Ollama AI",
    run: (editor, range) => {
      replaceBlock(editor, range).run();
      inlineAi.openAtCursor(editor);
    },
  },
  {
    id: "text",
    title: "Text",
    aliases: ["p", "paragraph"],
    hint: "Plain paragraph",
    run: (editor, range) => {
      replaceBlock(editor, range).setParagraph().run();
    },
  },

  {
    id: "heading-1",
    title: "Heading 1",
    aliases: ["h1"],
    hint: "Large section title",
    run: (editor, range) => {
      replaceBlock(editor, range).setHeading({ level: 1 }).run();
    },
  },
  {
    id: "heading-2",
    title: "Heading 2",
    aliases: ["h2"],
    hint: "Medium section title",
    run: (editor, range) => {
      replaceBlock(editor, range).setHeading({ level: 2 }).run();
    },
  },
  {
    id: "heading-3",
    title: "Heading 3",
    aliases: ["h3"],
    hint: "Small section title",
    run: (editor, range) => {
      replaceBlock(editor, range).setHeading({ level: 3 }).run();
    },
  },
  {
    id: "bulleted-list",
    title: "Bulleted list",
    aliases: ["ul", "bullet"],
    hint: "Simple list with markers",
    run: (editor, range) => {
      replaceBlock(editor, range).toggleBulletList().run();
    },
  },
  {
    id: "numbered-list",
    title: "Numbered list",
    aliases: ["ol", "number"],
    hint: "Ordered list",
    run: (editor, range) => {
      replaceBlock(editor, range).toggleOrderedList().run();
    },
  },
  {
    id: "to-do-list",
    title: "To-do list",
    aliases: ["todo", "checkbox"],
    hint: "Checklist item",
    run: (editor, range) => {
      replaceBlock(editor, range).toggleTaskList().run();
    },
  },
  {
    id: "toggle",
    title: "Toggle",
    aliases: ["collapse"],
    hint: "Collapsible container",
    run: (editor, range) => {
      replaceBlock(editor, range).insertToggleBlock().run();
    },
  },
  {
    id: "callout",
    title: "Callout",
    aliases: ["note", "info", "tip"],
    hint: "Make it stand out",
    run: (editor, range) => {
      replaceBlock(editor, range).insertCalloutBlock().run();
    },
  },
  {
    id: "image",
    title: "Image",
    aliases: ["img", "picture", "photo"],
    hint: "Upload an image",
    run: (editor, range) => {
      void insertImageFromPicker(editor, range);
    },
  },
  {
    id: "table",
    title: "Table",
    aliases: ["grid", "database"],
    hint: "Simple editable table",
    run: (editor, range) => {
      replaceBlock(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    id: "divider",
    title: "Divider",
    aliases: ["hr", "line"],
    hint: "Horizontal rule",
    run: (editor, range) => {
      replaceBlock(editor, range).setHorizontalRule().run();
    },
  },
  {
    id: "quote",
    title: "Quote",
    aliases: ["blockquote"],
    hint: "Capture a quote",
    run: (editor, range) => {
      replaceBlock(editor, range).toggleBlockquote().run();
    },
  },
  {
    id: "code",
    title: "Code",
    aliases: ["code block"],
    hint: "Fenced code block",
    run: (editor, range) => {
      replaceBlock(editor, range).toggleCodeBlock().run();
    },
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return slashItems;
  }
  return slashItems.filter(
    (item) =>
      item.title.toLowerCase().includes(normalized) ||
      item.aliases.some((alias) => alias.toLowerCase().includes(normalized)),
  );
}
