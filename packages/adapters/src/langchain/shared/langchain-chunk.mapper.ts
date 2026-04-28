import { Document as LangChainDocument } from '@langchain/core/documents';
import type { Chunk } from '@agent/knowledge';

import { chunkId } from '../../shared/ids/stable-id';
import { mergeMetadata } from '../../shared/metadata/merge-metadata';
import { normalizeMetadata } from '../../shared/metadata/normalize-metadata';

export function mapLangChainSplitToCoreChunk(
  split: LangChainDocument,
  sourceDocumentId: string,
  chunkIndex: number
): Chunk {
  return {
    id: chunkId(sourceDocumentId, chunkIndex),
    content: split.pageContent,
    sourceDocumentId,
    chunkIndex,
    metadata: mergeMetadata(normalizeMetadata((split.metadata as Record<string, unknown>) ?? {}), {
      sourceDocumentId,
      chunkIndex
    })
  };
}

export function mapCoreDocumentToLangChainDocument(doc: {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
}): LangChainDocument {
  return new LangChainDocument({ pageContent: doc.content, metadata: { ...doc.metadata, id: doc.id } });
}
