import { describe, expect, it } from "vitest";
import { importHtml, importMarkdown } from "../lib/import";

describe("importHtml", () => {
  it("converts h1 to heading", () => {
    const result = importHtml("<h1>Title</h1>");
    expect(result.type).toBe("doc");
    expect(result.content?.[0]?.type).toBe("heading");
  });

  it("converts p to paragraph", () => {
    const result = importHtml("<p>Hello world</p>");
    expect(result.content?.[0]?.type).toBe("paragraph");
  });

  it("converts ul/li to bulletList", () => {
    const result = importHtml("<ul><li>One</li><li>Two</li></ul>");
    expect(result.content?.[0]?.type).toBe("bulletList");
  });

  it("converts ol/li to orderedList", () => {
    const result = importHtml("<ol><li>First</li><li>Second</li></ol>");
    expect(result.content?.[0]?.type).toBe("orderedList");
  });

  it("converts blockquote", () => {
    const result = importHtml("<blockquote>Quoted</blockquote>");
    expect(result.content?.[0]?.type).toBe("blockquote");
  });

  it("converts hr to horizontalRule", () => {
    const result = importHtml("<hr>");
    expect(result.content?.[0]?.type).toBe("horizontalRule");
  });

  it("converts strong to bold mark", () => {
    const result = importHtml("<p><strong>Bold</strong></p>");
    const para = result.content?.[0] as { content?: Array<{ marks?: Array<{ type: string }> }> };
    expect(para?.content?.[0]?.marks?.[0]?.type).toBe("bold");
  });

  it("converts em to italic mark", () => {
    const result = importHtml("<p><em>Italic</em></p>");
    const para = result.content?.[0] as { content?: Array<{ marks?: Array<{ type: string }> }> };
    expect(para?.content?.[0]?.marks?.[0]?.type).toBe("italic");
  });

  it("converts pre to codeBlock", () => {
    const result = importHtml("<pre>code here</pre>");
    expect(result.content?.[0]?.type).toBe("codeBlock");
  });

  it("returns empty doc for empty input", () => {
    const result = importHtml("");
    expect(result.type).toBe("doc");
    expect(result.content?.length).toBe(0);
  });
});

describe("importMarkdown", () => {
  it("converts # heading", () => {
    const result = importMarkdown("# Title");
    expect(result.content?.[0]?.type).toBe("heading");
  });

  it("converts ## heading", () => {
    const result = importMarkdown("## Subtitle");
    expect(result.content?.[0]?.type).toBe("heading");
  });

  it("converts - item to bulletList", () => {
    const result = importMarkdown("- Item one\n- Item two");
    expect(result.content?.[0]?.type).toBe("bulletList");
  });

  it("converts 1. item to orderedList", () => {
    const result = importMarkdown("1. First\n2. Second");
    expect(result.content?.[0]?.type).toBe("orderedList");
  });

  it("converts > to blockquote", () => {
    const result = importMarkdown("> Quoted text");
    expect(result.content?.[0]?.type).toBe("blockquote");
  });

  it("converts --- to horizontalRule", () => {
    const result = importMarkdown("---");
    expect(result.content?.[0]?.type).toBe("horizontalRule");
  });

  it("converts **bold** to bold mark", () => {
    const result = importMarkdown("**bold text**");
    const para = result.content?.[0] as { content?: Array<{ marks?: Array<{ type: string }> }> };
    expect(para?.content?.[0]?.marks?.[0]?.type).toBe("bold");
  });

  it("converts *italic* to italic mark", () => {
    const result = importMarkdown("*italic text*");
    const para = result.content?.[0] as { content?: Array<{ marks?: Array<{ type: string }> }> };
    expect(para?.content?.[0]?.marks?.[0]?.type).toBe("italic");
  });

  it("returns empty doc for empty string", () => {
    const result = importMarkdown("");
    expect(result.type).toBe("doc");
    expect(result.content?.length).toBe(0);
  });
});
