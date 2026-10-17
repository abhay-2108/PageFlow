import type { PageMeta } from "./types";

export function entriesEqual(a: PageMeta, b: PageMeta): boolean {
  return (
    a.title === b.title &&
    a.parentId === b.parentId &&
    a.rank === b.rank &&
    (a.icon ?? null) === (b.icon ?? null) &&
    (a.cover ?? null) === (b.cover ?? null) &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt &&
    a.deletedAt === b.deletedAt
  );
}

export function metaDiff(current: ReadonlyMap<string, PageMeta>, next: PageMeta[]): PageMeta[] {
  return next.filter((entry) => {
    const existing = current.get(entry.id);
    return existing === undefined || !entriesEqual(existing, entry);
  });
}

export function sortEntriesByDepth(entries: PageMeta[]): PageMeta[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const depth = (entry: PageMeta): number => {
    let hops = 0;
    let current = entry.parentId;
    const visited = new Set<string>([entry.id]);
    while (current !== null && !visited.has(current)) {
      const parent = byId.get(current);
      if (!parent) {
        break;
      }
      visited.add(parent.id);
      hops += 1;
      current = parent.parentId;
      if (hops > 64) {
        break;
      }
    }
    return hops;
  };
  return [...entries].sort((a, b) => depth(a) - depth(b));
}
