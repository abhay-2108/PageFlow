import { contextBridge, ipcRenderer } from "electron";
import type { PagegroveApi } from "../shared/api";
import type { PropertyDef, PropertyValue } from "../shared/database";
import type { DatabaseConfig } from "../shared/database-view";
import type {
  AssetImportResult,
  BacklinkHit,
  CommentReplyInput,
  CommentResolveInput,
  CommentThread,
  MovePageInput,
  NewCommentThreadInput,
  NewPageInput,
  PageMeta,
  PageRecord,
  PageViewMode,
  SearchHit,
  TipTapDocument,
} from "../shared/types";

const api: PagegroveApi = {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  app: {
    openLogs: () => ipcRenderer.invoke("pg:app:open-logs") as Promise<void>,
    getLogPath: () => ipcRenderer.invoke("pg:app:get-log-path") as Promise<string>,
  },
  workspace: {
    info: () => ipcRenderer.invoke("pg:workspace:info") as Promise<{ dir: string; userName: string }>,
  },
  pages: {
    list: () => ipcRenderer.invoke("pg:pages:list") as Promise<PageMeta[]>,
    listTrash: () => ipcRenderer.invoke("pg:pages:list-trash") as Promise<PageMeta[]>,
    get: (id: string) => ipcRenderer.invoke("pg:pages:get", { id }) as Promise<PageRecord | null>,
    create: (input: NewPageInput) => ipcRenderer.invoke("pg:pages:create", input) as Promise<PageMeta>,
    rename: (id: string, title: string) =>
      ipcRenderer.invoke("pg:pages:rename", { id, title }) as Promise<PageMeta>,
    updateDoc: (id: string, doc: TipTapDocument) =>
      ipcRenderer.invoke("pg:pages:update-doc", { id, doc }) as Promise<PageMeta>,
    move: (input: MovePageInput) => ipcRenderer.invoke("pg:pages:move", input) as Promise<PageMeta>,
    setIcon: (id: string, icon: string | null) =>
      ipcRenderer.invoke("pg:pages:set-icon", { id, icon }) as Promise<PageMeta>,
    setCover: (id: string, cover: string | null) =>
      ipcRenderer.invoke("pg:pages:set-cover", { id, cover }) as Promise<PageMeta>,
    setView: (id: string, view: PageViewMode) =>
      ipcRenderer.invoke("pg:pages:set-view", { id, view }) as Promise<PageMeta>,
    setFavorite: (id: string, favorite: boolean) =>
      ipcRenderer.invoke("pg:pages:set-favorite", { id, favorite }) as Promise<PageMeta>,
    duplicate: (id: string) =>
      ipcRenderer.invoke("pg:pages:duplicate", { id }) as Promise<PageMeta>,
    setProperties: (id: string, properties: PropertyDef[]) =>
      ipcRenderer.invoke("pg:pages:set-properties", { id, properties }) as Promise<PageMeta>,
    setDbConfig: (id: string, config: DatabaseConfig) =>
      ipcRenderer.invoke("pg:pages:set-db-config", { id, config }) as Promise<PageMeta>,
    setField: (id: string, propId: string, value: PropertyValue) =>
      ipcRenderer.invoke("pg:pages:set-field", { id, propId, value }) as Promise<PageMeta>,
    trash: (id: string) => ipcRenderer.invoke("pg:pages:trash", { id }) as Promise<boolean>,
    restore: (id: string) => ipcRenderer.invoke("pg:pages:restore", { id }) as Promise<boolean>,
    backlinks: (id: string) => ipcRenderer.invoke("pg:pages:backlinks", { id }) as Promise<BacklinkHit[]>,
  },
  search: {
    query: (query: string) => ipcRenderer.invoke("pg:search:query", { query }) as Promise<SearchHit[]>,
  },
  comments: {
    list: (pageId: string) =>
      ipcRenderer.invoke("pg:comments:list", { id: pageId }) as Promise<CommentThread[]>,
    create: (input: NewCommentThreadInput) =>
      ipcRenderer.invoke("pg:comments:create", input) as Promise<CommentThread>,
    reply: (input: CommentReplyInput) =>
      ipcRenderer.invoke("pg:comments:reply", input) as Promise<CommentThread>,
    resolve: (input: CommentResolveInput) =>
      ipcRenderer.invoke("pg:comments:resolve", input) as Promise<CommentThread>,
    remove: (threadId: string) =>
      ipcRenderer.invoke("pg:comments:delete", { threadId }) as Promise<boolean>,
  },
  sync: {
    loadDocUpdates: (pageId: string) =>
      ipcRenderer.invoke("pg:sync:load-updates", { pageId }) as Promise<number[][]>,
    appendDocUpdates: (pageId: string, updates: number[][]) =>
      ipcRenderer.invoke("pg:sync:append-updates", { pageId, updates }) as Promise<void>,
    applyMeta: (entries: PageMeta[]) =>
      ipcRenderer.invoke("pg:sync:apply-meta", { entries }) as Promise<void>,
    exportBundle: () =>
      ipcRenderer.invoke("pg:sync:export-bundle") as Promise<{ ok: boolean; path?: string }>,
    importBundle: () =>
      ipcRenderer.invoke("pg:sync:import-bundle") as Promise<{ ok: boolean; applied: number }>,
  },
  session: {
    start: () => ipcRenderer.invoke("pg:session:start") as Promise<{ port: number; code: string }>,
    stop: () => ipcRenderer.invoke("pg:session:stop") as Promise<void>,
  },
  files: {
    exportMarkdown: (title: string, markdown: string) =>
      ipcRenderer.invoke("pg:files:export-markdown", { title, markdown }) as Promise<{
        ok: boolean;
        path?: string;
      }>,
  },
  assets: {
    pickImage: () => ipcRenderer.invoke("pg:assets:pick-image") as Promise<AssetImportResult>,
    importImage: (input: { name: string; bytes: Uint8Array }) =>
      ipcRenderer.invoke("pg:assets:import-image", input) as Promise<AssetImportResult>,
  },
  ai: {
    status: () => ipcRenderer.invoke("pg:ai:status"),
    generate: (input) => ipcRenderer.invoke("pg:ai:generate", input),
    stop: () => ipcRenderer.invoke("pg:ai:stop"),
    onStream: (listener) => {
      const handler = (_event: unknown, chunk: unknown) => listener(chunk as never);
      ipcRenderer.on("pg:ai:stream-chunk", handler);
      return () => {
        ipcRenderer.off("pg:ai:stream-chunk", handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld("pagegrove", api);

