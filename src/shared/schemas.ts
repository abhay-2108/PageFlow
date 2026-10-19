import { z } from "zod";
import { COVER_IDS } from "./covers";
import { SELECT_COLORS } from "./database";
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

export const propertyTypeSchema = z.enum([
  "text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
]);

export const selectColorSchema = z.enum(SELECT_COLORS);

export const propertyDefSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(200),
  type: propertyTypeSchema,
  options: z.array(z.string().max(200)).max(200),
  optionColors: z.record(z.string(), selectColorSchema).optional(),
});

export const databaseSortSchema = z.object({
  propId: z.string().min(1).max(64),
  dir: z.enum(["asc", "desc"]),
});

export const databaseFilterSchema = z.object({
  propId: z.string().min(1).max(64),
  op: z.enum(["is", "is_not", "contains", "not_contains", "is_empty", "is_not_empty"]),
  value: z.string().max(2000),
});

export const databaseViewSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(200),
  sorts: z.array(databaseSortSchema).max(20),
  filters: z.array(databaseFilterSchema).max(20),
});

export const databaseConfigSchema = z.object({
  views: z.array(databaseViewSchema).min(1).max(20),
  activeViewId: z.string().min(1).max(64),
});

export const setPageDbConfigInputSchema = z.object({
  id: pageIdSchema,
  config: databaseConfigSchema,
});

export const propertyValueSchema = z.union([
  z.string().max(2000),
  z.number(),
  z.boolean(),
  z.array(z.string().max(200)).max(200),
  z.null(),
]);

export const setPagePropertiesInputSchema = z.object({
  id: pageIdSchema,
  properties: z.array(propertyDefSchema).max(50),
});

export const setPageFieldInputSchema = z.object({
  id: pageIdSchema,
  propId: z.string().min(1).max(64),
  value: propertyValueSchema,
});

export const setPageFavoriteInputSchema = z.object({
  id: pageIdSchema,
  favorite: z.boolean(),
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
  favorite: z.boolean().optional(),
  properties: z.array(propertyDefSchema).max(50).optional(),
  fields: z.record(z.string(), propertyValueSchema).optional(),
  dbConfig: databaseConfigSchema.optional(),
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

export const aiGenerateInputSchema = z.object({
  prompt: z.string().max(100_000),
  action: z
    .enum([
      "continue",
      "summarize",
      "improve",
      "shorter",
      "longer",
      "action_items",
      "brainstorm",
      "explain",
      "custom",
    ])
    .optional(),
  context: z.string().max(500_000).optional(),
  pageTitle: z.string().max(1000).optional(),
  model: z.string().max(200).optional(),
  systemPrompt: z.string().max(10_000).optional(),
});

