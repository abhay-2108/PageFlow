export interface ShortcutBinding {
  id: string;
  label: string;
  defaultKeys: string;
  action: string;
}

const SHORTCUTS_KEY = "pageflow_shortcuts";

export const DEFAULT_SHORTCUTS: ShortcutBinding[] = [
  { id: "new-page", label: "New page", defaultKeys: "ctrl+n", action: "createPage" },
  { id: "command-palette", label: "Command palette", defaultKeys: "ctrl+k", action: "openPalette" },
  { id: "new-tab", label: "New tab", defaultKeys: "ctrl+t", action: "newTab" },
  { id: "close-tab", label: "Close tab", defaultKeys: "ctrl+w", action: "closeTab" },
  { id: "toggle-ai", label: "Toggle AI assistant", defaultKeys: "ctrl+shift+j", action: "toggleAi" },
  { id: "save", label: "Save page", defaultKeys: "ctrl+s", action: "save" },
  { id: "export-markdown", label: "Export Markdown", defaultKeys: "ctrl+shift+e", action: "export" },
  { id: "undo", label: "Undo", defaultKeys: "ctrl+z", action: "undo" },
  { id: "redo", label: "Redo", defaultKeys: "ctrl+shift+z", action: "redo" },
];

function getStored(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SHORTCUTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function store(bindings: Record<string, string>): void {
  localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(bindings));
}

export function getShortcut(id: string): string {
  const stored = getStored();
  return stored[id] ?? DEFAULT_SHORTCUTS.find((s) => s.id === id)?.defaultKeys ?? "";
}

export function setShortcut(id: string, keys: string): void {
  const stored = getStored();
  stored[id] = keys;
  store(stored);
}

export function getAllShortcuts(): ShortcutBinding[] {
  const stored = getStored();
  return DEFAULT_SHORTCUTS.map((s) => ({
    ...s,
    defaultKeys: stored[s.id] ?? s.defaultKeys,
  }));
}

export function resetShortcuts(): void {
  localStorage.removeItem(SHORTCUTS_KEY);
}

export function parseShortcut(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("ctrl");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  const key = event.key.toLowerCase();
  if (key !== "control" && key !== "meta" && key !== "alt" && key !== "shift") {
    parts.push(key);
  }
  return parts.join("+");
}
