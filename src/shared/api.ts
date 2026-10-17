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
    info(): Promise<{ dir: string }>;
  };
  readonly pages: {
    list(): Promise<PageMeta[]>;
    listTrash(): Promise<PageMeta[]>;
    get(id: string): Promise<PageRecord | null>;
    create(input: NewPageInput): Promise<PageMeta>;
    rename(id: string, title: string): Promise<PageMeta>;
    updateDoc(id: string, doc: TipTapDocument): Promise<PageMeta>;
    move(input: MovePageInput): Promise<PageMeta>;
    trash(id: string): Promise<boolean>;
    restore(id: string): Promise<boolean>;
  };
  readonly search: {
    query(query: string): Promise<SearchHit[]>;
  };
}
