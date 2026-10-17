export interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TipTapNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: TipTapMark[];
  content?: TipTapNode[];
}

export interface TipTapDocument {
  type: "doc";
  content?: TipTapNode[];
}

export interface PageMeta {
  id: string;
  parentId: string | null;
  title: string;
  rank: number;
  icon: string | null;
  cover: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface PageRecord {
  meta: PageMeta;
  doc: TipTapDocument;
}

export interface SearchHit {
  id: string;
  title: string;
  snippet: string;
  path: string[];
}

export interface NewPageInput {
  parentId: string | null;
  title?: string;
}

export interface MovePageInput {
  id: string;
  parentId: string | null;
  beforeId: string | null;
}

export const EMPTY_DOC: TipTapDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};
