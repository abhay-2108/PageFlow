import { describe, expect, it } from "vitest";
import {
  applyDatabaseView,
  defaultDatabaseConfig,
  parseDatabaseConfig,
} from "../database-view";
import type { PropertyDef } from "../database";
import type { PageMeta } from "../types";

const properties: PropertyDef[] = [
  { id: "name", name: "Name", type: "text", options: [] },
  { id: "count", name: "Count", type: "number", options: [] },
  { id: "status", name: "Status", type: "select", options: ["Todo", "Done"] },
  { id: "done", name: "Done", type: "checkbox", options: [] },
];

function meta(id: string, fields: PageMeta["fields"]): PageMeta {
  return {
    id,
    parentId: null,
    title: id,
    rank: 0,
    icon: null,
    cover: null,
    view: "table",
    favorite: false,
    properties: [],
    fields,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };
}

const rows = [
  meta("a", { name: "Alpha", count: 3, status: "Todo", done: false }),
  meta("b", { name: "Bravo", count: 1, status: "Done", done: true }),
  meta("c", { name: "Charlie", count: null, status: null, done: false }),
];

function view(
  sorts: { propId: string; dir: "asc" | "desc" }[] = [],
  filters: { propId: string; op: "is" | "is_not" | "contains" | "not_contains" | "is_empty" | "is_not_empty"; value: string }[] = [],
) {
  return { id: "v", name: "V", sorts, filters };
}

describe("database config parsing", () => {
  it("parses a full config", () => {
    const config = parseDatabaseConfig(
      JSON.stringify({
        views: [
          {
            id: "v1",
            name: "Table",
            sorts: [{ propId: "count", dir: "desc" }],
            filters: [{ propId: "status", op: "is", value: "Todo" }],
          },
        ],
        activeViewId: "v1",
      }),
    );
    expect(config).toEqual({
      views: [
        {
          id: "v1",
          name: "Table",
          sorts: [{ propId: "count", dir: "desc" }],
          filters: [{ propId: "status", op: "is", value: "Todo" }],
        },
      ],
      activeViewId: "v1",
    });
  });

  it("falls back to the first view when activeViewId is unknown", () => {
    const config = parseDatabaseConfig(
      JSON.stringify({ views: [{ id: "a", name: "A", sorts: [], filters: [] }], activeViewId: "zzz" }),
    );
    expect(config?.activeViewId).toBe("a");
  });

  it("returns undefined for invalid or empty configs", () => {
    expect(parseDatabaseConfig(null)).toBeUndefined();
    expect(parseDatabaseConfig("nope")).toBeUndefined();
    expect(parseDatabaseConfig(JSON.stringify({ views: [] }))).toBeUndefined();
    expect(
      parseDatabaseConfig(
        JSON.stringify({
          views: [{ id: "a", name: "A", sorts: [{ propId: "x", dir: "up" }], filters: [] }],
        }),
      ),
    ).toBeUndefined();
  });

  it("provides a default single-view config", () => {
    expect(defaultDatabaseConfig()).toEqual({
      views: [{ id: "default", name: "Table", sorts: [], filters: [] }],
      activeViewId: "default",
    });
  });
});

describe("database view application", () => {
  it("sorts numbers ascending and descending", () => {
    const asc = applyDatabaseView(rows, properties, view([{ propId: "count", dir: "asc" }]));
    expect(asc.map((row) => row.id)).toEqual(["b", "a", "c"]);
    const desc = applyDatabaseView(rows, properties, view([{ propId: "count", dir: "desc" }]));
    expect(desc.map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps empty values last regardless of direction", () => {
    const desc = applyDatabaseView(rows, properties, view([{ propId: "count", dir: "desc" }]));
    expect(desc.at(-1)?.id).toBe("c");
  });

  it("applies multiple sorts in order", () => {
    const sorted = applyDatabaseView(
      rows,
      properties,
      view([
        { propId: "done", dir: "asc" },
        { propId: "name", dir: "asc" },
      ]),
    );
    expect(sorted.map((row) => row.id)).toEqual(["a", "c", "b"]);
  });

  it("filters by is and is_not", () => {
    const isTodo = applyDatabaseView(rows, properties, view([], [{ propId: "status", op: "is", value: "Todo" }]));
    expect(isTodo.map((row) => row.id)).toEqual(["a"]);
    const notDone = applyDatabaseView(
      rows,
      properties,
      view([], [{ propId: "status", op: "is_not", value: "Done" }]),
    );
    expect(notDone.map((row) => row.id)).toEqual(["a", "c"]);
  });

  it("filters by contains and emptiness", () => {
    const contains = applyDatabaseView(
      rows,
      properties,
      view([], [{ propId: "name", op: "contains", value: "ravo" }]),
    );
    expect(contains.map((row) => row.id)).toEqual(["b"]);
    const empty = applyDatabaseView(
      rows,
      properties,
      view([], [{ propId: "status", op: "is_empty", value: "" }]),
    );
    expect(empty.map((row) => row.id)).toEqual(["c"]);
  });

  it("combines filters and sorts", () => {
    const result = applyDatabaseView(
      rows,
      properties,
      view([{ propId: "count", dir: "asc" }], [{ propId: "done", op: "is", value: "Yes" }]),
    );
    expect(result.map((row) => row.id)).toEqual(["b"]);
  });
});
