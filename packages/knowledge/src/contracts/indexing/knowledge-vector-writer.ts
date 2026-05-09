import { z } from 'zod';

import { KnowledgeSourceTypeSchema } from '../schemas/knowledge-retrieval.schema';

export const KnowledgeVectorDocumentRecordSchema = z.object({
  id: z.string().min(1),
  namespace: z.literal('knowledge'),
  sourceId: z.string().min(1),
  documentId: z.string().min(1),
  chunkId: z.string().min(1),
  uri: z.string().min(1),
  title: z.string().min(1),
  sourceType: KnowledgeSourceTypeSchema,
  content: z.string(),
  searchable: z.boolean()
});

export type KnowledgeVectorDocumentRecord = z.infer<typeof KnowledgeVectorDocumentRecordSchema>;

export interface KnowledgeVectorIndexWriter {
  upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void>;
}
