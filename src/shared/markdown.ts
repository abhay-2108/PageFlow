export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function parseInlineFormatting(text: string): string {
  let res = escapeHtml(text);

  // Inline code: `code`
  res = res.replace(/`([^`]+)`/g, '<code class="pg-ai-inline-code">$1</code>');

  // Bold: **text** or __text__
  res = res.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  res = res.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  res = res.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  res = res.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Strikethrough: ~~text~~
  res = res.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  return res;
}

export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";

  const lines = markdown.split("\n");
  const htmlParts: string[] = [];

  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockBuffer: string[] = [];

  let inList: "ul" | "ol" | "task" | null = null;
  let inTable = false;
  let tableHeaders: string[] = [];
  let tableRows: string[] = [];

  const closeList = () => {
    if (inList === "ul") htmlParts.push("</ul>");
    else if (inList === "ol") htmlParts.push("</ol>");
    else if (inList === "task") htmlParts.push("</ul>");
    inList = null;
  };

  const closeTable = () => {
    if (!inTable) return;
    const ths = tableHeaders.map((h) => `<th><p>${parseInlineFormatting(h)}</p></th>`).join("");
    htmlParts.push(
      `<div class="pg-ai-table-wrap"><table class="pg-ai-table"><thead><tr>${ths}</tr></thead><tbody>${tableRows.join("")}</tbody></table></div>`,
    );
    inTable = false;
    tableHeaders = [];
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? "";
    const trimmed = rawLine.trim();

    // Fenced code block check
    if (trimmed.startsWith("```")) {
      closeTable();
      if (inCodeBlock) {
        // End code block
        const codeContent = escapeHtml(codeBlockBuffer.join("\n"));
        htmlParts.push(
          `<div class="pg-ai-code-block"><div class="pg-ai-code-header">${escapeHtml(codeBlockLang || "code")}</div><pre><code>${codeContent}</code></pre></div>`,
        );
        inCodeBlock = false;
        codeBlockLang = "";
        codeBlockBuffer = [];
      } else {
        closeList();
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
        codeBlockBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(rawLine);
      continue;
    }

    // Markdown Table Check: | Col 1 | Col 2 |
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      const isDivider = cells.every((c) => /^:?-+:?$/.test(c));

      if (isDivider) {
        // Divider row: validates previous row as table header
        continue;
      }

      if (inTable) {
        const tds = cells.map((c) => `<td><p>${parseInlineFormatting(c)}</p></td>`).join("");
        tableRows.push(`<tr>${tds}</tr>`);
      } else {
        closeList();
        inTable = true;
        tableHeaders = cells;
        tableRows = [];
      }
      continue;
    } else if (inTable) {
      closeTable();
    }

    // Empty lines close lists
    if (!trimmed) {
      closeList();
      continue;
    }

    // Horizontal Rule
    if (/^(---|___|\*\*\*)$/.test(trimmed)) {
      closeList();
      htmlParts.push('<hr class="pg-ai-hr" />');
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      closeList();
      htmlParts.push(`<h4 class="pg-ai-h3">${parseInlineFormatting(trimmed.slice(4))}</h4>`);
      continue;
    }
    if (trimmed.startsWith("## ")) {
      closeList();
      htmlParts.push(`<h3 class="pg-ai-h2">${parseInlineFormatting(trimmed.slice(3))}</h3>`);
      continue;
    }
    if (trimmed.startsWith("# ")) {
      closeList();
      htmlParts.push(`<h2 class="pg-ai-h1">${parseInlineFormatting(trimmed.slice(2))}</h2>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      closeList();
      htmlParts.push(`<blockquote class="pg-ai-quote">${parseInlineFormatting(trimmed.slice(2))}</blockquote>`);
      continue;
    }

    // Task Checklist: - [ ] or - [x]
    const taskMatch = /^- \[(x| )\] (.*)$/i.exec(trimmed);
    if (taskMatch) {
      if (inList !== "task") {
        closeList();
        inList = "task";
        htmlParts.push('<ul data-type="taskList" class="pg-ai-task-list">');
      }
      const isChecked = (taskMatch[1] ?? "").toLowerCase() === "x";
      const taskText = parseInlineFormatting(taskMatch[2] ?? "");
      htmlParts.push(
        `<li data-type="taskItem" data-checked="${isChecked}" class="pg-ai-task-item"><label><input type="checkbox"${isChecked ? ' checked="checked"' : ""} /></label><div><p class="${isChecked ? "pg-ai-task-text--done" : ""}">${taskText}</p></div></li>`,
      );
      continue;
    }

    // Bullet List: - item or * item
    if (/^[-*]\s+/.test(trimmed)) {
      if (inList !== "ul") {
        closeList();
        inList = "ul";
        htmlParts.push('<ul class="pg-ai-ul">');
      }
      const itemText = parseInlineFormatting(trimmed.replace(/^[-*]\s+/, ""));
      htmlParts.push(`<li>${itemText}</li>`);
      continue;
    }

    // Numbered List: 1. item
    const numMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (numMatch) {
      if (inList !== "ol") {
        closeList();
        inList = "ol";
        htmlParts.push('<ol class="pg-ai-ol">');
      }
      const itemText = parseInlineFormatting(numMatch[2] ?? "");
      htmlParts.push(`<li>${itemText}</li>`);
      continue;
    }

    // Standard paragraph
    closeList();
    htmlParts.push(`<p class="pg-ai-p">${parseInlineFormatting(trimmed)}</p>`);
  }

  if (inCodeBlock) {
    const codeContent = escapeHtml(codeBlockBuffer.join("\n"));
    htmlParts.push(
      `<div class="pg-ai-code-block"><div class="pg-ai-code-header">${escapeHtml(codeBlockLang || "code")}</div><pre><code>${codeContent}</code></pre></div>`,
    );
  }

  closeList();
  closeTable();
  return htmlParts.join("");
}
