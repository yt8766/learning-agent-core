import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import { KNOWLEDGE_QUERY_STALE_TIME_MS, knowledgeQueryKeys } from '../api/knowledge-query';
import type { KnowledgeBase, KnowledgeDocument, PageResult } from '../types/api';

interface KnowledgeBaseDetailState {
  documents: KnowledgeDocument[];
  error: Error | null;
  knowledgeBase: KnowledgeBase | null;
  loading: boolean;
}

export interface UseKnowledgeBaseDetailResult extends KnowledgeBaseDetailState {
  reload(): Promise<void>;
}

type ListDocumentsApi = {
  listDocuments(input?: { knowledgeBaseId?: string }): Promise<PageResult<KnowledgeDocument>>;
};

const KNOWLEDGE_BASES_QUERY_KEY = knowledgeQueryKeys.knowledgeBases();

export function useKnowledgeBaseDetail(knowledgeBaseId: string | undefined): UseKnowledgeBaseDetailResult {
  const api = useKnowledgeApi() as ReturnType<typeof useKnowledgeApi> & ListDocumentsApi;
  const enabled = Boolean(knowledgeBaseId);
  const knowledgeBasesQuery = useQuery({
    queryKey: KNOWLEDGE_BASES_QUERY_KEY,
    queryFn: () => api.listKnowledgeBases(),
    enabled,
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const documentsQuery = useQuery({
    queryKey: knowledgeQueryKeys.documents(knowledgeBaseId ? { knowledgeBaseId } : {}),
    queryFn: async () => {
      if (!knowledgeBaseId) {
        throw new Error('缺少知识库 ID');
      }
      return readDocumentItems(await api.listDocuments({ knowledgeBaseId }));
    },
    enabled,
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const { refetch: refetchKnowledgeBases } = knowledgeBasesQuery;
  const { refetch: refetchDocuments } = documentsQuery;

  const reload = useCallback(async () => {
    if (!knowledgeBaseId) {
      return;
    }
    await Promise.all([refetchKnowledgeBases(), refetchDocuments()]);
  }, [knowledgeBaseId, refetchDocuments, refetchKnowledgeBases]);

  if (!knowledgeBaseId) {
    return {
      documents: [],
      error: new Error('缺少知识库 ID'),
      knowledgeBase: null,
      loading: false,
      reload
    };
  }

  const queryError = toErrorOrNull(knowledgeBasesQuery.error ?? documentsQuery.error);
  const loading = knowledgeBasesQuery.isFetching || documentsQuery.isFetching;
  const knowledgeBase = knowledgeBasesQuery.data?.items.find(item => item.id === knowledgeBaseId) ?? null;
  const missingKnowledgeBaseError =
    !loading && !queryError && knowledgeBasesQuery.isSuccess && !knowledgeBase ? new Error('未找到知识库') : null;

  return {
    documents: documentsQuery.data ?? [],
    error: queryError ?? missingKnowledgeBaseError,
    knowledgeBase,
    loading,
    reload
  };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function toErrorOrNull(error: unknown): Error | null {
  return error ? toError(error) : null;
}

function readDocumentItems(response: unknown): KnowledgeDocument[] {
  if (typeof response === 'object' && response !== null && 'items' in response && Array.isArray(response.items)) {
    return response.items as KnowledgeDocument[];
  }
  throw new Error('文档列表响应结构不正确');
}
