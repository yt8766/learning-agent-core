import type { KnowledgeIndexingContext, KnowledgeIndexingDocument } from '../types/indexing.types';

export interface KnowledgeDocumentLoader {
  load(context: KnowledgeIndexingContext): Promise<KnowledgeIndexingDocument[]>;
}
