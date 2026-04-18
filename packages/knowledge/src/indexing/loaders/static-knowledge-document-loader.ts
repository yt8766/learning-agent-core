import type { KnowledgeIndexingContext, KnowledgeIndexingDocument } from '../types/indexing.types';
import type { KnowledgeDocumentLoader } from './knowledge-document-loader';

export class StaticKnowledgeDocumentLoader implements KnowledgeDocumentLoader {
  constructor(private readonly documents: KnowledgeIndexingDocument[]) {}

  async load(_context: KnowledgeIndexingContext): Promise<KnowledgeIndexingDocument[]> {
    return this.documents;
  }
}
