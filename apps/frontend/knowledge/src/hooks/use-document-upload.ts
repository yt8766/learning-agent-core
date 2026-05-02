import { useCallback, useEffect, useRef, useState } from 'react';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import type { DocumentProcessingJob, KnowledgeDocument } from '../types/api';

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
    input: { filename: string; objectKey: string; uploadId: string }
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
  reset(): void;
  upload(file: File): Promise<void>;
}

export function useDocumentUpload({
  knowledgeBaseId,
  pollIntervalMs = 2000
}: {
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
        return;
      }
      if (!api.uploadKnowledgeFile || !api.createDocumentFromUpload) {
        setState(current => ({ ...current, error: new Error('知识库上传 API 尚未接入'), status: 'failed' }));
        return;
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
          return;
        }
        setState(current => ({ ...current, status: 'creating', uploadResult }));
        const created = await api.createDocumentFromUpload(knowledgeBaseId, {
          filename: uploadResult.filename,
          objectKey: uploadResult.objectKey,
          uploadId: uploadResult.uploadId
        });
        if (!mountedRef.current) {
          return;
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
      } catch (error) {
        if (mountedRef.current) {
          setState(current => ({ ...current, error: toError(error), status: 'failed' }));
        }
      }
    },
    [api, clearPollTimer, knowledgeBaseId, pollLatestJob]
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

  return { ...state, reset, upload };
}

function isSupportedKnowledgeFile(file: File) {
  const normalizedName = file.name.toLowerCase();
  return normalizedName.endsWith('.md') || normalizedName.endsWith('.markdown') || normalizedName.endsWith('.txt');
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
