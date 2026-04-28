import type { Document as LangChainDocument } from '@langchain/core/documents';
import type { Document } from '@agent/knowledge';

import { documentId } from '../../shared/ids/stable-id';
import { normalizeMetadata } from '../../shared/metadata/normalize-metadata';

export function mapLangChainDocumentToCoreDocument(lc: LangChainDocument, fallbackIndex?: number): Document {
  const rawId =
    (lc.metadata as Record<string, unknown>)?.id ?? (lc.metadata as Record<string, unknown>)?.source ?? undefined;

  const id =
    typeof rawId === 'string' && rawId.length > 0
      ? rawId
      : documentId(fallbackIndex !== undefined ? String(fallbackIndex) : lc.pageContent.slice(0, 64));

  return {
    id,
    content: lc.pageContent,
    metadata: normalizeMetadata((lc.metadata as Record<string, unknown>) ?? {})
  };
}
