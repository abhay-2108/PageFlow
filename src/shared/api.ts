import type { PropertyDef, PropertyValue } from "./database";
import type { DatabaseConfig } from "./database-view";
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
} from "./types";

import type {
  AiGenerateInput,
  AiGenerateResult,
  AiStatus,
  AiStreamChunk,
} from "./ai";

export interface PagegroveApi {
  readonly platform: string;
  readonly versions: {
    readonly electron: string;
    readonly chrome: string;
    readonly node: string;
  };
  readonly app: {
    openLogs(): Promise<void>;
    getLogPath(): Promise<string>;
  };
  readonly workspace: {
    info(): Promise<{ dir: string; userName: string }>;
  };
  readonly pages: {
    list(): Promise<PageMeta[]>;
    listTrash(): Promise<PageMeta[]>;
    get(id: string): Promise<PageRecord | null>;
    create(input: NewPageInput): Promise<PageMeta>;
    rename(id: string, title: string): Promise<PageMeta>;
    updateDoc(id: string, doc: TipTapDocument): Promise<PageMeta>;
    move(input: MovePageInput): Promise<PageMeta>;
    setIcon(id: string, icon: string | null): Promise<PageMeta>;
    setCover(id: string, cover: string | null): Promise<PageMeta>;
    setView(id: string, view: PageViewMode): Promise<PageMeta>;
    setFavorite(id: string, favorite: boolean): Promise<PageMeta>;
    duplicate(id: string): Promise<PageMeta>;
    setProperties(id: string, properties: PropertyDef[]): Promise<PageMeta>;
    setDbConfig(id: string, config: DatabaseConfig): Promise<PageMeta>;
    setField(id: string, propId: string, value: PropertyValue): Promise<PageMeta>;
    trash(id: string): Promise<boolean>;
    restore(id: string): Promise<boolean>;
    backlinks(id: string): Promise<BacklinkHit[]>;
  };
  readonly search: {
    query(query: string): Promise<SearchHit[]>;
  };
  readonly comments: {
    list(pageId: string): Promise<CommentThread[]>;
    create(input: NewCommentThreadInput): Promise<CommentThread>;
    reply(input: CommentReplyInput): Promise<CommentThread>;
    resolve(input: CommentResolveInput): Promise<CommentThread>;
    remove(threadId: string): Promise<boolean>;
  };
  readonly sync: {
    loadDocUpdates(pageId: string): Promise<number[][]>;
    appendDocUpdates(pageId: string, updates: number[][]): Promise<void>;
    applyMeta(entries: PageMeta[]): Promise<void>;
    exportBundle(): Promise<{ ok: boolean; path?: string }>;
    importBundle(): Promise<{ ok: boolean; applied: number }>;
  };
  readonly session: {
    start(): Promise<{ port: number; code: string }>;
    stop(): Promise<void>;
  };
  readonly files: {
    exportMarkdown(title: string, markdown: string): Promise<{ ok: boolean; path?: string }>;
  };
  readonly assets: {
    pickImage(): Promise<AssetImportResult>;
    importImage(input: { name: string; bytes: Uint8Array }): Promise<AssetImportResult>;
  };
  readonly ai: {
    status(): Promise<AiStatus>;
    generate(input: AiGenerateInput): Promise<AiGenerateResult>;
    stop(): Promise<void>;
    onStream(listener: (data: AiStreamChunk) => void): () => void;
  };
}
