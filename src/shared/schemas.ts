import { z } from "zod";
import { COVER_IDS } from "./covers";
import type { TipTapNode } from "./types";

const markSchema = z.object({
  type: z.string(),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

export const tipTapNodeSchema: z.ZodType<TipTapNode> = z.lazy(() =>
  z.object({
    type: z.string().optional(),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z.array(markSchema).optional(),
    content: z.array(tipTapNodeSchema).optional(),
  }),
);

export const tipTapDocumentSchema = z.object({
  type: z.literal("doc"),
  content: z.array(tipTapNodeSchema).optional(),
});

export const pageIdSchema = z.uuid();

export const createPageInputSchema = z.object({
  parentId: pageIdSchema.nullable(),
  title: z.string().max(500).optional(),
});

export const getPageInputSchema = z.object({
  id: pageIdSchema,
});

export const renamePageInputSchema = z.object({
  id: pageIdSchema,
  title: z.string().max(500),
});

export const updateDocInputSchema = z.object({
  id: pageIdSchema,
  doc: tipTapDocumentSchema,
});

export const movePageInputSchema = z.object({
  id: pageIdSchema,
  parentId: pageIdSchema.nullable(),
  beforeId: pageIdSchema.nullable(),
});

export const pageIconSchema = z.string().min(1).max(16).nullable();

export const pageCoverSchema = z.union([
  z.enum(COVER_IDS),
  z.string().regex(/^assets\/[A-Za-z0-9][A-Za-z0-9._-]*$/),
]).nullable();

export const setPageIconInputSchema = z.object({
  id: pageIdSchema,
  icon: pageIconSchema,
});

export const setPageCoverInputSchema = z.object({
  id: pageIdSchema,
  cover: pageCoverSchema,
});

export const pageViewSchema = z.enum(["doc", "table"]);

export const setPageViewInputSchema = z.object({
  id: pageIdSchema,
  view: pageViewSchema,
});

export const searchInputSchema = z.object({
  query: z.string().max(200),
});

export const syncDocIdSchema = z.union([pageIdSchema, z.literal("__meta__")]);

export const loadUpdatesInputSchema = z.object({
  pageId: syncDocIdSchema,
});

export const appendUpdatesInputSchema = z.object({
  pageId: syncDocIdSchema,
  updates: z
    .array(z.array(z.number().int().min(0).max(255)).max(1_000_000))
    .max(100),
});

export const metaEntrySchema = z.object({
  id: pageIdSchema,
  parentId: pageIdSchema.nullable(),
  title: z.string().max(500),
  rank: z.number(),
  icon: pageIconSchema.optional(),
  cover: pageCoverSchema.optional(),
  view: pageViewSchema.optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable(),
});

export const applyMetaInputSchema = z.object({
  entries: z.array(metaEntrySchema).max(2000),
});

export const commentThreadIdSchema = z.uuid();

export const createCommentThreadInputSchema = z.object({
  pageId: pageIdSchema,
  quote: z.string().max(500),
  body: z.string().min(1).max(5000),
  author: z.string().min(1).max(100),
});

export const commentReplyInputSchema = z.object({
  threadId: commentThreadIdSchema,
  body: z.string().min(1).max(5000),
  author: z.string().min(1).max(100),
});

export const commentResolveInputSchema = z.object({
  threadId: commentThreadIdSchema,
  resolved: z.boolean(),
});

export const commentDeleteInputSchema = z.object({
  threadId: commentThreadIdSchema,
});

export const exportMarkdownInputSchema = z.object({
  title: z.string().max(200),
  markdown: z.string().max(5_000_000),
});

export const importImageInputSchema = z.object({
  name: z.string().max(200),
  bytes: z.instanceof(Uint8Array).refine((bytes) => bytes.byteLength > 0 && bytes.byteLength <= 40_000_000, {
    message: "Image must be between 1 byte and 40 MB",
  }),
});
