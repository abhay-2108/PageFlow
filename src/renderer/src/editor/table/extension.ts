import { Extension } from "@tiptap/core";
import { tableTools, type TableAction } from "./controller";

export const TableTools = Extension.create({
  name: "pagegroveTableTools",

  onCreate() {
    const editor = this.editor;
    tableTools.setRunner((action: TableAction) => {
      const chain = editor.chain().focus();
      switch (action) {
        case "add-row":
          return chain.addRowAfter().run();
        case "add-column":
          return chain.addColumnAfter().run();
        case "delete-row":
          return chain.deleteRow().run();
        case "delete-column":
          return chain.deleteColumn().run();
        case "delete-table":
          return chain.deleteTable().run();
        default:
          return false;
      }
    });
  },

  onDestroy() {
    tableTools.reset();
  },

  onSelectionUpdate() {
    const editor = this.editor;
    if (!editor.isEditable) {
      tableTools.hide();
      return;
    }
    const { $from } = editor.state.selection;
    let tablePos: number | null = null;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      if ($from.node(depth).type.name === "table") {
        tablePos = $from.before(depth);
        break;
      }
    }
    if (tablePos === null) {
      tableTools.hide();
      return;
    }
    const dom = editor.view.nodeDOM(tablePos);
    if (!(dom instanceof HTMLElement)) {
      tableTools.hide();
      return;
    }
    const rect = dom.getBoundingClientRect();
    tableTools.show({ left: rect.right, top: rect.top });
  },

  onBlur() {
    tableTools.hide();
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const editor = this.editor;
        if (!editor.isActive("table")) {
          return false;
        }
        if (editor.commands.goToNextCell()) {
          return true;
        }
        if (editor.can().addRowAfter()) {
          return editor.chain().addRowAfter().goToNextCell().run();
        }
        return false;
      },
    };
  },
});
