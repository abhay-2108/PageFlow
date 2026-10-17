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

export type PageViewMode = "doc" | "table";

export interface PageMeta {
  id: string;
  parentId: string | null;
  title: string;
  rank: number;
  icon: string | null;
  cover: string | null;
  view: PageViewMode;
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

export interface BacklinkHit {
  id: string;
  title: string;
  path: string[];
}

export interface CommentMessage {
  id: string;
  threadId: string;
  author: string;
  body: string;
  createdAt: number;
}

export interface CommentThread {
  id: string;
  pageId: string;
  quote: string;
  resolved: boolean;
  createdAt: number;
  updatedAt: number;
  messages: CommentMessage[];
}

export interface NewCommentThreadInput {
  pageId: string;
  quote: string;
  body: string;
  author: string;
}

export interface CommentReplyInput {
  threadId: string;
  body: string;
  author: string;
}

export interface CommentResolveInput {
  threadId: string;
  resolved: boolean;
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
