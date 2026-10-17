import { z } from "zod";
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

export const searchInputSchema = z.object({
  query: z.string().max(200),
});
