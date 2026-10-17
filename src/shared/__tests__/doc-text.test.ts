import { describe, expect, it } from "vitest";
import { extractDocText } from "../doc-text";

describe("extractDocText", () => {
  it("extracts and separates block text", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello " }, { type: "text", text: "world" }],
        },
      ],
    };
    expect(extractDocText(doc)).toBe("Title\nHello world");
  });

  it("walks nested lists and toggles", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "toggle",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Summary" }] },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "child" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractDocText(doc)).toBe("Summary\nchild");
  });

  it("survives malformed input", () => {
    expect(extractDocText(null)).toBe("");
    expect(extractDocText("not a doc")).toBe("");
    expect(extractDocText({ type: "doc", content: [42, { text: 7 }, { text: "ok" }] })).toBe("ok");
  });

  it("caps runaway text", () => {
    const long = "x".repeat(500_000);
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: long }] }] };
    expect(extractDocText(doc).length).toBeLessThanOrEqual(200_000);
  });

  it("collapses excess blank lines", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph" },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", text: "after" }] },
      ],
    };
    expect(extractDocText(doc)).toBe("after");
  });
});
