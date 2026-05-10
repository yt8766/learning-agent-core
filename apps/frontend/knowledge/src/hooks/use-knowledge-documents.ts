import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useKnowledgeApi } from '../api/knowledge-api-provider';
import { KNOWLEDGE_QUERY_STALE_TIME_MS, knowledgeQueryKeys } from '../api/knowledge-query';
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

const DOCUMENTS_QUERY_KEY = knowledgeQueryKeys.documents();

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function useKnowledgeDocuments(): KnowledgeDocumentsResult {
  const api = useKnowledgeApi();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<Error | null>(null);
  const documentsQuery = useQuery({
    queryKey: DOCUMENTS_QUERY_KEY,
    queryFn: () => api.listDocuments(),
    staleTime: KNOWLEDGE_QUERY_STALE_TIME_MS
  });
  const { refetch } = documentsQuery;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const invalidateDocuments = useCallback(
    async () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_QUERY_KEY }),
    [queryClient]
  );

  const reprocessMutation = useMutation({
    mutationFn: (documentId: string) => api.reprocessDocument(documentId),
    onMutate: () => setActionError(null),
    onSuccess: invalidateDocuments,
    onError: error => setActionError(toError(error))
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, knowledgeBaseId }: { file: File; knowledgeBaseId: string }) =>
      api.uploadDocument({ file, knowledgeBaseId }),
    onMutate: () => setActionError(null),
    onSuccess: invalidateDocuments,
    onError: error => setActionError(toError(error))
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => api.deleteDocument(documentId),
    onMutate: () => setActionError(null),
    onSuccess: invalidateDocuments,
    onError: error => setActionError(toError(error))
  });
  const { mutateAsync: deleteDocumentMutation } = deleteMutation;
  const { mutateAsync: reprocessDocumentMutation } = reprocessMutation;
  const { mutateAsync: uploadDocumentMutation } = uploadMutation;

  const reprocessDocument = useCallback(
    async (documentId: string) => {
      try {
        await reprocessDocumentMutation(documentId);
      } catch (error) {
        setActionError(toError(error));
      }
    },
    [reprocessDocumentMutation]
  );

  const uploadDocument = useCallback(
    async (file: File, knowledgeBaseId: string) => {
      try {
        await uploadDocumentMutation({ file, knowledgeBaseId });
      } catch (error) {
        setActionError(toError(error));
      }
    },
    [uploadDocumentMutation]
  );

  const deleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await deleteDocumentMutation(documentId);
      } catch (error) {
        setActionError(toError(error));
      }
    },
    [deleteDocumentMutation]
  );

  return {
    loading: documentsQuery.isFetching,
    error: toErrorOrNull(documentsQuery.error) ?? actionError,
    actionError,
    documents: documentsQuery.data?.items ?? [],
    reload,
    reprocessDocument,
    deleteDocument,
    uploadDocument
  };
}

function toErrorOrNull(error: unknown): Error | null {
  return error ? toError(error) : null;
}
