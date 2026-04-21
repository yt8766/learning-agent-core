import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

import type { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import type { Document as LangChainDocument } from '@langchain/core/documents';

class MarkdownDirectoryLoader implements BaseDocumentLoader {
  constructor(
    private readonly dirPath: string,
    private readonly extensions: string[] = ['.md', '.mdx']
  ) {}

  async load(): Promise<LangChainDocument[]> {
    const { Document } = await import('@langchain/core/documents');
    const entries = await readdir(this.dirPath, { withFileTypes: true, recursive: true });
    const results: LangChainDocument[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!this.extensions.includes(extname(entry.name).toLowerCase())) continue;
      const fullPath = join(entry.parentPath ?? entry.path ?? this.dirPath, entry.name);
      const content = await readFile(fullPath, 'utf8');
      results.push(new Document({ pageContent: content, metadata: { source: fullPath } }));
    }
    return results;
  }
}

export function createMarkdownDirectoryLoader(dirPath: string, extensions?: string[]): BaseDocumentLoader {
  return new MarkdownDirectoryLoader(dirPath, extensions);
}
