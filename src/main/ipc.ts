import { dialog, ipcMain } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { join } from "node:path";
import type { z } from "zod";
import {
  applyMetaInputSchema,
  appendUpdatesInputSchema,
  commentDeleteInputSchema,
  commentReplyInputSchema,
  commentResolveInputSchema,
  createCommentThreadInputSchema,
  createPageInputSchema,
  exportMarkdownInputSchema,
  getPageInputSchema,
  loadUpdatesInputSchema,
  movePageInputSchema,
  renamePageInputSchema,
  searchInputSchema,
  setPageCoverInputSchema,
  setPageIconInputSchema,
  setPageViewInputSchema,
  updateDocInputSchema,
} from "../shared/schemas";
import type { PageMeta } from "../shared/types";
import { startSession, stopSession } from "./session/server";
import type { WorkspaceDb } from "./workspace/db";

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

function guarded<T>(db: WorkspaceDb, operation: () => T): T | undefined {
  if (!db.isOpen()) {
    return undefined;
  }
  return operation();
}

function sanitizeFileName(title: string): string {
  const cleaned = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : "Untitled";
}

interface BundleShape {
  entries: PageMeta[];
  updates: { pageId: string; data: string }[];
}

function parseBundle(raw: string): BundleShape {
  const parsed = JSON.parse(raw) as {
    version?: unknown;
    entries?: unknown;
    updates?: unknown;
  };
  if (parsed.version !== 1 || !Array.isArray(parsed.entries) || !Array.isArray(parsed.updates)) {
    throw new Error("Not a Pagegrove sync bundle");
  }
  const entries = parsed.entries as PageMeta[];
  const updates: { pageId: string; data: string }[] = [];
  for (const item of parsed.updates) {
    const record = item as { pageId?: unknown; data?: unknown };
    if (typeof record.pageId === "string" && typeof record.data === "string") {
      updates.push({ pageId: record.pageId, data: record.data });
    }
  }
  return { entries, updates };
}

export function registerIpc(db: WorkspaceDb): void {
  ipcMain.handle("pg:workspace:info", () => ({ dir: db.directory, userName: userInfo().username }));

  ipcMain.handle("pg:pages:list", () => guarded(db, () => db.listPages()));
  ipcMain.handle("pg:pages:list-trash", () => guarded(db, () => db.listTrash()));

  ipcMain.handle("pg:pages:get", (_event, raw: unknown) => {
    const { id } = parse(getPageInputSchema, raw);
    return guarded(db, () => db.getPage(id)) ?? null;
  });

  ipcMain.handle("pg:pages:create", (_event, raw: unknown) => {
    const input = parse(createPageInputSchema, raw);
    return guarded(db, () => db.createPage(input));
  });

  ipcMain.handle("pg:pages:rename", (_event, raw: unknown) => {
    const { id, title } = parse(renamePageInputSchema, raw);
    return guarded(db, () => db.renamePage(id, title));
  });

  ipcMain.handle("pg:pages:update-doc", (_event, raw: unknown) => {
    const { id, doc } = parse(updateDocInputSchema, raw);
    return guarded(db, () => db.updateDoc(id, doc));
  });

  ipcMain.handle("pg:pages:move", (_event, raw: unknown) => {
    const input = parse(movePageInputSchema, raw);
    return guarded(db, () => db.movePage(input));
  });

  ipcMain.handle("pg:pages:set-icon", (_event, raw: unknown) => {
    const { id, icon } = parse(setPageIconInputSchema, raw);
    return guarded(db, () => db.setPageIcon(id, icon));
  });

  ipcMain.handle("pg:pages:set-cover", (_event, raw: unknown) => {
    const { id, cover } = parse(setPageCoverInputSchema, raw);
    return guarded(db, () => db.setPageCover(id, cover));
  });

  ipcMain.handle("pg:pages:set-view", (_event, raw: unknown) => {
    const { id, view } = parse(setPageViewInputSchema, raw);
    return guarded(db, () => db.setPageView(id, view));
  });

  ipcMain.handle("pg:pages:trash", (_event, raw: unknown) => {
    const { id } = parse(getPageInputSchema, raw);
    guarded(db, () => db.trashPage(id));
    return true;
  });

  ipcMain.handle("pg:pages:restore", (_event, raw: unknown) => {
    const { id } = parse(getPageInputSchema, raw);
    guarded(db, () => db.restorePage(id));
    return true;
  });

  ipcMain.handle("pg:pages:backlinks", (_event, raw: unknown) => {
    const { id } = parse(getPageInputSchema, raw);
    return guarded(db, () => db.listBacklinks(id)) ?? [];
  });

  ipcMain.handle("pg:comments:list", (_event, raw: unknown) => {
    const { id } = parse(getPageInputSchema, raw);
    return guarded(db, () => db.listCommentThreads(id)) ?? [];
  });

  ipcMain.handle("pg:comments:create", (_event, raw: unknown) => {
    const input = parse(createCommentThreadInputSchema, raw);
    return guarded(db, () => db.createCommentThread(input));
  });

  ipcMain.handle("pg:comments:reply", (_event, raw: unknown) => {
    const input = parse(commentReplyInputSchema, raw);
    return guarded(db, () => db.addCommentMessage(input));
  });

  ipcMain.handle("pg:comments:resolve", (_event, raw: unknown) => {
    const input = parse(commentResolveInputSchema, raw);
    return guarded(db, () => db.setCommentResolved(input));
  });

  ipcMain.handle("pg:comments:delete", (_event, raw: unknown) => {
    const input = parse(commentDeleteInputSchema, raw);
    return guarded(db, () => db.deleteCommentThread(input.threadId)) ?? false;
  });

  ipcMain.handle("pg:search:query", (_event, raw: unknown) => {
    const { query } = parse(searchInputSchema, raw);
    return guarded(db, () => db.search(query)) ?? [];
  });

  ipcMain.handle("pg:sync:load-updates", (_event, raw: unknown) => {
    const { pageId } = parse(loadUpdatesInputSchema, raw);
    return (guarded(db, () => db.loadDocUpdates(pageId)) ?? []).map((buffer) => Array.from(buffer));
  });

  ipcMain.handle("pg:sync:append-updates", (_event, raw: unknown) => {
    const { pageId, updates } = parse(appendUpdatesInputSchema, raw);
    guarded(db, () =>
      db.appendDocUpdates(
        pageId,
        updates.map((bytes) => Uint8Array.from(bytes)),
      ),
    );
  });

  ipcMain.handle("pg:sync:apply-meta", (_event, raw: unknown) => {
    const { entries } = parse(applyMetaInputSchema, raw);
    guarded(db, () =>
      db.upsertMetaEntries(
        entries.map((entry) => ({
          ...entry,
          icon: entry.icon ?? null,
          cover: entry.cover ?? null,
          view: entry.view ?? "doc",
        })),
      ),
    );
  });

  ipcMain.handle("pg:sync:export-bundle", async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog({
      title: "Export sync bundle",
      defaultPath: join(db.directory, `pagegrove-${stamp}.sync`),
      filters: [{ name: "Pagegrove sync bundle", extensions: ["sync"] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false };
    }
    const bundle = db.dumpCrdt();
    await writeFile(result.filePath, JSON.stringify(bundle), "utf8");
    return { ok: true, path: result.filePath };
  });

  ipcMain.handle("pg:sync:import-bundle", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import sync bundle",
      properties: ["openFile"],
      filters: [{ name: "Pagegrove sync bundle", extensions: ["sync"] }],
    });
    const filePath = result.filePaths[0];
    if (result.canceled || !filePath) {
      return { ok: false, applied: 0 };
    }
    const raw = await readFile(filePath, "utf8");
    const bundle = parseBundle(raw);
    const applied = db.applyCrdtBundle(bundle);
    return { ok: true, applied };
  });

  ipcMain.handle("pg:session:start", () => startSession());

  ipcMain.handle("pg:session:stop", async () => {
    await stopSession();
  });

  ipcMain.handle("pg:files:export-markdown", async (_event, raw: unknown) => {
    const { title, markdown } = parse(exportMarkdownInputSchema, raw);
    const result = await dialog.showSaveDialog({
      title: "Export page as Markdown",
      defaultPath: join(db.directory, `${sanitizeFileName(title)}.md`),
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (result.canceled || !result.filePath) {
      return { ok: false };
    }
    await writeFile(result.filePath, markdown, "utf8");
    return { ok: true, path: result.filePath };
  });
}
