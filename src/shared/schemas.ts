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

export const pageCoverSchema = z.enum(COVER_IDS).nullable();

export const setPageIconInputSchema = z.object({
  id: pageIdSchema,
  icon: pageIconSchema,
});

export const setPageCoverInputSchema = z.object({
  id: pageIdSchema,
  cover: pageCoverSchema,
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
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable(),
});

export const applyMetaInputSchema = z.object({
  entries: z.array(metaEntrySchema).max(2000),
});

export const exportMarkdownInputSchema = z.object({
  title: z.string().max(200),
  markdown: z.string().max(5_000_000),
});
