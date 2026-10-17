import { Extension, type Editor } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { Plugin, TextSelection } from "@tiptap/pm/state";
import { blockTools, type BlockAction, type TurnTarget } from "./controller";

const DRAG_THRESHOLD_PX = 4;

function topBlockAtCoords(
  editor: Editor,
  clientX: number,
  clientY: number,
): { pos: number; node: PMNode; rect: DOMRect } | null {
  const coords = editor.view.posAtCoords({ left: clientX, top: clientY });
  if (!coords) {
    return null;
  }
  const $pos = editor.state.doc.resolve(coords.pos);
  if ($pos.depth < 1) {
    return null;
  }
  const pos = $pos.before(1);
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return null;
  }
  const dom = editor.view.nodeDOM(pos);
  if (!(dom instanceof HTMLElement)) {
    return null;
  }
  return { pos, node, rect: dom.getBoundingClientRect() };
}

function isTurnable(node: PMNode): boolean {
  return node.type.name !== "table" && node.type.name !== "horizontalRule";
}

function extractInline(node: PMNode): Fragment | null {
  if (node.isTextblock) {
    return node.content;
  }
  const name = node.type.name;
  if (name === "bulletList" || name === "orderedList" || name === "taskList") {
    const item = node.firstChild;
    const textblock = item?.firstChild;
    return textblock ? textblock.content : null;
  }
  if (name === "toggle") {
    const textblock = node.firstChild;
    return textblock && textblock.isTextblock ? textblock.content : null;
  }
  return null;
}

function codeContentFrom(content: Fragment | null): Fragment | null {
  if (!content) {
    return null;
  }
  const parts: PMNode[] = [];
  content.forEach((child) => {
    if (child.isText && child.text) {
      parts.push(child.type.schema.text(child.text));
    }
  });
  return parts.length > 0 ? Fragment.fromArray(parts) : null;
}

function buildReplacement(editor: Editor, node: PMNode, target: TurnTarget): PMNode | null {
  const schema = editor.schema;
  const typeOf = (name: string) => {
    const type = schema.nodes[name];
    if (!type) {
      throw new Error(`Missing node type: ${name}`);
    }
    return type;
  };
  const content = extractInline(node);
  const paragraph = (fragment: Fragment | null): PMNode =>
    typeOf("paragraph").create(null, fragment ?? undefined);
  switch (target) {
    case "paragraph":
      return typeOf("paragraph").create(null, content ?? undefined);
    case "heading-1":
      return typeOf("heading").create({ level: 1 }, content ?? undefined);
    case "heading-2":
      return typeOf("heading").create({ level: 2 }, content ?? undefined);
    case "heading-3":
      return typeOf("heading").create({ level: 3 }, content ?? undefined);
    case "bulleted":
      return typeOf("bulletList").create(null, typeOf("listItem").create(null, paragraph(content)));
    case "numbered":
      return typeOf("orderedList").create(null, typeOf("listItem").create(null, paragraph(content)));
    case "todo":
      return typeOf("taskList").create(
        null,
        typeOf("taskItem").create({ checked: false }, paragraph(content)),
      );
    case "toggle":
      return typeOf("toggle").create({ collapsed: false }, paragraph(content));
    case "quote":
      return typeOf("blockquote").create(null, paragraph(content));
    case "code":
      return typeOf("codeBlock").create(null, codeContentFrom(content) ?? undefined);
    default:
      return null;
  }
}

function currentKind(node: PMNode): TurnTarget | null {
  switch (node.type.name) {
    case "paragraph":
      return "paragraph";
    case "heading": {
      const level = Number(node.attrs.level ?? 1);
      if (level === 1 || level === 2 || level === 3) {
        return `heading-${level}` as TurnTarget;
      }
      return null;
    }
    case "bulletList":
      return "bulleted";
    case "orderedList":
      return "numbered";
    case "taskList":
      return "todo";
    case "toggle":
      return "toggle";
    case "blockquote":
      return "quote";
    case "codeBlock":
      return "code";
    default:
      return null;
  }
}

function turnIntoBlock(editor: Editor, pos: number, target: TurnTarget): boolean {
  const { state } = editor;
  const node = state.doc.nodeAt(pos);
  if (!node || !isTurnable(node)) {
    return false;
  }
  if (currentKind(node) === target) {
    return false;
  }
  const replacement = buildReplacement(editor, node, target);
  if (!replacement) {
    return false;
  }
  const tr = state.tr.replaceWith(pos, pos + node.nodeSize, replacement);
  editor.view.dispatch(tr);
  return true;
}

function performMove(
  editor: Editor,
  fromPos: number,
  targetPos: number,
  after: boolean,
): boolean {
  const { state, view } = editor;
  const node = state.doc.nodeAt(fromPos);
  const target = state.doc.nodeAt(targetPos);
  if (!node || !target || fromPos === targetPos) {
    return false;
  }
  const insertPos = after ? targetPos + target.nodeSize : targetPos;
  if (insertPos === fromPos || insertPos === fromPos + node.nodeSize) {
    return false;
  }
  const tr = state.tr.delete(fromPos, fromPos + node.nodeSize);
  const mapped = tr.mapping.map(insertPos);
  tr.insert(mapped, node);
  tr.setSelection(TextSelection.near(tr.doc.resolve(mapped + 1)));
  view.dispatch(tr);
  return true;
}

function startGripInteraction(
  editor: Editor,
  action: Extract<BlockAction, { type: "grip-down" }>,
): void {
  const { pos, grip, pointer } = action;
  const node = editor.state.doc.nodeAt(pos);
  if (!node) {
    return;
  }
  let dragging = false;
  let lastTarget: { pos: number; after: boolean } | null = null;

  const onMove = (event: MouseEvent) => {
    if (!dragging) {
      const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
      if (distance < DRAG_THRESHOLD_PX) {
        return;
      }
      dragging = true;
      document.body.classList.add("pg-block-dragging");
    }
    const target = topBlockAtCoords(editor, event.clientX, event.clientY);
    if (target) {
      const after = event.clientY > target.rect.top + target.rect.height / 2;
      const editorRect = editor.view.dom.getBoundingClientRect();
      blockTools.setIndicator({
        top: after ? target.rect.bottom : target.rect.top,
        left: editorRect.left,
        width: editorRect.width,
      });
      lastTarget = { pos: target.pos, after };
    }
  };

  const onUp = () => {
    window.removeEventListener("mousemove", onMove, true);
    window.removeEventListener("mouseup", onUp, true);
    document.body.classList.remove("pg-block-dragging");
    blockTools.setIndicator(null);
    if (!dragging) {
      blockTools.openMenu({
        pos,
        top: grip.top,
        left: grip.right + 6,
        turnable: isTurnable(node),
      });
      return;
    }
    if (lastTarget) {
      performMove(editor, pos, lastTarget.pos, lastTarget.after);
    }
  };

  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("mouseup", onUp, true);
}

interface BlockToolsStorage {
  scrollCleanup: (() => void) | null;
}

export const BlockTools = Extension.create<Record<string, never>, BlockToolsStorage>({
  name: "pagegroveBlockTools",

  addStorage() {
    return { scrollCleanup: null };
  },

  onCreate() {
    const editor = this.editor;

    blockTools.setRunner((action: BlockAction) => {
      const { state } = editor;
      switch (action.type) {
        case "delete": {
          const node = state.doc.nodeAt(action.pos);
          if (node) {
            editor
              .chain()
              .focus()
              .deleteRange({ from: action.pos, to: action.pos + node.nodeSize })
              .run();
            blockTools.closeMenu();
          }
          return;
        }
        case "duplicate": {
          const node = state.doc.nodeAt(action.pos);
          if (node) {
            editor.view.dispatch(state.tr.insert(action.pos + node.nodeSize, node));
            blockTools.closeMenu();
          }
          return;
        }
        case "move-up":
        case "move-down": {
          const node = state.doc.nodeAt(action.pos);
          if (node) {
            const moved =
              action.type === "move-up"
                ? editor.chain().focus().setTextSelection(action.pos + 1).moveBlockUp().run()
                : editor.chain().focus().setTextSelection(action.pos + 1).moveBlockDown().run();
            if (moved) {
              blockTools.closeMenu();
            }
          }
          return;
        }
        case "turn-into": {
          if (turnIntoBlock(editor, action.pos, action.target)) {
            blockTools.closeMenu();
          }
          return;
        }
        case "insert-below": {
          const node = state.doc.nodeAt(action.pos);
          if (node) {
            const insertPos = action.pos + node.nodeSize;
            editor
              .chain()
              .focus()
              .insertContentAt(insertPos, { type: "paragraph" })
              .setTextSelection(insertPos + 1)
              .run();
          }
          return;
        }
        case "grip-down": {
          startGripInteraction(editor, action);
          return;
        }
        default:
          return;
      }
    });

    const reposition = () => {
      const hover = blockTools.getState().hover;
      if (!hover) {
        return;
      }
      const dom = editor.view.nodeDOM(hover.pos);
      if (!(dom instanceof HTMLElement)) {
        blockTools.setHover(null);
        return;
      }
      const rect = dom.getBoundingClientRect();
      blockTools.setHover({ ...hover, top: rect.top, left: rect.left });
    };
    const onResize = () => blockTools.hideAll();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", onResize);
    this.storage.scrollCleanup = () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", onResize);
    };
  },

  onDestroy() {
    this.storage.scrollCleanup?.();
    this.storage.scrollCleanup = null;
    blockTools.reset();
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            mousemove: (_view, event) => {
              if (!editor.isEditable || blockTools.getState().indicator) {
                return false;
              }
              const target = topBlockAtCoords(editor, event.clientX, event.clientY);
              if (!target) {
                return false;
              }
              blockTools.setHover({
                pos: target.pos,
                top: target.rect.top,
                left: target.rect.left,
                turnable: isTurnable(target.node),
              });
              return false;
            },
            mouseleave: () => {
              blockTools.hoverLeave();
              return false;
            },
          },
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Shift-ArrowUp": () => this.editor.commands.moveBlockUp(),
      "Mod-Shift-ArrowDown": () => this.editor.commands.moveBlockDown(),
    };
  },
});
