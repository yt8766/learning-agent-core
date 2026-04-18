import { z } from 'zod';

export const KnowledgeSourceTypeSchema = z.enum([
  'workspace-docs',
  'repo-docs',
  'connector-manifest',
  'catalog-sync',
  'user-upload',
  'web-curated'
]);

export const KnowledgeTrustClassSchema = z.enum(['official', 'curated', 'community', 'unverified', 'internal']);

export const KnowledgeSourceSchema = z.object({
  id: z.string(),
  sourceType: KnowledgeSourceTypeSchema,
  uri: z.string(),
  title: z.string(),
  trustClass: KnowledgeTrustClassSchema,
  version: z.string().optional(),
  updatedAt: z.string()
});

export const KnowledgeChunkSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  documentId: z.string(),
  chunkIndex: z.number().int().nonnegative(),
  content: z.string(),
  searchable: z.boolean(),
  tokenCount: z.number().int().nonnegative().optional(),
  updatedAt: z.string()
});

export const CitationSchema = z.object({
  sourceId: z.string(),
  chunkId: z.string(),
  title: z.string(),
  uri: z.string(),
  quote: z.string().optional(),
  sourceType: KnowledgeSourceTypeSchema,
  trustClass: KnowledgeTrustClassSchema
});

export const RetrievalRequestSchema = z.object({
  query: z.string(),
  limit: z.number().int().positive().optional(),
  allowedSourceTypes: z.array(KnowledgeSourceTypeSchema).optional(),
  minTrustClass: KnowledgeTrustClassSchema.optional(),
  includeContextWindow: z.boolean().optional()
});

export const RetrievalHitSchema = z.object({
  chunkId: z.string(),
  documentId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  uri: z.string(),
  sourceType: KnowledgeSourceTypeSchema,
  trustClass: KnowledgeTrustClassSchema,
  content: z.string(),
  score: z.number(),
  citation: CitationSchema
});

export const RetrievalResultSchema = z.object({
  hits: z.array(RetrievalHitSchema),
  total: z.number().int().nonnegative()
});
