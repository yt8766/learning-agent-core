import type { BaseDocumentTransformer } from '@langchain/core/documents';

export async function createRecursiveTextSplitterChunker(options?: {
  chunkSize?: number;
  chunkOverlap?: number;
}): Promise<BaseDocumentTransformer> {
  const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
  return new RecursiveCharacterTextSplitter({
    chunkSize: options?.chunkSize ?? 1000,
    chunkOverlap: options?.chunkOverlap ?? 200
  });
}

export async function createMarkdownTextSplitterChunker(options?: {
  chunkSize?: number;
  chunkOverlap?: number;
}): Promise<BaseDocumentTransformer> {
  const { MarkdownTextSplitter } = await import('@langchain/textsplitters');
  return new MarkdownTextSplitter({
    chunkSize: options?.chunkSize ?? 1000,
    chunkOverlap: options?.chunkOverlap ?? 200
  });
}

export async function createTokenTextSplitterChunker(options?: {
  chunkSize?: number;
  chunkOverlap?: number;
}): Promise<BaseDocumentTransformer> {
  const { TokenTextSplitter } = await import('@langchain/textsplitters');
  return new TokenTextSplitter({ chunkSize: options?.chunkSize ?? 512, chunkOverlap: options?.chunkOverlap ?? 64 });
}
