import type { ChatCheckpointRecord, TaskRecord } from '@agent/core';
import { PostRetrievalDiagnosticsSchema } from '@agent/knowledge';
import type { RuntimeKnowledgeSearchDiagnosticsSnapshot } from '@agent/runtime';

import { extractBrowserReplay } from '../helpers/runtime-connector-utils';
import { buildCheckpointRef } from '../domain/session/runtime-checkpoint-ref';

interface LearningEvidenceSourceRecord {
  detail?: unknown;
  replay?: unknown;
  [key: string]: unknown;
}

interface LearningJobRecord {
  goal?: string;
  summary?: string;
  documentUri?: string;
  sources?: LearningEvidenceSourceRecord[];
}

interface EvidenceCheckpointBinding {
  checkpointRef:
    | {
        sessionId: string;
        taskId?: string;
        checkpointId?: string;
        checkpointCursor?: number;
        recoverability: ChatCheckpointRecord['recoverability'];
      }
    | undefined;
  recoverable: boolean;
}

type GetCheckpoint = (sessionId: string) => ChatCheckpointRecord | undefined;

export function createEvidenceCheckpointBindingResolver(getCheckpoint: GetCheckpoint) {
  const cache = new Map<string, ChatCheckpointRecord | undefined>();

  const readCheckpoint = (sessionId: string) => {
    if (!cache.has(sessionId)) {
      cache.set(sessionId, getCheckpoint(sessionId));
    }
    return cache.get(sessionId);
  };

  return (sessionId?: string): EvidenceCheckpointBinding => {
    if (!sessionId) {
      return { checkpointRef: undefined, recoverable: false };
    }
    const checkpoint = readCheckpoint(sessionId);
    return {
      checkpointRef: checkpoint
        ? buildCheckpointRef(
            {
              getCheckpoint: requestedSessionId =>
                requestedSessionId === sessionId ? checkpoint : getCheckpoint(requestedSessionId)
            },
            sessionId
          )
        : undefined,
      recoverable: Boolean(checkpoint)
    };
  };
}

export function buildTaskEvidenceEntries(tasks: TaskRecord[], getCheckpoint: GetCheckpoint) {
  const resolveCheckpointBinding = createEvidenceCheckpointBindingResolver(getCheckpoint);

  return tasks.flatMap(task => {
    const checkpointBinding = resolveCheckpointBinding(task.sessionId);
    return task.externalSources?.length
      ? task.externalSources.map(source => ({
          ...source,
          taskGoal: task.goal,
          checkpointRef: checkpointBinding.checkpointRef,
          recoverable: checkpointBinding.recoverable
        }))
      : task.trace.map((trace, index) => {
          const browserReplay = extractBrowserReplay(trace.data);
          return {
            id: `${task.id}:${index}`,
            taskId: task.id,
            taskGoal: task.goal,
            sourceType: browserReplay ? 'browser_trace' : 'trace',
            sourceUrl: browserReplay?.url,
            trustClass: 'internal' as const,
            summary: trace.summary,
            detail: trace.data,
            linkedRunId: task.runId,
            createdAt: trace.at,
            replay: browserReplay,
            checkpointRef: checkpointBinding.checkpointRef,
            recoverable: checkpointBinding.recoverable
          };
        });
  });
}

export function buildLearningJobEvidenceEntries(jobs: LearningJobRecord[]) {
  return jobs.flatMap(job =>
    (job.sources ?? []).map(source => {
      const detail = asRecord(source.detail);
      const browserReplay = detail ? extractBrowserReplay(detail) : undefined;
      return {
        ...source,
        taskGoal: job.goal ?? job.summary ?? job.documentUri,
        replay: source.replay ?? browserReplay,
        recoverable: false
      };
    })
  );
}

export function buildOverviewEvidenceEntries(input: {
  wenyuanOverview?: {
    memoryCount: number;
    sessionCount: number;
    checkpointCount: number;
    traceCount: number;
    governanceHistoryCount: number;
  };
  knowledgeOverview?: {
    sourceCount: number;
    chunkCount: number;
    embeddingCount: number;
    searchableDocumentCount: number;
    blockedDocumentCount: number;
    latestReceipts: Array<{
      id: string;
      status: string;
      updatedAt: string;
    }>;
  };
  knowledgeSearchLastDiagnostics?: RuntimeKnowledgeSearchDiagnosticsSnapshot;
  now: Date;
}) {
  const knowledgeRetrievalDiagnostics = buildKnowledgeRetrievalDiagnosticsDetail(input.knowledgeSearchLastDiagnostics);
  const governanceEvidence = input.wenyuanOverview
    ? [
        {
          id: 'wenyuan:overview',
          taskId: 'runtime:wenyuan',
          taskGoal: '文渊阁统一观测',
          sourceId: 'wenyuan',
          sourceType: 'runtime_state',
          sourceStore: 'wenyuan',
          trustClass: 'internal' as const,
          summary: `文渊阁汇总 memory ${input.wenyuanOverview.memoryCount} / session ${input.wenyuanOverview.sessionCount} / checkpoint ${input.wenyuanOverview.checkpointCount}`,
          detail: {
            knowledgeStore: 'wenyuan',
            traceCount: input.wenyuanOverview.traceCount,
            governanceHistoryCount: input.wenyuanOverview.governanceHistoryCount
          },
          createdAt: input.now.toISOString()
        }
      ]
    : [];
  const knowledgeEvidence = input.knowledgeOverview
    ? [
        {
          id: 'cangjing:overview',
          taskId: 'runtime:cangjing',
          taskGoal: '藏经阁本地知识链',
          sourceId: 'cangjing',
          sourceType: 'document',
          sourceStore: 'cangjing',
          trustClass: 'internal' as const,
          summary: `藏经阁索引 source ${input.knowledgeOverview.sourceCount} / searchable ${input.knowledgeOverview.searchableDocumentCount} / blocked ${input.knowledgeOverview.blockedDocumentCount}`,
          detail: {
            knowledgeStore: 'cangjing',
            sourceCount: input.knowledgeOverview.sourceCount,
            chunkCount: input.knowledgeOverview.chunkCount,
            embeddingCount: input.knowledgeOverview.embeddingCount,
            searchableDocumentCount: input.knowledgeOverview.searchableDocumentCount,
            blockedDocumentCount: input.knowledgeOverview.blockedDocumentCount,
            latestReceipts: input.knowledgeOverview.latestReceipts,
            ...(knowledgeRetrievalDiagnostics ? { knowledgeRetrievalDiagnostics } : {})
          },
          createdAt: input.now.toISOString()
        }
      ]
    : [];
  return [...knowledgeEvidence, ...governanceEvidence];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

function buildKnowledgeRetrievalDiagnosticsDetail(snapshot?: RuntimeKnowledgeSearchDiagnosticsSnapshot) {
  const postRetrieval = asRecord(snapshot?.diagnostics)?.postRetrieval;
  if (!snapshot || !asRecord(postRetrieval)) {
    return undefined;
  }
  const parsedPostRetrieval = PostRetrievalDiagnosticsSchema.safeParse(postRetrieval);
  if (!parsedPostRetrieval.success) {
    return undefined;
  }

  return {
    query: snapshot.query,
    limit: snapshot.limit,
    hitCount: snapshot.hitCount,
    total: snapshot.total,
    searchedAt: snapshot.searchedAt,
    postRetrieval: parsedPostRetrieval.data
  };
}
