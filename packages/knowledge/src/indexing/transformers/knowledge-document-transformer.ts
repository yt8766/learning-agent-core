import type { KnowledgeIndexingContext, KnowledgeIndexingDocument } from '../types/indexing.types';

export interface KnowledgeDocumentTransformer {
  transform(
    document: KnowledgeIndexingDocument,
    context: KnowledgeIndexingContext
  ): Promise<KnowledgeIndexingDocument> | KnowledgeIndexingDocument;
}
