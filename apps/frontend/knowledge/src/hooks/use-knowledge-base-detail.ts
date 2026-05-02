import { useCallback, useEffect, useRef, useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
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

export function useKnowledgeBaseDetail(knowledgeBaseId: string | undefined): UseKnowledgeBaseDetailResult {
  const api = useKnowledgeApi() as ReturnType<typeof useKnowledgeApi> & ListDocumentsApi;
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const [state, setState] = useState<KnowledgeBaseDetailState>({
    documents: [],
    error: null,
    knowledgeBase: null,
    loading: true
  });

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!knowledgeBaseId) {
      setState(current => ({ ...current, error: new Error('缺少知识库 ID'), loading: false }));
      return;
    }
    setState(current => ({ ...current, error: null, loading: true }));
    try {
      const [knowledgeBases, documents] = await Promise.all([
        api.listKnowledgeBases(),
        api.listDocuments({ knowledgeBaseId })
      ]);
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      const knowledgeBase = knowledgeBases.items.find(item => item.id === knowledgeBaseId) ?? null;
      setState({
        documents: documents.items,
        error: knowledgeBase ? null : new Error('未找到知识库'),
        knowledgeBase,
        loading: false
      });
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState(current => ({ ...current, error: toError(error), loading: false }));
    }
  }, [api, knowledgeBaseId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
