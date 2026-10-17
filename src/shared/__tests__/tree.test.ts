import { describe, expect, it } from "vitest";
import { buildPath, childrenOf, isDescendant } from "../tree";
import type { PageMeta } from "../types";

function page(id: string, parentId: string | null, rank: number): PageMeta {
  return {
    id,
    parentId,
    rank,
    title: id,
    icon: null,
    cover: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };
}

const pages: PageMeta[] = [
  page("a", null, 1024),
  page("b", null, 2048),
  page("a1", "a", 1024),
  page("a2", "a", 2048),
  page("a1x", "a1", 1024),
];

describe("isDescendant", () => {
  it("detects direct and deep descendants", () => {
    expect(isDescendant(pages, "a", "a1")).toBe(true);
    expect(isDescendant(pages, "a", "a1x")).toBe(true);
    expect(isDescendant(pages, "a1", "a1x")).toBe(true);
  });

  it("rejects unrelated and non-descendant pairs", () => {
    expect(isDescendant(pages, "b", "a1x")).toBe(false);
    expect(isDescendant(pages, "a1x", "a")).toBe(false);
    expect(isDescendant(pages, "a", "a")).toBe(false);
  });

  it("terminates safely on a corrupt parent cycle", () => {
    const corrupt: PageMeta[] = [page("x", "y", 1), page("y", "x", 2)];
    expect(isDescendant(corrupt, "x", "y")).toBe(true);
    expect(isDescendant(corrupt, "y", "x")).toBe(true);
  });
});

describe("buildPath", () => {
  it("returns root to page order", () => {
    expect(buildPath(pages, "a1x").map((p) => p.id)).toEqual(["a", "a1", "a1x"]);
    expect(buildPath(pages, "b").map((p) => p.id)).toEqual(["b"]);
  });

  it("returns empty for unknown ids", () => {
    expect(buildPath(pages, "nope")).toEqual([]);
  });
});

describe("childrenOf", () => {
  it("filters by parent and sorts by rank", () => {
    expect(childrenOf(pages, "a").map((p) => p.id)).toEqual(["a1", "a2"]);
    expect(childrenOf(pages, null).map((p) => p.id)).toEqual(["a", "b"]);
    expect(childrenOf(pages, "a1").map((p) => p.id)).toEqual(["a1x"]);
  });
});
