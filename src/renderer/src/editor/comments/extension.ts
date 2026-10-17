import { Extension } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { commentTools } from "./controller";

export const CommentTools = Extension.create({
  name: "pagegroveCommentTools",

  onCreate() {
    const editor = this.editor;
    commentTools.setApplier((range, threadId) => {
      try {
        return editor
          .chain()
          .focus()
          .setTextSelection({ from: range.from, to: range.to })
          .setMark("commentAnchor", { threadId })
          .run();
      } catch {
        return false;
      }
    });
    commentTools.setSanitizer((knownThreadIds) => {
      const known = new Set(knownThreadIds);
      const { state, view } = editor;
      const tr = state.tr;
      let changed = false;
      state.doc.descendants((node, pos) => {
        if (!node.isText) {
          return true;
        }
        for (const mark of node.marks) {
          if (mark.type.name === "commentAnchor" && !known.has(String(mark.attrs.threadId))) {
            tr.removeMark(pos, pos + node.nodeSize, mark);
            changed = true;
          }
        }
        return true;
      });
      if (changed) {
        view.dispatch(tr);
      }
    });
  },

  onDestroy() {
    commentTools.reset();
  },

  onSelectionUpdate() {
    const editor = this.editor;
    if (!editor.isEditable) {
      commentTools.hideBubble();
      return;
    }
    const { selection } = editor.state;
    if (selection.empty || selection instanceof NodeSelection) {
      commentTools.hideBubble();
      return;
    }
    const quote = editor.state.doc.textBetween(selection.from, selection.to, " ").trim();
    if (quote.length === 0) {
      commentTools.hideBubble();
      return;
    }
    const coords = editor.view.coordsAtPos(selection.from);
    commentTools.showBubble(
      { left: coords.left, top: coords.top, bottom: coords.bottom },
      { from: selection.from, to: selection.to, quote: quote.slice(0, 140) },
    );
  },

  onBlur() {
    commentTools.hideBubble();
  },
});
