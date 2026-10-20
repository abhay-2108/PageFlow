import { describe, expect, it } from "vitest";
import {
  coerceValue,
  evaluateRollup,
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

  it("parses select option colors when present", () => {
    const defs = parseProperties(
      JSON.stringify([
        {
          id: "p1",
          name: "Status",
          type: "select",
          options: ["Todo", "Done"],
          optionColors: { Todo: "red" },
        },
      ]),
    );
    expect(defs).toEqual([
      {
        id: "p1",
        name: "Status",
        type: "select",
        options: ["Todo", "Done"],
        optionColors: { Todo: "red" },
      },
    ]);
  });

  it("drops property definitions with unknown option colors", () => {
    expect(
      parseProperties(
        JSON.stringify([
          { id: "p1", name: "Status", type: "select", options: ["Todo"], optionColors: { Todo: "chartreuse" } },
        ]),
      ),
    ).toEqual([]);
  });

  it("parses formula and status properties with groups", () => {
    const defs = parseProperties(
      JSON.stringify([
        { id: "f1", name: "Total", type: "formula", options: [], formula: 'prop("Price") * 2' },
        {
          id: "s1",
          name: "Status",
          type: "status",
          options: ["Todo", "Done"],
          statusGroups: { Todo: "todo", Done: "complete" },
        },
      ]),
    );
    expect(defs).toEqual([
      { id: "f1", name: "Total", type: "formula", options: [], formula: 'prop("Price") * 2' },
      {
        id: "s1",
        name: "Status",
        type: "status",
        options: ["Todo", "Done"],
        statusGroups: { Todo: "todo", Done: "complete" },
      },
    ]);
  });
});

describe("value coercion on type change", () => {
  it("returns the value unchanged for the same type", () => {
    expect(coerceValue("number", "number", 5)).toBe(5);
  });

  it("coerces text to number and back", () => {
    expect(coerceValue("text", "number", "42")).toBe(42);
    expect(coerceValue("number", "text", 7)).toBe("7");
    expect(coerceValue("select", "number", "abc")).toBeNull();
  });

  it("coerces select, multi-select, and text", () => {
    expect(coerceValue("select", "text", "Todo")).toBe("Todo");
    expect(coerceValue("text", "multi_select", "a")).toEqual(["a"]);
    expect(coerceValue("multi_select", "text", ["a", "b"])).toBe("a, b");
  });

  it("coerces checkbox and date", () => {
    expect(coerceValue("text", "checkbox", "Yes")).toBe(false);
    expect(coerceValue("checkbox", "text", true)).toBe("Yes");
    expect(coerceValue("date", "text", "2026-10-18")).toBe("2026-10-18");
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
    expect(valueToText("url", "https://notion.so")).toBe("https://notion.so");
    expect(valueToText("email", "user@notion.so")).toBe("user@notion.so");
    expect(valueToText("status", "In progress")).toBe("In progress");
  });

  it("normalizes rich property types", () => {
    expect(normalizeValue("url", "  https://example.com  ")).toBe("https://example.com");
    expect(normalizeValue("email", " test@example.com ")).toBe("test@example.com");
    expect(normalizeValue("phone", " +1-555-0199 ")).toBe("+1-555-0199");
    expect(normalizeValue("status", " Done ")).toBe("Done");
    expect(normalizeValue("ai_summary", "  Executive summary  ")).toBe("Executive summary");
    expect(normalizeValue("ai_autofill", "  Tag 1, Tag 2  ")).toBe("Tag 1, Tag 2");
    expect(normalizeValue("formula", "1+1")).toBeNull();
  });
});

describe("rollup evaluation", () => {
  const properties = [
    { id: "rel1", name: "Tasks", type: "relation" as const, options: [] },
    {
      id: "roll_count",
      name: "Task Count",
      type: "rollup" as const,
      options: [],
      relationPropId: "rel1",
      rollupPropId: "price",
      rollupOp: "count" as const,
    },
    {
      id: "roll_sum",
      name: "Total Cost",
      type: "rollup" as const,
      options: [],
      relationPropId: "rel1",
      rollupPropId: "price",
      rollupOp: "sum" as const,
    },
    {
      id: "roll_avg",
      name: "Avg Cost",
      type: "rollup" as const,
      options: [],
      relationPropId: "rel1",
      rollupPropId: "price",
      rollupOp: "avg" as const,
    },
    {
      id: "roll_orig",
      name: "All Names",
      type: "rollup" as const,
      options: [],
      relationPropId: "rel1",
      rollupPropId: "title",
      rollupOp: "show_original" as const,
    },
  ];

  const allPages = [
    { id: "t1", fields: { price: 10, title: "Design" } },
    { id: "t2", fields: { price: 20, title: "Code" } },
    { id: "t3", fields: { price: 30, title: "Ship" } },
  ];

  const parentPage = {
    fields: {
      rel1: ["t1", "t2", "t3"],
    },
  };

  it("calculates count correctly", () => {
    const rollDef = properties.find((p) => p.id === "roll_count")!;
    expect(evaluateRollup(rollDef, parentPage, properties, allPages)).toBe(3);
  });

  it("calculates sum correctly", () => {
    const rollDef = properties.find((p) => p.id === "roll_sum")!;
    expect(evaluateRollup(rollDef, parentPage, properties, allPages)).toBe(60);
  });

  it("calculates avg correctly", () => {
    const rollDef = properties.find((p) => p.id === "roll_avg")!;
    expect(evaluateRollup(rollDef, parentPage, properties, allPages)).toBe(20);
  });

  it("shows original values correctly", () => {
    const rollDef = properties.find((p) => p.id === "roll_orig")!;
    expect(evaluateRollup(rollDef, parentPage, properties, allPages)).toBe("Design, Code, Ship");
  });

  it("returns null when relation has no targets or no target property", () => {
    const rollDef = properties.find((p) => p.id === "roll_sum")!;
    expect(evaluateRollup(rollDef, { fields: { rel1: [] } }, properties, allPages)).toBe(null);
  });
});
