import { createRuntimeEmbeddingProvider } from '@agent/adapters';
import {
  buildKnowledgeDescriptor,
  ingestLocalKnowledge as ingestSdkLocalKnowledge,
  listKnowledgeArtifacts,
  readKnowledgeOverview
} from '@agent/knowledge';
import type { KnowledgeOverviewRecord, LocalKnowledgeStoreSettings } from '@agent/knowledge';

export { buildKnowledgeDescriptor, listKnowledgeArtifacts, readKnowledgeOverview };
export type { KnowledgeOverviewRecord };

export interface RuntimeLocalKnowledgeStoreSettings extends Omit<
  LocalKnowledgeStoreSettings,
  'embeddings' | 'tasksStateFilePath'
> {
  tasksStateFilePath?: string;
  embeddings?: LocalKnowledgeStoreSettings['embeddings'] & {
    endpoint: string;
    dimensions?: number;
  };
}

export function ingestLocalKnowledge(settings: RuntimeLocalKnowledgeStoreSettings): Promise<KnowledgeOverviewRecord> {
  const normalizedSettings: LocalKnowledgeStoreSettings = {
    ...settings,
    tasksStateFilePath: settings.tasksStateFilePath ?? `${settings.workspaceRoot}/data/runtime/tasks-state.json`,
    embeddings: settings.embeddings ?? {
      provider: 'glm',
      model: 'Embedding-3',
      apiKey: settings.mcp?.bigmodelApiKey ?? settings.zhipuApiKey
    }
  };
  const embeddingProvider =
    settings.embeddings?.endpoint && settings.embeddings.model
      ? createRuntimeEmbeddingProvider(
          settings as RuntimeLocalKnowledgeStoreSettings & {
            embeddings: NonNullable<RuntimeLocalKnowledgeStoreSettings['embeddings']>;
          }
        )
      : undefined;

  return ingestSdkLocalKnowledge(normalizedSettings, {
    embeddingProvider
  });
}
