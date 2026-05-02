import { useCallback, useEffect, useRef, useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import type { CreateDocumentFromUploadRequest, DocumentProcessingJob, KnowledgeDocument } from '../types/api';

type KnowledgeUploadResult = {
  uploadId: string;
  knowledgeBaseId: string;
  filename: string;
  size: number;
  contentType: 'text/markdown' | 'text/plain';
  objectKey: string;
  ossUrl: string;
  uploadedAt: string;
};

type CreateDocumentFromUploadResponse = {
  document: KnowledgeDocument;
  job: DocumentProcessingJob;
};

type CoreOpsApi = {
  createDocumentFromUpload(
    knowledgeBaseId: string,
    input: CreateDocumentFromUploadRequest
  ): Promise<CreateDocumentFromUploadResponse>;
  getLatestDocumentJob(documentId: string): Promise<DocumentProcessingJob>;
  uploadKnowledgeFile(input: { file: File; knowledgeBaseId: string }): Promise<KnowledgeUploadResult>;
};

type UploadFlowStatus = 'idle' | 'uploading' | 'uploaded' | 'creating' | 'polling' | 'succeeded' | 'failed';

interface DocumentUploadState {
  document: KnowledgeDocument | null;
  error: Error | null;
  job: DocumentProcessingJob | null;
  status: UploadFlowStatus;
  uploadResult: KnowledgeUploadResult | null;
}

export interface UseDocumentUploadResult extends DocumentUploadState {
  progressPercent: number;
  reset(): void;
  upload(file: File): Promise<boolean>;
}

export function useDocumentUpload({
  embeddingModelId,
  knowledgeBaseId,
  pollIntervalMs = 2000
}: {
  embeddingModelId?: string;
  knowledgeBaseId: string;
  pollIntervalMs?: number;
}): UseDocumentUploadResult {
  const api = useKnowledgeApi() as ReturnType<typeof useKnowledgeApi> & Partial<CoreOpsApi>;
  const mountedRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<DocumentUploadState>({
    document: null,
    error: null,
    job: null,
    status: 'idle',
    uploadResult: null
  });

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollLatestJob = useCallback(
    (documentId: string) => {
      clearPollTimer();
      pollTimerRef.current = setTimeout(() => {
        void (async () => {
          if (!api.getLatestDocumentJob || !mountedRef.current) {
            return;
          }
          try {
            const job = await api.getLatestDocumentJob(documentId);
            if (!mountedRef.current) {
              return;
            }
            const terminal = job.status === 'succeeded' || job.status === 'failed' || job.status === 'canceled';
            setState(current => ({
              ...current,
              error: job.status === 'failed' && job.error ? new Error(job.error.message) : current.error,
              job,
              status: job.status === 'succeeded' ? 'succeeded' : job.status === 'failed' ? 'failed' : 'polling'
            }));
            if (!terminal) {
              pollLatestJob(documentId);
            }
          } catch (error) {
            if (mountedRef.current) {
              setState(current => ({ ...current, error: toError(error), status: 'failed' }));
            }
          }
        })();
      }, pollIntervalMs);
    },
    [api, clearPollTimer, pollIntervalMs]
  );

  const upload = useCallback(
    async (file: File) => {
      clearPollTimer();
      if (!isSupportedKnowledgeFile(file)) {
        setState(current => ({ ...current, error: new Error('仅支持 Markdown/TXT 文件'), status: 'failed' }));
        return false;
      }
      if (!api.uploadKnowledgeFile || !api.createDocumentFromUpload) {
        setState(current => ({ ...current, error: new Error('知识库上传 API 尚未接入'), status: 'failed' }));
        return false;
      }
      try {
        setState({
          document: null,
          error: null,
          job: null,
          status: 'uploading',
          uploadResult: null
        });
        const uploadResult = await api.uploadKnowledgeFile({ file, knowledgeBaseId });
        if (!mountedRef.current) {
          return false;
        }
        setState(current => ({ ...current, status: 'creating', uploadResult }));
        const created = await api.createDocumentFromUpload(knowledgeBaseId, {
          filename: uploadResult.filename,
          metadata: embeddingModelId ? { embeddingModelId } : undefined,
          objectKey: uploadResult.objectKey,
          uploadId: uploadResult.uploadId
        });
        if (!mountedRef.current) {
          return false;
        }
        const terminal =
          created.job.status === 'succeeded' || created.job.status === 'failed' || created.job.status === 'canceled';
        setState(current => ({
          ...current,
          document: created.document,
          job: created.job,
          status: created.job.status === 'succeeded' ? 'succeeded' : terminal ? 'failed' : 'polling'
        }));
        if (!terminal) {
          pollLatestJob(created.document.id);
        }
        return true;
      } catch (error) {
        if (mountedRef.current) {
          setState(current => ({ ...current, error: toError(error), status: 'failed' }));
        }
        return false;
      }
    },
    [api, clearPollTimer, embeddingModelId, knowledgeBaseId, pollLatestJob]
  );

  const reset = useCallback(() => {
    clearPollTimer();
    setState({
      document: null,
      error: null,
      job: null,
      status: 'idle',
      uploadResult: null
    });
  }, [clearPollTimer]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearPollTimer();
    };
  }, [clearPollTimer]);

  return { ...state, progressPercent: resolveUploadProgressPercent(state), reset, upload };
}

function isSupportedKnowledgeFile(file: File) {
  const normalizedName = file.name.toLowerCase();
  return normalizedName.endsWith('.md') || normalizedName.endsWith('.markdown') || normalizedName.endsWith('.txt');
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function resolveUploadProgressPercent(state: DocumentUploadState): number {
  if (state.status === 'succeeded') {
    return 100;
  }
  if (state.status === 'failed') {
    return state.uploadResult ? 100 : 0;
  }
  if (state.status === 'polling' && state.job) {
    return resolveJobProgressPercent(state.job);
  }
  if (state.status === 'creating') {
    return 45;
  }
  if (state.status === 'uploaded') {
    return 35;
  }
  if (state.status === 'uploading') {
    return 15;
  }
  return 0;
}

function resolveJobProgressPercent(job: DocumentProcessingJob): number {
  if (typeof job.progress?.percent === 'number') {
    return clampPercent(job.progress.percent);
  }
  if (job.status === 'succeeded') {
    return 100;
  }
  if (job.status === 'failed' || job.status === 'canceled') {
    return 100;
  }
  const stageOrder: Record<string, number> = {
    upload_received: 45,
    parse: 55,
    clean: 62,
    chunk: 70,
    embed: 82,
    index_vector: 90,
    index_keyword: 94,
    commit: 98
  };
  return job.currentStage ? (stageOrder[job.currentStage] ?? 50) : 50;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
