import type { CoverId } from "./covers";
import type {
  MovePageInput,
  NewPageInput,
  PageMeta,
  PageRecord,
  SearchHit,
  TipTapDocument,
} from "./types";

export interface PagegroveApi {
  readonly platform: string;
  readonly versions: {
    readonly electron: string;
    readonly chrome: string;
    readonly node: string;
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
    setCover(id: string, cover: CoverId | null): Promise<PageMeta>;
    trash(id: string): Promise<boolean>;
    restore(id: string): Promise<boolean>;
  };
  readonly search: {
    query(query: string): Promise<SearchHit[]>;
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
}
