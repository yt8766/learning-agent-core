import { useCallback } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import { KNOWLEDGE_QUERY_STALE_TIME_MS, knowledgeQueryKeys } from '../api/knowledge-query';
import type { ChatAssistantConfig, SettingsStorageOverview } from '../types/api';

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload(): Promise<void>;
}

const emptyStorage: SettingsStorageOverview = {
  buckets: [],
  knowledgeBases: [],
  updatedAt: ''
};

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

const CHAT_ASSISTANT_CONFIG_QUERY_KEY = [...knowledgeQueryKeys.root(), 'chat-lab', 'assistant-config'] as const;
const SETTINGS_API_KEYS_QUERY_KEY = [...knowledgeQueryKeys.root(), 'settings', 'api-keys'] as const;
const SETTINGS_MODEL_PROVIDERS_QUERY_KEY = [...knowledgeQueryKeys.root(), 'settings', 'model-providers'] as const;
const SETTINGS_SECURITY_QUERY_KEY = [...knowledgeQueryKeys.root(), 'settings', 'security'] as const;
const SETTINGS_STORAGE_QUERY_KEY = [...knowledgeQueryKeys.root(), 'settings', 'storage'] as const;
const WORKSPACE_USERS_QUERY_KEY = [...knowledgeQueryKeys.root(), 'workspace-users'] as const;

function useKnowledgeProjection<T>(queryKey: QueryKey, load: () => Promise<T>): AsyncState<T> {
  const query = useQuery({
    queryKey,
    queryFn: load,
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const { refetch } = query;
  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    data: query.data ?? null,
    error: toErrorOrNull(query.error),
    loading: query.isFetching,
    reload
  };
}

export function useWorkspaceUsers() {
  const api = useKnowledgeApi();
  const load = useCallback(() => api.listWorkspaceUsers(), [api]);
  const state = useKnowledgeProjection(WORKSPACE_USERS_QUERY_KEY, load);
  return {
    ...state,
    users: state.data?.items ?? []
  };
}

export function useSettingsModelProviders() {
  const api = useKnowledgeApi();
  const load = useCallback(() => api.getSettingsModelProviders(), [api]);
  const state = useKnowledgeProjection(SETTINGS_MODEL_PROVIDERS_QUERY_KEY, load);
  return {
    ...state,
    providers: state.data?.items ?? []
  };
}

export function useSettingsApiKeys() {
  const api = useKnowledgeApi();
  const load = useCallback(() => api.getSettingsApiKeys(), [api]);
  const state = useKnowledgeProjection(SETTINGS_API_KEYS_QUERY_KEY, load);
  return {
    ...state,
    apiKeys: state.data?.items ?? []
  };
}

export function useSettingsStorage() {
  const api = useKnowledgeApi();
  const load = useCallback(() => api.getSettingsStorage(), [api]);
  const state = useKnowledgeProjection(SETTINGS_STORAGE_QUERY_KEY, load);
  return {
    ...state,
    storage: state.data ?? emptyStorage
  };
}

export function useSettingsSecurity() {
  const api = useKnowledgeApi();
  const load = useCallback(() => api.getSettingsSecurity(), [api]);
  const state = useKnowledgeProjection(SETTINGS_SECURITY_QUERY_KEY, load);
  return {
    ...state,
    security: state.data
  };
}

export function useChatAssistantConfig() {
  const api = useKnowledgeApi();
  const load = useCallback(() => api.getChatAssistantConfig(), [api]);
  const state = useKnowledgeProjection<ChatAssistantConfig>(CHAT_ASSISTANT_CONFIG_QUERY_KEY, load);
  return {
    ...state,
    config: state.data
  };
}

function toErrorOrNull(error: unknown): Error | null {
  return error ? toError(error) : null;
}
