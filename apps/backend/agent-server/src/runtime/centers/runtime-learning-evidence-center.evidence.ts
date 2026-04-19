import type { ChatCheckpointRecord, TaskRecord } from '@agent/core';

import {
  buildLearningJobEvidenceEntries,
  buildOverviewEvidenceEntries,
  buildTaskEvidenceEntries
} from './runtime-learning-evidence-center.evidence-adapter';

export function buildEvidenceCenter(input: {
  tasks: TaskRecord[];
  jobs: Array<{
    goal?: string;
    summary?: string;
    documentUri?: string;
    sources?: Array<{
      detail?: unknown;
      replay?: unknown;
      [key: string]: unknown;
    }>;
  }>;
  getCheckpoint: (sessionId: string) => ChatCheckpointRecord | undefined;
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
}) {
  return [
    ...buildOverviewEvidenceEntries({
      wenyuanOverview: input.wenyuanOverview,
      knowledgeOverview: input.knowledgeOverview,
      now: new Date()
    }),
    ...buildLearningJobEvidenceEntries(input.jobs),
    ...buildTaskEvidenceEntries(input.tasks, input.getCheckpoint)
  ];
}
