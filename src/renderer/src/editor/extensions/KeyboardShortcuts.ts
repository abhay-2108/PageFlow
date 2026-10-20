import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { TextSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pagegroveKeys: {
      toggleTaskChecked: () => ReturnType;
      moveBlockUp: () => ReturnType;
      moveBlockDown: () => ReturnType;
    };
  }
}

function listItemNameAtSelection(state: EditorState): string | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const name = $from.node(depth).type.name;
    if (name === "listItem" || name === "taskItem") {
      return name;
    }
  }
  return null;
}

function indentList(editor: Editor, direction: "sink" | "lift"): boolean {
  const name = listItemNameAtSelection(editor.state);
  if (name) {
    return direction === "sink"
      ? editor.commands.sinkListItem(name)
      : editor.commands.liftListItem(name);
  }
  return true;
}

function moveBlock(
  state: EditorState,
  dispatch: ((tr: Transaction) => void) | undefined,
  direction: -1 | 1,
): boolean {
  const { $from } = state.selection;
  const { doc } = state;

  if ($from.depth < 1) {
    return false;
  }

  const blockStart = $from.before(1);
  const index = doc.resolve(blockStart).index(0);
  const targetIndex = index + direction;

  if (targetIndex < 0 || targetIndex >= doc.childCount) {
    return false;
  }

  const block = doc.child(index);
  const target = doc.child(targetIndex);
  const offset = $from.pos - blockStart;

  const from = direction === -1 ? blockStart - target.nodeSize : blockStart;
  const to =
    direction === -1 ? blockStart + block.nodeSize : blockStart + block.nodeSize + target.nodeSize;
  const ordered = direction === -1 ? [block, target] : [target, block];

  const tr = state.tr.replaceWith(from, to, Fragment.fromArray(ordered));
  const movedStart = direction === -1 ? from : from + target.nodeSize;
  const caret = Math.min(movedStart + offset, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(caret)));

  if (dispatch) {
    dispatch(tr);
  }
  return true;
}

export const KeyboardShortcuts = Extension.create({
  name: "pagegroveKeyboard",

  addCommands() {
    return {
      toggleTaskChecked:
        () =>
        ({ state, commands }) => {
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (node.type.name === "taskItem") {
              return commands.updateAttributes("taskItem", {
                checked: !node.attrs.checked,
              });
            }
          }
          return false;
        },
      moveBlockUp:
        () =>
        ({ state, dispatch }) =>
          moveBlock(state, dispatch, -1),
      moveBlockDown:
        () =>
        ({ state, dispatch }) =>
          moveBlock(state, dispatch, 1),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-e": () => this.editor.commands.toggleCode(),
      "Mod-u": () => this.editor.commands.toggleUnderline(),
      "Mod-Shift-s": () => this.editor.commands.toggleStrike(),
      "Mod-Enter": () => this.editor.commands.toggleTaskChecked(),
      "Alt-Shift-ArrowUp": () => this.editor.commands.moveBlockUp(),
      "Alt-Shift-ArrowDown": () => this.editor.commands.moveBlockDown(),
      Tab: () => indentList(this.editor, "sink"),
      "Shift-Tab": () => indentList(this.editor, "lift"),
      // Notion standard shortcuts (evidence from REA facts-editor.json)
      "Mod-Alt-0": () => this.editor.commands.setParagraph(),
      "Mod-Alt-1": () => this.editor.commands.setHeading({ level: 1 }),
      "Mod-Alt-2": () => this.editor.commands.setHeading({ level: 2 }),
      "Mod-Alt-3": () => this.editor.commands.setHeading({ level: 3 }),
      "Mod-Alt-4": () => this.editor.commands.toggleTaskList(),
      "Mod-Alt-5": () => this.editor.commands.toggleBulletList(),
      "Mod-Alt-6": () => this.editor.commands.toggleOrderedList(),
    };
  },
});
