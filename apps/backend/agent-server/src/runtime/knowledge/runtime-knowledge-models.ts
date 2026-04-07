import { createRuntimeEmbeddingProvider } from '@agent/model';
import { loadSettings } from '@agent/config';

type RuntimeSettings = ReturnType<typeof loadSettings>;

export function createKnowledgeEmbeddingProvider(settings: RuntimeSettings) {
  return createRuntimeEmbeddingProvider(settings);
}
