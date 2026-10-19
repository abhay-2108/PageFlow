import type { Editor } from "@tiptap/core";

let currentEditor: Editor | null = null;

export const activeEditor = {
  set(editor: Editor | null): void {
    currentEditor = editor;
  },
  get(): Editor | null {
    return currentEditor;
  },
};
