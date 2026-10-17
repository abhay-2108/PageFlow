import { describe, expect, it } from "vitest";
import {
  normalizeValue,
  parseFields,
  parseProperties,
  valueToText,
} from "../database";

describe("properties parsing", () => {
  it("parses valid property definitions", () => {
    const defs = parseProperties(
      JSON.stringify([{ id: "p1", name: "Status", type: "select", options: ["Todo", "Done"] }]),
    );
    expect(defs).toEqual([{ id: "p1", name: "Status", type: "select", options: ["Todo", "Done"] }]);
  });

  it("drops invalid entries and recovers from broken JSON", () => {
    expect(parseProperties("not json")).toEqual([]);
    expect(parseProperties(JSON.stringify({ id: "p1" }))).toEqual([]);
    expect(
      parseProperties(
        JSON.stringify([
          { id: "p1", name: "Ok", type: "text", options: [] },
          { id: "p2", name: "Bad", type: "color", options: [] },
          { id: "", name: "No id", type: "text", options: [] },
        ]),
      ),
    ).toEqual([{ id: "p1", name: "Ok", type: "text", options: [] }]);
  });

  it("parses fields and falls back to an empty map", () => {
    expect(parseFields('{"a":1,"b":"x"}')).toEqual({ a: 1, b: "x" });
    expect(parseFields("[1,2]")).toEqual({});
    expect(parseFields("broken")).toEqual({});
  });
});

describe("value normalization", () => {
  it("normalizes text values", () => {
    expect(normalizeValue("text", "  hello ")).toBe("hello");
    expect(normalizeValue("text", "   ")).toBeNull();
    expect(normalizeValue("text", 12)).toBeNull();
  });

  it("normalizes numbers", () => {
    expect(normalizeValue("number", 4.5)).toBe(4.5);
    expect(normalizeValue("number", "42")).toBe(42);
    expect(normalizeValue("number", "abc")).toBeNull();
    expect(normalizeValue("number", Number.NaN)).toBeNull();
  });

  it("normalizes checkbox values", () => {
    expect(normalizeValue("checkbox", true)).toBe(true);
    expect(normalizeValue("checkbox", "yes")).toBe(false);
  });

  it("normalizes select and multi-select values", () => {
    expect(normalizeValue("select", " Todo ")).toBe("Todo");
    expect(normalizeValue("select", "")).toBeNull();
    expect(normalizeValue("multi_select", ["a", 2, "b"])).toEqual(["a", "b"]);
    expect(normalizeValue("multi_select", "a")).toEqual([]);
  });

  it("normalizes dates", () => {
    expect(normalizeValue("date", "2026-10-18")).toBe("2026-10-18");
    expect(normalizeValue("date", "18/10/2026")).toBeNull();
  });

  it("renders values to text", () => {
    expect(valueToText("text", "hi")).toBe("hi");
    expect(valueToText("number", 3)).toBe("3");
    expect(valueToText("checkbox", true)).toBe("Yes");
    expect(valueToText("checkbox", false)).toBe("");
    expect(valueToText("multi_select", ["a", "b"])).toBe("a, b");
    expect(valueToText("select", null)).toBe("");
  });
});
