export const KNOWLEDGE_QUERY_STALE_TIME_MS = 30_000;

interface DocumentsQueryParams {
  knowledgeBaseId?: string;
}

interface EvalRunComparisonQueryParams {
  baselineRunId: string;
  candidateRunId: string;
}

export const knowledgeQueryKeys = {
  root: () => ['knowledge'] as const,
  dashboard: () => ['knowledge', 'dashboard'] as const,
  knowledgeBases: () => ['knowledge', 'knowledge-bases'] as const,
  documents: (params: DocumentsQueryParams = {}) =>
    ['knowledge', 'documents', normalizeDocumentsParams(params)] as const,
  trace: (traceId: string) => ['knowledge', 'observability', 'trace', traceId] as const,
  evalRunComparison: (params: EvalRunComparisonQueryParams) =>
    ['knowledge', 'evals', 'run-comparison', normalizeEvalRunComparisonParams(params)] as const
};

function normalizeDocumentsParams(params: DocumentsQueryParams) {
  return params.knowledgeBaseId ? { knowledgeBaseId: params.knowledgeBaseId } : {};
}

function normalizeEvalRunComparisonParams(params: EvalRunComparisonQueryParams) {
  return {
    baselineRunId: params.baselineRunId,
    candidateRunId: params.candidateRunId
  };
}
