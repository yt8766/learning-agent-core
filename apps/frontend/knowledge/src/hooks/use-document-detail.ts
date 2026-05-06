import { useCallback, useEffect, useRef, useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import type { DocumentChunk, DocumentProcessingJob, KnowledgeDocument, ReprocessDocumentResponse } from '../types/api';

type CoreOpsApi = {
  getDocument(documentId: string): Promise<KnowledgeDocument>;
  getLatestDocumentJob(documentId: string): Promise<DocumentProcessingJob>;
  listDocumentChunks(documentId: string): Promise<{ items: DocumentChunk[]; total: number }>;
  reprocessDocument(documentId: string): Promise<ReprocessDocumentResponse>;
};

interface DocumentDetailState {
  chunks: DocumentChunk[];
  document: KnowledgeDocument | null;
  error: Error | null;
  job: DocumentProcessingJob | null;
  loading: boolean;
  reprocessAvailable: boolean;
  totalChunks: number;
}

export interface UseDocumentDetailResult extends DocumentDetailState {
  reload(): Promise<void>;
  reprocess(): Promise<void>;
}

export function useDocumentDetail(documentId: string | undefined): UseDocumentDetailResult {
  const api = useKnowledgeApi() as ReturnType<typeof useKnowledgeApi> & Partial<CoreOpsApi>;
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const [state, setState] = useState<DocumentDetailState>({
    chunks: [],
    document: null,
    error: null,
    job: null,
    loading: true,
    reprocessAvailable: false,
    totalChunks: 0
  });

  const reload = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (!documentId) {
      setState(current => ({ ...current, error: new Error('缺少文档 ID'), loading: false }));
      return;
    }
    if (!api.getDocument || !api.getLatestDocumentJob || !api.listDocumentChunks) {
      setState(current => ({ ...current, error: new Error('文档详情 API 尚未接入'), loading: false }));
      return;
    }
    setState(current => ({ ...current, error: null, loading: true }));
    try {
      const [document, job, chunks] = await Promise.all([
        api.getDocument(documentId),
        api.getLatestDocumentJob(documentId),
        api.listDocumentChunks(documentId)
      ]);
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState({
        chunks: chunks.items,
        document,
        error: null,
        job,
        loading: false,
        reprocessAvailable: Boolean(api.reprocessDocument),
        totalChunks: chunks.total
      });
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) {
        return;
      }
      setState(current => ({ ...current, error: toError(error), loading: false }));
    }
  }, [api, documentId]);

  const reprocess = useCallback(async () => {
    if (!documentId || !api.reprocessDocument) {
      setState(current => ({ ...current, error: new Error('重新处理 API 尚未接入') }));
      return;
    }
    setState(current => ({ ...current, error: null, loading: true }));
    try {
      const result = await api.reprocessDocument(documentId);
      if (!mountedRef.current) {
        return;
      }
      setState(current => ({
        ...current,
        document: result.document,
        job: result.job,
        loading: false,
        reprocessAvailable: true
      }));
      await reload();
    } catch (error) {
      if (mountedRef.current) {
        setState(current => ({ ...current, error: toError(error), loading: false }));
      }
    }
  }, [api, documentId, reload]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, reprocess };
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
