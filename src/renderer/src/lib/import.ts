import type { TipTapDocument } from "../../../shared/types";

interface HtmlNode {
  type: string;
  attrs: Record<string, unknown>;
  content: HtmlNode[];
  text?: string;
}

function parseDomNode(node: Node): HtmlNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      type: "text",
      attrs: {},
      content: [],
      text: node.textContent ?? "",
    };
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return { type: "paragraph", attrs: {}, content: [] };
  }
  const el = node as HTMLElement;
  const tag = (el.tagName ?? "").toLowerCase();
  const children: HtmlNode[] = [];
  if (el.childNodes) {
    for (const child of Array.from(el.childNodes)) {
      children.push(parseDomNode(child));
    }
  }
  const attrs: Record<string, unknown> = {};
  if (tag === "strong" || tag === "b") attrs.bold = true;
  if (tag === "em" || tag === "i") attrs.italic = true;
  if (tag === "u") attrs.underline = true;
  if (tag === "s" || tag === "del") attrs.strike = true;
  if (tag === "a") attrs.href = el.getAttribute ? el.getAttribute("href") ?? "" : "";
  if (tag === "code") attrs.code = true;
  if (tag.startsWith("h") && tag.length === 2) {
    const lvl = parseInt(tag[1] ?? "1", 10);
    if (!isNaN(lvl)) attrs.level = lvl;
  }
  if (tag === "input" && el.getAttribute && el.getAttribute("type") === "checkbox") {
    attrs.checked = el.hasAttribute ? el.hasAttribute("checked") : false;
  }
  return { type: tag, attrs, content: children };
}

function parseHtmlToNodes(html: string): HtmlNode[] {
  if (!html || !html.trim()) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const nodes: HtmlNode[] = [];
  if (doc?.body?.childNodes) {
    for (const child of Array.from(doc.body.childNodes)) {
      nodes.push(parseDomNode(child));
    }
  }
  return nodes;
}

function extractRawText(node: HtmlNode): string {
  if (typeof node.text === "string") {
    return node.text;
  }
  let text = "";
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractRawText(child);
    }
  }
  return text;
}

function extractTextNodes(
  node: HtmlNode,
  inheritedMarks: Array<{ type: string; attrs?: Record<string, unknown> }> = [],
): TipTapDocument["content"] {
  const currentMarks = [...inheritedMarks];
  if (node.attrs.bold) currentMarks.push({ type: "bold" });
  if (node.attrs.italic) currentMarks.push({ type: "italic" });
  if (node.attrs.underline) currentMarks.push({ type: "underline" });
  if (node.attrs.strike) currentMarks.push({ type: "strike" });
  if (node.attrs.code) currentMarks.push({ type: "code" });
  if (node.attrs.href) {
    currentMarks.push({ type: "link", attrs: { href: String(node.attrs.href) } });
  }

  if (node.type === "text" || typeof node.text === "string") {
    const text = extractRawText(node);
    if (text.length > 0) {
      if (currentMarks.length > 0) {
        return [{ type: "text", text, marks: currentMarks }];
      }
      return [{ type: "text", text }];
    }
    return [];
  }

  const result: NonNullable<TipTapDocument["content"]> = [];
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const childNodes = extractTextNodes(child, currentMarks);
      if (childNodes) {
        result.push(...childNodes);
      }
    }
  }
  return result;
}

function nodesToTipTap(nodes: HtmlNode[]): TipTapDocument {
  const content: TipTapDocument["content"] = [];
  for (const node of nodes) {
    if (node.type === "h1" || node.type === "h2" || node.type === "h3") {
      content.push({
        type: "heading",
        attrs: { level: parseInt(node.type[1] ?? "1", 10) },
        content: extractTextNodes(node),
      });
    } else if (node.type === "ul") {
      content.push({
        type: "bulletList",
        content: extractListItems(node),
      });
    } else if (node.type === "ol") {
      content.push({
        type: "orderedList",
        content: extractListItems(node),
      });
    } else if (node.type === "blockquote") {
      content.push({
        type: "blockquote",
        content: extractParagraphs(node),
      });
    } else if (node.type === "pre") {
      content.push({
        type: "codeBlock",
        content: [{ type: "text", text: extractRawText(node) }],
      });
    } else if (node.type === "hr") {
      content.push({ type: "horizontalRule" });
    } else if (node.type === "img") {
      const src = node.attrs.src;
      if (typeof src === "string" && src.length > 0) {
        content.push({
          type: "paragraph",
          content: [{
            type: "pgImage",
            attrs: { src, alt: "" },
          }],
        });
      }
    } else {
      content.push({
        type: "paragraph",
        content: extractTextNodes(node),
      });
    }
  }
  return { type: "doc", content };
}

function extractListItems(node: HtmlNode): TipTapDocument["content"] {
  const items: TipTapDocument["content"] = [];
  for (const child of node.content) {
    if (child && typeof child === "object" && "type" in child) {
      const childNode = child as HtmlNode;
      if (childNode.type === "li") {
        const isTask = childNode.content.some(
          (c) => c && typeof c === "object" && "type" in c && (c as HtmlNode).type === "input",
        );
        if (isTask) {
          const checked = childNode.content.some(
            (c) => c && typeof c === "object" && "type" in c && (c as HtmlNode).attrs.checked,
          );
          items.push({
            type: "taskItem",
            attrs: { checked: Boolean(checked) },
            content: extractParagraphs(childNode),
          });
        } else {
          items.push({
            type: "listItem",
            content: extractParagraphs(childNode),
          });
        }
      }
    }
  }
  return items;
}

function extractParagraphs(node: HtmlNode): TipTapDocument["content"] {
  const result: TipTapDocument["content"] = [];
  for (const child of node.content) {
    if (child && typeof child === "object" && "type" in child) {
      const childNode = child as HtmlNode;
      if (childNode.type === "p" || childNode.type === "div") {
        result.push({ type: "paragraph", content: extractTextNodes(childNode) });
      } else {
        result.push({ type: "paragraph", content: extractTextNodes(childNode) });
      }
    }
  }
  return result;
}


export function importMarkdown(markdown: string): TipTapDocument {
  const html = markdownToSimpleHtml(markdown);
  return importHtml(html);
}

export function importHtml(html: string): TipTapDocument {
  const nodes = parseHtmlToNodes(html);
  return nodesToTipTap(nodes);
}

function markdownToSimpleHtml(markdown: string): string {
  const lines = markdown.split("\n");
  const html: string[] = [];
  let inCodeBlock = false;
  let inList = false;
  let listType = "";

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        html.push("</code></pre>");
        inCodeBlock = false;
      } else {
        html.push("<pre><code>");
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      html.push(escapeHtml(line));
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html.push(`</${listType}>`);
        inList = false;
      }
      continue;
    }

    if (trimmed.startsWith("### ")) {
      html.push(`<h3>${inlineMdToHtml(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      html.push(`<h2>${inlineMdToHtml(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      html.push(`<h1>${inlineMdToHtml(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("> ")) {
      html.push(`<blockquote>${inlineMdToHtml(trimmed.slice(2))}</blockquote>`);
    } else if (/^[-*]\s+/.test(trimmed)) {
      if (!inList || listType !== "ul") {
        if (inList) html.push(`</${listType}>`);
        html.push("<ul>");
        inList = true;
        listType = "ul";
      }
      html.push(`<li>${inlineMdToHtml(trimmed.replace(/^[-*]\s+/, ""))}</li>`);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      if (!inList || listType !== "ol") {
        if (inList) html.push(`</${listType}>`);
        html.push("<ol>");
        inList = true;
        listType = "ol";
      }
      html.push(`<li>${inlineMdToHtml(trimmed.replace(/^\d+\.\s+/, ""))}</li>`);
    } else if (/^(---+|\*\*\*+)$/.test(trimmed)) {
      html.push("<hr>");
    } else {
      if (inList) {
        html.push(`</${listType}>`);
        inList = false;
      }
      html.push(`<p>${inlineMdToHtml(trimmed)}</p>`);
    }
  }

  if (inList) html.push(`</${listType}>`);
  return html.join("\n");
}

function inlineMdToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
