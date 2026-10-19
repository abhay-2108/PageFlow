import { Extension, type Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { formatTools, type FormatState } from "./controller";

type MarkFlags = Pick<
  FormatState,
  "bold" | "italic" | "underline" | "strike" | "code" | "textColor" | "bgColor"
>;

function marksOf(editor: Editor): MarkFlags {
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    underline: editor.isActive("underline"),
    strike: editor.isActive("strike"),
    code: editor.isActive("code"),
    textColor: (editor.getAttributes("textColor").name as string | undefined) ?? null,
    bgColor: (editor.getAttributes("bgColor").name as string | undefined) ?? null,
  };
}

interface FormatToolsStorage {
  removeScroll: (() => void) | null;
  range: { from: number; to: number } | null;
}

export const FormatTools = Extension.create<Record<string, never>, FormatToolsStorage>({
  name: "pagegroveFormatTools",

  addStorage() {
    return { removeScroll: null, range: null };
  },

  onCreate() {
    const editor = this.editor;
    const storage = this.storage;
    formatTools.setEditor(editor);

    formatTools.setRunner((action) => {
      const chain = editor.chain().focus();
      try {
        switch (action.type) {
          case "toggle-bold":
            return chain.toggleBold().run();
          case "toggle-italic":
            return chain.toggleItalic().run();
          case "toggle-underline":
            return chain.toggleUnderline().run();
          case "toggle-strike":
            return chain.toggleStrike().run();
          case "toggle-code":
            return chain.toggleCode().run();
          case "text-color":
            return action.name === null
              ? chain.unsetTextColor().run()
              : chain.setTextColor(action.name).run();
          case "bg-color":
            return action.name === null
              ? chain.unsetBgColor().run()
              : chain.setBgColor(action.name).run();
          default:
            return false;
        }
      } catch {
        return false;
      }
    });

    const onScroll = () => {
      const range = storage.range;
      if (!range || !formatTools.getState().open) {
        return;
      }
      const coords = editor.view.coordsAtPos(range.from);
      formatTools.sync({
        open: true,
        rect: { left: coords.left, top: coords.top, bottom: coords.bottom },
        ...marksOf(editor),
      });
    };
    window.addEventListener("scroll", onScroll, true);
    storage.removeScroll = () => window.removeEventListener("scroll", onScroll, true);
  },

  onDestroy() {
    this.storage.removeScroll?.();
    this.storage.removeScroll = null;
    formatTools.reset();
  },

  onTransaction() {
    const editor = this.editor;
    const storage = this.storage;
    if (!editor.isEditable) {
      storage.range = null;
      formatTools.hide();
      return;
    }
    const { selection } = editor.state;
    if (selection.empty || selection instanceof NodeSelection || editor.isActive("codeBlock")) {
      storage.range = null;
      formatTools.hide();
      return;
    }
    const text = editor.state.doc.textBetween(selection.from, selection.to, " ").trim();
    if (text.length === 0) {
      storage.range = null;
      formatTools.hide();
      return;
    }
    storage.range = { from: selection.from, to: selection.to };
    const coords = editor.view.coordsAtPos(selection.from);
    formatTools.sync({
      open: true,
      rect: { left: coords.left, top: coords.top, bottom: coords.bottom },
      ...marksOf(editor),
    });
  },

  onBlur() {
    this.storage.range = null;
    formatTools.hide();
  },
});
