import { describe, expect, it } from "vitest";
import { evaluateFormula, parseFormula, validateFormula } from "../formula";
import type { PropertyDef } from "../database";
import type { PageMeta } from "../types";

describe("formula parsing", () => {
  it("parses numbers, strings, and booleans", () => {
    expect(parseFormula("42")).toEqual({ kind: "num", value: 42 });
    expect(parseFormula('"hello"')).toEqual({ kind: "str", value: "hello" });
    expect(parseFormula("true")).toEqual({ kind: "bool", value: true });
    expect(parseFormula("false")).toEqual({ kind: "bool", value: false });
  });

  it("parses arithmetic expressions with correct precedence", () => {
    const ast = parseFormula("1 + 2 * 3");
    expect(ast).toEqual({
      kind: "binary",
      op: "+",
      left: { kind: "num", value: 1 },
      right: {
        kind: "binary",
        op: "*",
        left: { kind: "num", value: 2 },
        right: { kind: "num", value: 3 },
      },
    });
  });

  it("parses function calls with arguments", () => {
    const ast = parseFormula('concat("a", "b", "c")');
    expect(ast).toEqual({
      kind: "call",
      name: "concat",
      args: [
        { kind: "str", value: "a" },
        { kind: "str", value: "b" },
        { kind: "str", value: "c" },
      ],
    });
  });

  it("validates formula syntax correctly", () => {
    expect(validateFormula("1 + 2")).toBeNull();
    expect(validateFormula('if(prop("A") > 10, "High", "Low")')).toBeNull();
    expect(validateFormula("1 +")).not.toBeNull();
    expect(validateFormula('"unterminated')).not.toBeNull();
    expect(validateFormula("")).not.toBeNull();
  });
});

describe("formula evaluation", () => {
  const properties: PropertyDef[] = [
    { id: "p_price", name: "Price", type: "number", options: [] },
    { id: "p_qty", name: "Quantity", type: "number", options: [] },
    { id: "p_tag", name: "Tag", type: "text", options: [] },
    { id: "p_done", name: "Done", type: "checkbox", options: [] },
    { id: "p_multi", name: "Tags", type: "multi_select", options: ["A", "B", "C"] },
  ];

  const row: PageMeta = {
    id: "r1",
    parentId: null,
    title: "Product 1",
    rank: 0,
    icon: null,
    cover: null,
    view: "doc",
    favorite: false,
    properties: [],
    fields: {
      p_price: 25,
      p_qty: 4,
      p_tag: "Gadget",
      p_done: true,
      p_multi: ["electronics", "sale"],
    },
    createdAt: 1700000000000,
    updatedAt: 1700000005000,
    deletedAt: null,
  };

  it("evaluates basic arithmetic", () => {
    expect(evaluateFormula("10 + 20", row, properties)).toBe(30);
    expect(evaluateFormula("100 / 4 - 5", row, properties)).toBe(20);
    expect(evaluateFormula("17 % 5", row, properties)).toBe(2);
  });

  it("resolves property values with prop()", () => {
    expect(evaluateFormula('prop("Price") * prop("Quantity")', row, properties)).toBe(100);
    expect(evaluateFormula('prop("Name")', row, properties)).toBe("Product 1");
  });

  it("evaluates conditional if() expressions", () => {
    expect(
      evaluateFormula('if(prop("Price") > 20, "Expensive", "Cheap")', row, properties),
    ).toBe("Expensive");
    expect(
      evaluateFormula('if(prop("Quantity") < 2, "Low", "OK")', row, properties),
    ).toBe("OK");
  });

  it("evaluates string functions", () => {
    expect(evaluateFormula('upper(prop("Tag"))', row, properties)).toBe("GADGET");
    expect(evaluateFormula('lower(prop("Tag"))', row, properties)).toBe("gadget");
    expect(evaluateFormula('len(prop("Tag"))', row, properties)).toBe(6);
    expect(evaluateFormula('concat(prop("Tag"), ": ", prop("Name"))', row, properties)).toBe(
      "Gadget: Product 1",
    );
  });

  it("evaluates math and aggregate functions", () => {
    expect(evaluateFormula("sum(1, 2, 3, 4)", row, properties)).toBe(10);
    expect(evaluateFormula("avg(10, 20, 30)", row, properties)).toBe(20);
    expect(evaluateFormula("min(5, 3, 8, 1)", row, properties)).toBe(1);
    expect(evaluateFormula("max(5, 3, 8, 1)", row, properties)).toBe(8);
    expect(evaluateFormula("round(3.14159, 2)", row, properties)).toBe(3.14);
  });

  it("evaluates boolean logic and comparisons", () => {
    expect(evaluateFormula("true and false", row, properties)).toBe(false);
    expect(evaluateFormula("true or false", row, properties)).toBe(true);
    expect(evaluateFormula("not false", row, properties)).toBe(true);
    expect(evaluateFormula('prop("Done") == true', row, properties)).toBe(true);
  });
});
