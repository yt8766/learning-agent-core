import { z } from 'zod';
import type { Document, Loader } from '../../index';

import { JsonObjectSchema } from '../../contracts/indexing/schemas/metadata.schema';
import {
  KnowledgeSourceTypeSchema,
  KnowledgeTrustClassSchema
} from '../../contracts/schemas/knowledge-retrieval.schema';

export const KnowledgeSourceIngestionPayloadSchema = z.object({
  sourceId: z.string().min(1),
  documentId: z.string().min(1).optional(),
  sourceType: KnowledgeSourceTypeSchema,
  uri: z.string().min(1),
  title: z.string().min(1),
  trustClass: KnowledgeTrustClassSchema,
  content: z.string(),
  version: z.string().min(1).optional(),
  metadata: JsonObjectSchema.optional()
});

export type KnowledgeSourceIngestionPayload = z.infer<typeof KnowledgeSourceIngestionPayloadSchema>;

export function createKnowledgeSourceIngestionLoader(payloads: readonly unknown[]): Loader {
  return new KnowledgeSourceIngestionLoader(payloads);
}

export class KnowledgeSourceIngestionLoader implements Loader {
  constructor(private readonly payloads: readonly unknown[]) {}

  async load(): Promise<Document[]> {
    return this.payloads.map(payload => toDocument(KnowledgeSourceIngestionPayloadSchema.parse(payload)));
  }
}

function toDocument(payload: KnowledgeSourceIngestionPayload): Document {
  return {
    id: payload.documentId ?? payload.sourceId,
    content: payload.content,
    metadata: {
      ...payload.metadata,
      sourceId: payload.sourceId,
      sourceType: payload.sourceType,
      uri: payload.uri,
      title: payload.title,
      trustClass: payload.trustClass,
      ...(payload.version ? { version: payload.version } : {})
    }
  };
}
