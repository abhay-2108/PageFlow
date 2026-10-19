import { describe, expect, it } from "vitest";
import { renderMarkdownToHtml } from "../markdown";

describe("renderMarkdownToHtml", () => {
  it("renders compact headings and paragraphs without extra newlines", () => {
    const md = "# Title\n## Section\nParagraph text.";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain('<h2 class="pg-ai-h1">Title</h2>');
    expect(html).toContain('<h3 class="pg-ai-h2">Section</h3>');
    expect(html).toContain('<p class="pg-ai-p">Paragraph text.</p>');
    // Verify no stray newline characters between tags
    expect(html).not.toContain("\n");
  });

  it("parses Markdown tables with thead and tbody", () => {
    const md = [
      "| Feature | Status | Priority |",
      "| --- | --- | --- |",
      "| Authentication | Done | High |",
      "| Search | In Progress | Medium |",
    ].join("\n");

    const html = renderMarkdownToHtml(md);
    expect(html).toContain('<div class="pg-ai-table-wrap">');
    expect(html).toContain('<table class="pg-ai-table">');
    expect(html).toContain("<thead><tr><th><p>Feature</p></th><th><p>Status</p></th><th><p>Priority</p></th></tr></thead>");
    expect(html).toContain("<tbody><tr><td><p>Authentication</p></td><td><p>Done</p></td><td><p>High</p></td></tr>");
    expect(html).toContain("<tr><td><p>Search</p></td><td><p>In Progress</p></td><td><p>Medium</p></td></tr></tbody>");
  });

  it("parses task checklists into TipTap task items", () => {
    const md = "- [ ] Pending task\n- [x] Completed task";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain('<ul data-type="taskList" class="pg-ai-task-list">');
    expect(html).toContain('data-type="taskItem" data-checked="false"');
    expect(html).toContain("Pending task");
    expect(html).toContain('data-type="taskItem" data-checked="true"');
    expect(html).toContain("Completed task");
  });

  it("parses blockquotes and inline code formatting", () => {
    const md = "> Key quote here\nUse `pnpm dev` to launch.";
    const html = renderMarkdownToHtml(md);
    expect(html).toContain('<blockquote class="pg-ai-quote">Key quote here</blockquote>');
    expect(html).toContain('<code class="pg-ai-inline-code">pnpm dev</code>');
  });
});
