import { describe, expect, it } from "vitest";
import { decodeJoinCode, encodeJoinCode } from "../join-code";
import { entriesEqual, metaDiff, sortEntriesByDepth } from "../meta";
import type { PageMeta } from "../types";

function meta(partial: Partial<PageMeta> & { id: string }): PageMeta {
  return {
    parentId: null,
    title: "",
    rank: 0,
    icon: null,
    cover: null,
    view: "doc",
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
    ...partial,
  };
}

describe("join codes", () => {
  const payload = {
    host: "192.168.1.24",
    port: 51234,
    room: "pg-AbCdEf123456",
    password: "s3cret-passphrase",
  };

  it("round-trips a payload", () => {
    const code = encodeJoinCode(payload);
    expect(code.startsWith("PG1.")).toBe(true);
    expect(decodeJoinCode(code)).toEqual(payload);
  });

  it("tolerates surrounding whitespace", () => {
    const code = `  ${encodeJoinCode(payload)}\n`;
    expect(decodeJoinCode(code)).toEqual(payload);
  });

  it("rejects malformed input", () => {
    expect(decodeJoinCode("")).toBeNull();
    expect(decodeJoinCode("PG2.abc")).toBeNull();
    expect(decodeJoinCode("PG1.not-base64!!")).toBeNull();
    expect(decodeJoinCode(`PG1.${btoa("not json")}`)).toBeNull();
  });

  it("rejects payloads with invalid fields", () => {
    const withInvalid = (patch: Record<string, unknown>): string => {
      const json = JSON.stringify({ h: payload.host, p: payload.port, r: payload.room, w: payload.password, ...patch });
      const bytes = new TextEncoder().encode(json);
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return `PG1.${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
    };
    expect(decodeJoinCode(withInvalid({ p: 0 }))).toBeNull();
    expect(decodeJoinCode(withInvalid({ p: 70000 }))).toBeNull();
    expect(decodeJoinCode(withInvalid({ h: "" }))).toBeNull();
    expect(decodeJoinCode(withInvalid({ w: "short" }))).toBeNull();
    expect(decodeJoinCode(withInvalid({ r: "" }))).toBeNull();
  });
});

describe("meta helpers", () => {
  it("detects equal entries", () => {
    expect(entriesEqual(meta({ id: "a" }), meta({ id: "a" }))).toBe(true);
    expect(entriesEqual(meta({ id: "a", title: "x" }), meta({ id: "a" }))).toBe(false);
  });

  it("treats icon and cover differences as changes", () => {
    expect(entriesEqual(meta({ id: "a", icon: "🌱" }), meta({ id: "a" }))).toBe(false);
    expect(entriesEqual(meta({ id: "a", cover: "sunrise" }), meta({ id: "a" }))).toBe(false);
    expect(entriesEqual(meta({ id: "a", icon: "🌱", cover: "sage" }), meta({ id: "a", icon: "🌱", cover: "sage" }))).toBe(
      true,
    );
    const current = new Map<string, PageMeta>([["a", meta({ id: "a", icon: "🌱" })]]);
    expect(metaDiff(current, [meta({ id: "a", icon: "🔥" })])).toHaveLength(1);
  });

  it("treats a view change as a change", () => {
    expect(entriesEqual(meta({ id: "a", view: "table" }), meta({ id: "a" }))).toBe(false);
    const current = new Map<string, PageMeta>([["a", meta({ id: "a" })]]);
    expect(metaDiff(current, [meta({ id: "a", view: "table" })])).toHaveLength(1);
  });

  it("diffs against a current map", () => {
    const current = new Map<string, PageMeta>([
      ["a", meta({ id: "a", title: "same" })],
      ["b", meta({ id: "b", title: "old" })],
    ]);
    const next = [
      meta({ id: "a", title: "same" }),
      meta({ id: "b", title: "new" }),
      meta({ id: "c", title: "fresh" }),
    ];
    const changed = metaDiff(current, next);
    expect(changed.map((entry) => entry.id).sort()).toEqual(["b", "c"]);
  });

  it("sorts entries parents-first", () => {
    const sorted = sortEntriesByDepth([
      meta({ id: "grandchild", parentId: "child" }),
      meta({ id: "root" }),
      meta({ id: "child", parentId: "root" }),
    ]);
    expect(sorted.map((entry) => entry.id)).toEqual(["root", "child", "grandchild"]);
  });

  it("does not hang on parent cycles", () => {
    const sorted = sortEntriesByDepth([
      meta({ id: "a", parentId: "b" }),
      meta({ id: "b", parentId: "a" }),
    ]);
    expect(sorted).toHaveLength(2);
  });
});
