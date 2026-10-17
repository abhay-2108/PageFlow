import type { TipTapNode } from "./types";

const MAX_TEXT_LENGTH = 200_000;

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "blockquote",
  "listItem",
  "taskItem",
  "codeBlock",
  "toggle",
  "horizontalRule",
]);

export function extractDocText(doc: unknown): string {
  const parts: string[] = [];
  let budget = MAX_TEXT_LENGTH;

  const walk = (node: unknown): void => {
    if (budget <= 0 || node === null || typeof node !== "object") {
      return;
    }

    const typed = node as TipTapNode;

    if (typeof typed.text === "string") {
      const text = typed.text.slice(0, budget);
      budget -= text.length;
      if (text.length > 0) {
        parts.push(text);
      }
    }

    if (Array.isArray(typed.content)) {
      for (let index = 0; index < typed.content.length; index += 1) {
        walk(typed.content[index]);
        if (budget <= 0) {
          return;
        }
      }
    }

    if (typeof typed.type === "string" && BLOCK_TYPES.has(typed.type) && parts.length > 0) {
      parts.push("\n");
    }
  };

  walk(doc);

  return parts
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
