import { dialog, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { basename, extname, join } from "node:path";
import type { z } from "zod";
import {
  aiGenerateInputSchema,
  applyMetaInputSchema,
  appendUpdatesInputSchema,
  commentDeleteInputSchema,
  commentReplyInputSchema,
  commentResolveInputSchema,
  createCommentThreadInputSchema,
  createPageInputSchema,
  exportMarkdownInputSchema,
  getPageInputSchema,
  importImageInputSchema,
  loadUpdatesInputSchema,
  movePageInputSchema,
  renamePageInputSchema,
  searchInputSchema,
  setPageCoverInputSchema,
  setPageDbConfigInputSchema,
  setPageFavoriteInputSchema,
  setPageFieldInputSchema,
  setPageIconInputSchema,
  setPagePropertiesInputSchema,
  setPageViewInputSchema,
  updateDocInputSchema,
} from "../shared/schemas";
import type { AssetImportResult, PageMeta } from "../shared/types";
import { ollama } from "./ai/ollama";
import { logger } from "./logger";
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

const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif"]);
const MAX_ASSET_BYTES = 40_000_000;

function assetExtension(name: string): string {
  const ext = extname(name).toLowerCase();
  return ASSET_EXTENSIONS.has(ext) ? ext : ".png";
}

async function ensureAssetsDir(db: WorkspaceDb): Promise<string> {
  const dir = join(db.directory, "assets");
  await mkdir(dir, { recursive: true });
  return dir;
}

function parseBundle(raw: string): BundleShape {
  const parsed = JSON.parse(raw) as {
    version?: unknown;
    entries?: unknown;
    updates?: unknown;
  };
  if (parsed.version !== 1 || !Array.isArray(parsed.entries) || !Array.isArray(parsed.updates)) {
    throw new Error("Not a PageFlow sync bundle");
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

  ipcMain.handle("pg:pages:list", () => guarded(db, () => db.listPagesCached()));
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

  ipcMain.handle("pg:pages:set-favorite", (_event, raw: unknown) => {
    const { id, favorite } = parse(setPageFavoriteInputSchema, raw);
    return guarded(db, () => db.setPageFavorite(id, favorite));
  });

  ipcMain.handle("pg:pages:duplicate", (_event, raw: unknown) => {
    const { id } = parse(getPageInputSchema, raw);
    return guarded(db, () => db.duplicatePage(id));
  });

  ipcMain.handle("pg:pages:set-properties", (_event, raw: unknown) => {
    const { id, properties } = parse(setPagePropertiesInputSchema, raw);
    return guarded(db, () => db.setPageProperties(id, properties));
  });

  ipcMain.handle("pg:pages:set-db-config", (_event, raw: unknown) => {
    const { id, config } = parse(setPageDbConfigInputSchema, raw);
    return guarded(db, () => db.setPageDbConfig(id, config));
  });

  ipcMain.handle("pg:pages:set-field", (_event, raw: unknown) => {
    const { id, propId, value } = parse(setPageFieldInputSchema, raw);
    return guarded(db, () => db.setPageField(id, propId, value));
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
          favorite: entry.favorite === true,
          properties: entry.properties ?? [],
          fields: entry.fields ?? {},
        })),
      ),
    );
  });

  ipcMain.handle("pg:sync:export-bundle", async () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const result = await dialog.showSaveDialog({
      title: "Export sync bundle",
      defaultPath: join(db.directory, `pageflow-${stamp}.sync`),
      filters: [{ name: "PageFlow sync bundle", extensions: ["sync"] }],
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
      filters: [{ name: "PageFlow sync bundle", extensions: ["sync"] }],
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

  ipcMain.handle("pg:assets:pick-image", async (): Promise<AssetImportResult> => {
    const result = await dialog.showOpenDialog({
      title: "Choose an image",
      properties: ["openFile"],
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"],
        },
      ],
    });
    const filePath = result.filePaths[0];
    if (result.canceled || !filePath) {
      return { ok: false };
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile() || info.size === 0 || info.size > MAX_ASSET_BYTES) {
        return { ok: false, error: "Image must be between 1 byte and 40 MB" };
      }
      const assetsDir = await ensureAssetsDir(db);
      const fileName = `${randomUUID()}${assetExtension(filePath)}`;
      await copyFile(filePath, join(assetsDir, fileName));
      return {
        ok: true,
        src: `assets/${fileName}`,
        alt: basename(filePath, extname(filePath)).slice(0, 120),
      };
    } catch {
      return { ok: false, error: "Could not import the image" };
    }
  });

  ipcMain.handle("pg:assets:import-image", async (_event, raw: unknown): Promise<AssetImportResult> => {
    const { name, bytes } = parse(importImageInputSchema, raw);
    try {
      const assetsDir = await ensureAssetsDir(db);
      const fileName = `${randomUUID()}${assetExtension(name)}`;
      await writeFile(join(assetsDir, fileName), bytes);
      const alt = basename(name, extname(name)).slice(0, 120);
      return { ok: true, src: `assets/${fileName}`, alt };
    } catch {
      return { ok: false, error: "Could not save the image" };
    }
  });

  ipcMain.handle("pg:ai:status", async () => {
    return await ollama.getStatus();
  });

  ipcMain.handle("pg:ai:generate", async (event, raw: unknown) => {
    try {
      const input = parse(aiGenerateInputSchema, raw);
      return await ollama.generate(input, (chunk) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send("pg:ai:stream-chunk", chunk);
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("TimeoutError") ||
        msg.includes("aborted") ||
        msg.includes("timeout")
      ) {
        throw new Error(
          "The local AI model timed out. Ollama may still be loading model weights into memory. Please retry in a few moments.",
        );
      }
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("fetch failed") ||
        msg.includes("not running") ||
        msg.includes("ENOTFOUND")
      ) {
        throw new Error(
          "Local AI service (Ollama) is not running at http://127.0.0.1:11434. Please launch the Ollama desktop application or run 'ollama serve'.",
        );
      }
      throw new Error(msg);
    }
  });

  ipcMain.handle("pg:ai:stop", () => {
    ollama.stopGeneration();
  });

  ipcMain.handle("pg:app:open-logs", () => {
    logger.openLogFolder();
  });

  ipcMain.handle("pg:app:get-log-path", () => {
    return logger.getLogPath();
  });
}

