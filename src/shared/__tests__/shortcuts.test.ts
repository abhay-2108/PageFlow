import { describe, expect, it, beforeEach } from "vitest";
import {
  getShortcut,
  setShortcut,
  getAllShortcuts,
  resetShortcuts,
  parseShortcut,
  DEFAULT_SHORTCUTS,
} from "../shortcuts";

describe("shortcuts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default shortcut for known id", () => {
    expect(getShortcut("new-page")).toBe("ctrl+n");
  });

  it("returns empty string for unknown id", () => {
    expect(getShortcut("nonexistent")).toBe("");
  });

  it("persists custom shortcut", () => {
    setShortcut("new-page", "ctrl+shift+n");
    expect(getShortcut("new-page")).toBe("ctrl+shift+n");
  });

  it("lists all shortcuts with defaults", () => {
    const all = getAllShortcuts();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty("id");
    expect(all[0]).toHaveProperty("label");
    expect(all[0]).toHaveProperty("defaultKeys");
  });

  it("reset clears custom shortcuts", () => {
    setShortcut("new-page", "ctrl+shift+n");
    resetShortcuts();
    expect(getShortcut("new-page")).toBe("ctrl+n");
  });

  it("parses KeyboardEvent into shortcut string", () => {
    const event = new KeyboardEvent("keydown", { key: "n", ctrlKey: true });
    expect(parseShortcut(event)).toBe("ctrl+n");
  });

  it("parses shift modifier", () => {
    const event = new KeyboardEvent("keydown", { key: "j", ctrlKey: true, shiftKey: true });
    expect(parseShortcut(event)).toBe("ctrl+shift+j");
  });

  it("excludes modifier keys from shortcut string", () => {
    const event = new KeyboardEvent("keydown", { key: "Control", ctrlKey: true });
    expect(parseShortcut(event)).toBe("ctrl");
  });

  it("has unique action ids", () => {
    const actions = DEFAULT_SHORTCUTS.map((s) => s.action);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it("has unique shortcut ids", () => {
    const ids = DEFAULT_SHORTCUTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
