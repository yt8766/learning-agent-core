import { useCallback, useEffect, useRef, useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import type { KnowledgeDocument } from '../types/api';

interface KnowledgeDocumentsState {
  loading: boolean;
  error: Error | null;
  actionError: Error | null;
  documents: KnowledgeDocument[];
}

export interface KnowledgeDocumentsResult extends KnowledgeDocumentsState {
  reload(): Promise<void>;
  reprocessDocument(documentId: string): Promise<void>;
  deleteDocument(documentId: string): Promise<void>;
  uploadDocument(file: File, knowledgeBaseId: string): Promise<void>;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function readDocumentItems(response: unknown): KnowledgeDocument[] {
  if (typeof response === 'object' && response !== null && 'items' in response && Array.isArray(response.items)) {
    return response.items as KnowledgeDocument[];
  }
  throw new Error('文档列表响应结构不正确');
}

export function useKnowledgeDocuments(): KnowledgeDocumentsResult {
  const api = useKnowledgeApi();
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const [state, setState] = useState<KnowledgeDocumentsState>({
    loading: true,
    error: null,
    actionError: null,
    documents: []
  });

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!mountedRef.current) {
      return;
    }
    setState(current => ({ ...current, loading: true, error: null }));
    try {
      const documents = await api.listDocuments();
      const documentItems = readDocumentItems(documents);
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState(current => ({ ...current, loading: false, error: null, documents: documentItems }));
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState(current => ({ ...current, loading: false, error: toError(error) }));
    }
  }, [api]);

  const reprocessDocument = useCallback(
    async (documentId: string) => {
      try {
        setState(current => ({ ...current, actionError: null }));
        await api.reprocessDocument(documentId);
        await reload();
      } catch (error) {
        if (mountedRef.current) {
          setState(current => ({ ...current, actionError: toError(error) }));
        }
      }
    },
    [api, reload]
  );

  const uploadDocument = useCallback(
    async (file: File, knowledgeBaseId: string) => {
      try {
        setState(current => ({ ...current, actionError: null }));
        await api.uploadDocument({ file, knowledgeBaseId });
        await reload();
      } catch (error) {
        if (mountedRef.current) {
          setState(current => ({ ...current, actionError: toError(error) }));
        }
      }
    },
    [api, reload]
  );

  const deleteDocument = useCallback(
    async (documentId: string) => {
      try {
        setState(current => ({ ...current, actionError: null }));
        await api.deleteDocument(documentId);
        await reload();
      } catch (error) {
        if (mountedRef.current) {
          setState(current => ({ ...current, actionError: toError(error) }));
        }
      }
    },
    [api, reload]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    ...state,
    error: state.error ?? state.actionError,
    reload,
    reprocessDocument,
    deleteDocument,
    uploadDocument
  };
}
