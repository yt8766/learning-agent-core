import type { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import type { Loader, Document } from '@agent/core';

import { mapLangChainDocumentToCoreDocument } from '../shared/langchain-document.mapper';

export class LangChainLoaderAdapter implements Loader {
  constructor(private readonly inner: BaseDocumentLoader) {}

  async load(): Promise<Document[]> {
    const docs = await this.inner.load();
    return docs.map((doc, i) => mapLangChainDocumentToCoreDocument(doc, i));
  }
}
