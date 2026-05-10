import { relative, resolve } from 'node:path';

import fs from 'fs-extra';
import type { Document, Loader } from '@agent/knowledge';

const DEFAULT_EXTENSIONS = ['.md', '.markdown', '.txt'];

export interface LocalDirectoryLoaderOptions {
  dir: string;
  extensions?: string[];
}

export class LocalDirectoryLoader implements Loader {
  private readonly dir: string;
  private readonly extensions: string[];

  constructor(options: LocalDirectoryLoaderOptions) {
    this.dir = resolve(options.dir);
    this.extensions = (options.extensions?.length ? options.extensions : DEFAULT_EXTENSIONS).map(extension =>
      extension.startsWith('.') ? extension : `.${extension}`
    );
  }

  async load(): Promise<Document[]> {
    const files = await listFiles(this.dir, this.extensions);
    const documents = await Promise.all(
      files.map(async file => {
        const content = await fs.readFile(file, 'utf8');
        const relativePath = relative(this.dir, file);
        return {
          id: stableDocumentId(relativePath),
          content,
          metadata: {
            title: stripExtension(relativePath),
            uri: file,
            sourceId: stableDocumentId(relativePath),
            sourceType: 'workspace-docs',
            trustClass: 'internal'
          }
        };
      })
    );
    return documents.sort((left, right) => left.id.localeCompare(right.id));
  }
}

async function listFiles(dir: string, extensions: string[]): Promise<string[]> {
  const entries = await fs.readdir(dir);
  const files: string[] = [];

  for (const entry of entries) {
    if (entry === '.artifacts' || entry === 'node_modules') {
      continue;
    }
    const path = resolve(dir, entry);
    const stat = await fs.stat(path);
    if (stat.isDirectory()) {
      files.push(...(await listFiles(path, extensions)));
      continue;
    }
    if (extensions.some(extension => path.toLowerCase().endsWith(extension))) {
      files.push(path);
    }
  }

  return files.sort();
}

function stableDocumentId(relativePath: string): string {
  return `doc_${relativePath
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()}`;
}

function stripExtension(path: string): string {
  return path.replace(/\.[^.]+$/, '');
}
