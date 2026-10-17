export const BRAND = {
  name: "Pagegrove",
  tagline: "Local-first notes. Your workspace is a folder you own.",
  empty: {
    editorPlaceholder: "Press / for blocks, or just start writing. Autosaves locally.",
    workspace: "No pages yet. Create your first page — everything stays on this machine.",
    workspaceAction: "Create a page",
    trash: "Nothing here. Deleted pages rest in Trash until you say otherwise.",
    untitled: "Untitled",
  },
} as const;

export function searchNoResults(query: string): string {
  return `No results for "${query}". Try another word or create a page.`;
}
