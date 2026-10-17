import type { PageMeta } from "./types";

export function isDescendant(pages: readonly PageMeta[], ancestorId: string, candidateId: string): boolean {
  const byId = new Map(pages.map((page) => [page.id, page]));
  let current = byId.get(candidateId);
  const visited = new Set<string>();

  while (current && current.parentId !== null) {
    if (visited.has(current.id)) {
      return false;
    }
    visited.add(current.id);
    if (current.parentId === ancestorId) {
      return true;
    }
    current = byId.get(current.parentId);
  }

  return false;
}

export function buildPath(pages: readonly PageMeta[], id: string): PageMeta[] {
  const byId = new Map(pages.map((page) => [page.id, page]));
  const path: PageMeta[] = [];
  const visited = new Set<string>();
  let current = byId.get(id);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift(current);
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }

  return path;
}

export function childrenOf(pages: readonly PageMeta[], parentId: string | null): PageMeta[] {
  return pages
    .filter((page) => page.parentId === parentId)
    .sort((a, b) => a.rank - b.rank);
}
