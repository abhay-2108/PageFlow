import type { Node } from "@tiptap/pm/model";
import { MarkdownSerializer, defaultMarkdownSerializer } from "prosemirror-markdown";
import type { MarkdownSerializerState } from "prosemirror-markdown";
import type { TipTapDocument } from "../../../shared/types";
import { editorSchema } from "../editor/editorExtensions";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const defaults = defaultMarkdownSerializer;

type NodeSerializer = (state: MarkdownSerializerState, node: Node, parent: Node, index: number) => void;

function pick(name: string): NodeSerializer {
  const fn = defaults.nodes[name];
  if (!fn) {
    throw new Error(`Missing default markdown serializer for ${name}`);
  }
  return fn;
}

const nodes = {
  blockquote: pick("blockquote"),
  bulletList: pick("bullet_list"),
  orderedList: pick("ordered_list"),
  listItem: pick("list_item"),
  codeBlock: pick("code_block"),
  heading: pick("heading"),
  horizontalRule: pick("horizontal_rule"),
  hardBreak: pick("hard_break"),
  paragraph: pick("paragraph"),
  text: pick("text"),
  taskList(state: MarkdownSerializerState, node: Node) {
    state.renderList(node, "  ", (index) =>
      node.child(index).attrs.checked ? "- [x] " : "- [ ] ",
    );
  },
  taskItem(state: MarkdownSerializerState, node: Node) {
    state.renderContent(node);
  },
  toggle(state: MarkdownSerializerState, node: Node) {
    state.write(node.attrs.collapsed ? "<details>" : "<details open>");
    state.write("\n");
    const summary = node.firstChild ? escapeHtml(node.firstChild.textContent) : "";
    state.write(`<summary>${summary}</summary>`);
    state.write("\n\n");
    state.renderContent(node);
    state.write("</details>");
    state.closeBlock(node);
  },
};

type MarkSerializerSpec = (typeof defaults.marks)[string];

function pickMark(name: string): MarkSerializerSpec {
  const spec = defaults.marks[name];
  if (!spec) {
    throw new Error(`Missing default markdown serializer for ${name}`);
  }
  return spec;
}

const marks = {
  bold: pickMark("strong"),
  italic: pickMark("em"),
  strike: { open: "~~", close: "~~", mixable: true, expelEnclosingWhitespace: true },
  code: pickMark("code"),
  link: pickMark("link"),
  underline: { open: "<u>", close: "</u>", mixable: true, expelEnclosingWhitespace: true },
};

const serializer = new MarkdownSerializer(nodes, marks);

export function exportMarkdown(doc: TipTapDocument, title: string): string {
  const node = editorSchema.nodeFromJSON(doc);
  const body = serializer.serialize(node, { tightLists: true });
  const trimmedTitle = title.trim();
  const header = trimmedTitle.length > 0 ? `# ${trimmedTitle.replace(/^#+\s*/, "")}\n\n` : "";
  return `${header}${body}`;
}
