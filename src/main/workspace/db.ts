import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import Database from "better-sqlite3";
import { extractDocText } from "../../shared/doc-text";
import { sortEntriesByDepth } from "../../shared/meta";
import { needsRebalance, rankAppend, rankBetween, rebalancedRanks } from "../../shared/rank";
import { isDescendant } from "../../shared/tree";
import type {
  BacklinkHit,
  MovePageInput,
  NewPageInput,
  PageMeta,
  PageRecord,
  SearchHit,
  TipTapDocument,
} from "../../shared/types";
import { EMPTY_DOC } from "../../shared/types";
import { writeSnapshot } from "./snapshot";

interface PageRow {
  rowid: number;
  id: string;
  parent_id: string | null;
  title: string;
  rank: number;
  icon: string | null;
  cover: string | null;
  doc: string;
  text: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
}

const SNAPSHOT_DEBOUNCE_MS = 1500;

const SELECT_COLUMNS =
  "rowid, id, parent_id, title, rank, icon, cover, doc, text, created_at, updated_at, deleted_at";

function toMeta(row: PageRow): PageMeta {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    rank: row.rank,
    icon: row.icon,
    cover: row.cover,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class WorkspaceDb {
  readonly directory: string;
  private readonly db: Database.Database;
  private readonly snapshotTimers = new Map<string, NodeJS.Timeout>();
  private closed = false;

  constructor(directory: string) {
    this.directory = directory;
    mkdirSync(join(directory, "pages"), { recursive: true });
    this.db = new Database(join(directory, "workspace.db"));
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = FULL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate(): void {
    const version = this.db.pragma("user_version", { simple: true }) as number;
    if (version < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS pages (
          id TEXT PRIMARY KEY,
          parent_id TEXT REFERENCES pages(id) ON DELETE CASCADE,
          title TEXT NOT NULL DEFAULT '',
          rank REAL NOT NULL,
          doc TEXT NOT NULL,
          text TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_pages_parent_rank ON pages(parent_id, rank);
        CREATE INDEX IF NOT EXISTS idx_pages_deleted ON pages(deleted_at);
        CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
          title,
          text,
          content='pages',
          content_rowid='rowid'
        );
      `);
      this.db.pragma("user_version = 1");
    }
    if (version < 2) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS yupdates (
          seq INTEGER PRIMARY KEY AUTOINCREMENT,
          page_id TEXT NOT NULL,
          bytes BLOB NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_yupdates_page ON yupdates(page_id, seq);
      `);
      this.db.pragma("user_version = 2");
    }
    if (version < 3) {
      this.db.exec(`
        ALTER TABLE pages ADD COLUMN icon TEXT;
        ALTER TABLE pages ADD COLUMN cover TEXT;
      `);
      this.db.pragma("user_version = 3");
    }
  }

  private rowById(id: string): PageRow | undefined {
    return this.db.prepare(`SELECT ${SELECT_COLUMNS} FROM pages WHERE id = ?`).get(id) as
      | PageRow
      | undefined;
  }

  private metaById(id: string): PageMeta {
    const row = this.rowById(id);
    if (!row) {
      throw new Error(`Page not found: ${id}`);
    }
    return toMeta(row);
  }

  private allRows(includeTrashed: boolean): PageRow[] {
    const where = includeTrashed ? "" : "WHERE deleted_at IS NULL";
    return this.db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM pages ${where} ORDER BY rank ASC, created_at ASC`)
      .all() as PageRow[];
  }

  private childRows(parentId: string | null): PageRow[] {
    return this.db
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM pages WHERE parent_id IS ? AND deleted_at IS NULL ORDER BY rank ASC`,
      )
      .all(parentId) as PageRow[];
  }

  private subtreeIds(id: string): string[] {
    const rows = this.db
      .prepare(
        `WITH RECURSIVE sub(id) AS (
           SELECT id FROM pages WHERE id = ?
           UNION ALL
           SELECT p.id FROM pages p JOIN sub ON p.parent_id = sub.id
         )
         SELECT id FROM sub`,
      )
      .all(id) as { id: string }[];
    return rows.map((row) => row.id);
  }

  private ftsRemove(row: PageRow): void {
    this.db
      .prepare("INSERT INTO pages_fts (pages_fts, rowid, title, text) VALUES ('delete', ?, ?, ?)")
      .run(row.rowid, row.title, row.text);
  }

  private ftsInsert(rowid: number, title: string, text: string): void {
    this.db
      .prepare("INSERT INTO pages_fts (rowid, title, text) VALUES (?, ?, ?)")
      .run(rowid, title, text);
  }

  listPages(): PageMeta[] {
    return this.allRows(false).map(toMeta);
  }

  listTrash(): PageMeta[] {
    return this.db
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM pages WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
      )
      .all()
      .map((row) => toMeta(row as PageRow));
  }

  getPage(id: string): PageRecord | null {
    const row = this.rowById(id);
    if (!row || row.deleted_at !== null) {
      return null;
    }
    let doc: TipTapDocument;
    try {
      doc = JSON.parse(row.doc) as TipTapDocument;
    } catch {
      doc = EMPTY_DOC;
    }
    return { meta: toMeta(row), doc };
  }

  createPage(input: NewPageInput): PageMeta {
    return this.db.transaction(() => {
      if (input.parentId !== null) {
        const parent = this.rowById(input.parentId);
        if (!parent || parent.deleted_at !== null) {
          throw new Error("Parent page not found");
        }
      }
      const last = this.db
        .prepare(
          "SELECT MAX(rank) AS maxRank FROM pages WHERE parent_id IS ? AND deleted_at IS NULL",
        )
        .get(input.parentId) as { maxRank: number | null };
      const id = randomUUID();
      const now = Date.now();
      const rank = rankAppend(last.maxRank);
      const doc = JSON.stringify(EMPTY_DOC);
      this.db
        .prepare(
          `INSERT INTO pages (id, parent_id, title, rank, doc, text, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, '', ?, ?)`,
        )
        .run(id, input.parentId, input.title ?? "", rank, doc, now, now);
      const row = this.rowById(id) as PageRow;
      this.ftsInsert(row.rowid, row.title, row.text);
      this.scheduleSnapshot(id);
      return toMeta(row);
    })();
  }

  renamePage(id: string, title: string): PageMeta {
    return this.db.transaction(() => {
      const row = this.rowById(id);
      if (!row || row.deleted_at !== null) {
        throw new Error("Page not found");
      }
      const now = Date.now();
      this.ftsRemove(row);
      this.db
        .prepare("UPDATE pages SET title = ?, updated_at = ? WHERE id = ?")
        .run(title, now, id);
      this.ftsInsert(row.rowid, title, row.text);
      this.scheduleSnapshot(id);
      return toMeta({ ...row, title, updated_at: now });
    })();
  }

  updateDoc(id: string, doc: TipTapDocument): PageMeta {
    return this.db.transaction(() => {
      const row = this.rowById(id);
      if (!row || row.deleted_at !== null) {
        throw new Error("Page not found");
      }
      const now = Date.now();
      const text = extractDocText(doc);
      const serialized = JSON.stringify(doc);
      this.ftsRemove(row);
      this.db
        .prepare("UPDATE pages SET doc = ?, text = ?, updated_at = ? WHERE id = ?")
        .run(serialized, text, now, id);
      this.ftsInsert(row.rowid, row.title, text);
      this.scheduleSnapshot(id);
      return toMeta({ ...row, doc: serialized, text, updated_at: now });
    })();
  }

  movePage(input: MovePageInput): PageMeta {
    return this.db.transaction(() => {
      const row = this.rowById(input.id);
      if (!row || row.deleted_at !== null) {
        throw new Error("Page not found");
      }
      if (input.parentId !== null) {
        const parent = this.rowById(input.parentId);
        if (!parent || parent.deleted_at !== null) {
          throw new Error("Target parent not found");
        }
        if (input.parentId === input.id) {
          throw new Error("Cannot nest a page inside itself");
        }
        const metas = this.listPages();
        if (isDescendant(metas, input.id, input.parentId)) {
          throw new Error("Cannot move a page into its own subtree");
        }
      }

      const siblings = this.childRows(input.parentId).filter((sibling) => sibling.id !== input.id);
      let index = siblings.length;
      if (input.beforeId !== null) {
        const found = siblings.findIndex((sibling) => sibling.id === input.beforeId);
        if (found < 0) {
          throw new Error("Sibling anchor not found");
        }
        index = found;
      }

      let ranks = siblings.map((sibling) => sibling.rank);
      if (needsRebalance(ranks)) {
        const fresh = rebalancedRanks(ranks.length);
        const update = this.db.prepare("UPDATE pages SET rank = ? WHERE id = ?");
        siblings.forEach((sibling, position) => {
          update.run(fresh[position] as number, sibling.id);
        });
        ranks = fresh;
      }

      const prev = index > 0 ? (ranks[index - 1] as number) : null;
      const next = index < ranks.length ? (ranks[index] as number) : null;
      const rank = rankBetween(prev, next);
      const now = Date.now();
      this.db
        .prepare("UPDATE pages SET parent_id = ?, rank = ?, updated_at = ? WHERE id = ?")
        .run(input.parentId, rank, now, input.id);
      this.scheduleSnapshot(input.id);
      return this.metaById(input.id);
    })();
  }

  setPageIcon(id: string, icon: string | null): PageMeta {
    return this.db.transaction(() => {
      const row = this.rowById(id);
      if (!row || row.deleted_at !== null) {
        throw new Error("Page not found");
      }
      const now = Date.now();
      this.db.prepare("UPDATE pages SET icon = ?, updated_at = ? WHERE id = ?").run(icon, now, id);
      this.scheduleSnapshot(id);
      return this.metaById(id);
    })();
  }

  setPageCover(id: string, cover: string | null): PageMeta {
    return this.db.transaction(() => {
      const row = this.rowById(id);
      if (!row || row.deleted_at !== null) {
        throw new Error("Page not found");
      }
      const now = Date.now();
      this.db.prepare("UPDATE pages SET cover = ?, updated_at = ? WHERE id = ?").run(cover, now, id);
      this.scheduleSnapshot(id);
      return this.metaById(id);
    })();
  }

  trashPage(id: string): void {
    this.db.transaction(() => {
      const row = this.rowById(id);
      if (!row || row.deleted_at !== null) {
        throw new Error("Page not found");
      }
      const ids = this.subtreeIds(id);
      const now = Date.now();
      const update = this.db.prepare("UPDATE pages SET deleted_at = ? WHERE id = ?");
      for (const childId of ids) {
        update.run(now, childId);
      }
    })();
  }

  restorePage(id: string): void {
    this.db.transaction(() => {
      const row = this.rowById(id);
      if (!row || row.deleted_at === null) {
        throw new Error("Page is not in trash");
      }
      const ids = this.subtreeIds(id);
      const update = this.db.prepare("UPDATE pages SET deleted_at = NULL WHERE id = ?");
      for (const childId of ids) {
        update.run(childId);
      }
      this.scheduleSnapshot(id);
    })();
  }

  search(query: string): SearchHit[] {
    const tokens = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 0)
      .slice(0, 8);
    if (tokens.length === 0) {
      return [];
    }
    const match = tokens.map((token) => `"${token.replace(/"/g, "")}"*`).join(" ");
    const rows = this.db
      .prepare(
        `SELECT p.id AS id, p.title AS title,
                snippet(pages_fts, 1, '[', ']', ' … ', 14) AS snip
         FROM pages_fts
         JOIN pages p ON p.rowid = pages_fts.rowid
         WHERE pages_fts MATCH ? AND p.deleted_at IS NULL
         LIMIT 30`,
      )
      .all(match) as { id: string; title: string; snip: string }[];

    const metas = this.listPages();
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      snippet: row.snip.trim(),
      path: this.pathTitles(metas, row.id),
    }));
  }

  listBacklinks(targetId: string): BacklinkHit[] {
    const rows = this.db
      .prepare(
        `SELECT id, title FROM pages
         WHERE deleted_at IS NULL AND id != ? AND doc LIKE ?
         ORDER BY updated_at DESC
         LIMIT 50`,
      )
      .all(targetId, `%"pageId":"${targetId}"%`) as { id: string; title: string }[];
    if (rows.length === 0) {
      return [];
    }
    const metas = this.listPages();
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      path: this.pathTitles(metas, row.id),
    }));
  }

  private pathTitles(metas: PageMeta[], id: string): string[] {
    const byId = new Map(metas.map((meta) => [meta.id, meta]));
    const titles: string[] = [];
    const visited = new Set<string>();
    let current = byId.get(id);
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      titles.unshift(current.title.length > 0 ? current.title : "Untitled");
      current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
    return titles;
  }

  loadDocUpdates(pageId: string): Buffer[] {
    const rows = this.db
      .prepare("SELECT bytes FROM yupdates WHERE page_id = ? ORDER BY seq ASC")
      .all(pageId) as { bytes: Buffer }[];
    return rows.map((row) => row.bytes);
  }

  appendDocUpdates(pageId: string, updates: Uint8Array[]): void {
    const insert = this.db.prepare("INSERT INTO yupdates (page_id, bytes) VALUES (?, ?)");
    this.db.transaction(() => {
      for (const update of updates) {
        if (update.length > 0) {
          insert.run(pageId, Buffer.from(update));
        }
      }
    })();
  }

  upsertMetaEntries(entries: PageMeta[]): number {
    if (entries.length === 0) {
      return 0;
    }
    const ordered = sortEntriesByDepth(entries);
    const insertRow = this.db.prepare(
      `INSERT INTO pages (id, parent_id, title, rank, icon, cover, doc, text, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)`,
    );
    const updateRow = this.db.prepare(
      `UPDATE pages SET parent_id = ?, title = ?, rank = ?, icon = ?, cover = ?, created_at = ?, updated_at = ?, deleted_at = ?
       WHERE id = ?`,
    );
    let applied = 0;
    this.db.transaction(() => {
      this.db.pragma("defer_foreign_keys = ON");
      for (const entry of ordered) {
        const icon = entry.icon ?? null;
        const cover = entry.cover ?? null;
        const row = this.rowById(entry.id);
        if (!row) {
          try {
            insertRow.run(
              entry.id,
              entry.parentId,
              entry.title,
              entry.rank,
              icon,
              cover,
              JSON.stringify(EMPTY_DOC),
              entry.createdAt,
              entry.updatedAt,
              entry.deletedAt,
            );
          } catch {
            continue;
          }
          const inserted = this.rowById(entry.id) as PageRow;
          this.ftsInsert(inserted.rowid, inserted.title, inserted.text);
          applied += 1;
        } else {
          this.ftsRemove(row);
          updateRow.run(
            entry.parentId,
            entry.title,
            entry.rank,
            icon,
            cover,
            entry.createdAt,
            entry.updatedAt,
            entry.deletedAt,
            entry.id,
          );
          this.ftsInsert(row.rowid, entry.title, row.text);
          applied += 1;
        }
        if (entry.deletedAt === null) {
          this.scheduleSnapshot(entry.id);
        }
      }
    })();
    return applied;
  }

  dumpCrdt(): {
    version: 1;
    exportedAt: number;
    entries: PageMeta[];
    updates: { pageId: string; data: string }[];
  } {
    const entries = [...this.listPages(), ...this.listTrash()];
    const rows = this.db
      .prepare("SELECT seq, page_id, bytes FROM yupdates ORDER BY seq ASC")
      .all() as { seq: number; page_id: string; bytes: Buffer }[];
    return {
      version: 1,
      exportedAt: Date.now(),
      entries,
      updates: rows.map((row) => ({
        pageId: row.page_id,
        data: row.bytes.toString("base64"),
      })),
    };
  }

  applyCrdtBundle(bundle: {
    entries: PageMeta[];
    updates: { pageId: string; data: string }[];
  }): number {
    const appliedEntries = this.upsertMetaEntries(bundle.entries);
    const byPage = new Map<string, Uint8Array[]>();
    for (const record of bundle.updates) {
      const bytes = Buffer.from(record.data, "base64");
      if (bytes.length === 0) {
        continue;
      }
      const bucket = byPage.get(record.pageId) ?? [];
      bucket.push(bytes);
      byPage.set(record.pageId, bucket);
    }
    for (const [pageId, updates] of byPage) {
      this.appendDocUpdates(pageId, updates);
    }
    return appliedEntries;
  }

  private scheduleSnapshot(id: string): void {
    const existing = this.snapshotTimers.get(id);
    if (existing) {
      clearTimeout(existing);
    }
    this.snapshotTimers.set(
      id,
      setTimeout(() => {
        this.snapshotTimers.delete(id);
        this.writeSnapshotNow(id);
      }, SNAPSHOT_DEBOUNCE_MS),
    );
  }

  private writeSnapshotNow(id: string): void {
    if (this.closed) {
      return;
    }
    const record = this.getPage(id);
    if (!record) {
      return;
    }
    writeSnapshot(this.directory, {
      version: 1,
      savedAt: Date.now(),
      meta: record.meta,
      doc: record.doc,
    });
  }

  flushSnapshots(): void {
    for (const [id, timer] of this.snapshotTimers) {
      clearTimeout(timer);
      this.snapshotTimers.delete(id);
      try {
        this.writeSnapshotNow(id);
      } catch {
        // Snapshot files are a portability mirror, never the source of truth.
      }
    }
  }

  isOpen(): boolean {
    return !this.closed;
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.flushSnapshots();
    this.closed = true;
    try {
      this.db.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      // Best effort; WAL replays on next open regardless.
    }
    this.db.close();
  }
}
