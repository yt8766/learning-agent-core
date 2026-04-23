export const DEFAULT_KNOWLEDGE_INDEXING_CHUNK_SIZE = 800;
export const DEFAULT_KNOWLEDGE_INDEXING_CHUNK_OVERLAP = 120;
export const DEFAULT_KNOWLEDGE_INDEXING_BATCH_SIZE = 16;

export function defaultKnowledgeShouldIndex(document: { content: string }): boolean {
  return document.content.trim().length > 0;
}
