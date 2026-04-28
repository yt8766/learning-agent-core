import { z } from 'zod';

import {
  CitationSchema,
  KnowledgeChunkSchema,
  KnowledgeSourceSchema,
  KnowledgeSourceTypeSchema,
  KnowledgeTrustClassSchema,
  RetrievalHitSchema,
  RetrievalRequestSchema,
  RetrievalResultSchema
} from '../schemas/knowledge-retrieval.schema';

export type KnowledgeSourceType = z.infer<typeof KnowledgeSourceTypeSchema>;
export type KnowledgeTrustClass = z.infer<typeof KnowledgeTrustClassSchema>;
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;
export type KnowledgeChunk = z.infer<typeof KnowledgeChunkSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type RetrievalRequest = z.infer<typeof RetrievalRequestSchema>;
export type RetrievalHit = z.infer<typeof RetrievalHitSchema>;
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;
