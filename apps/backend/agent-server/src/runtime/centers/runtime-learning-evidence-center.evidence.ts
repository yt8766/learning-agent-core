import { ChatCheckpointRecord, TaskRecord } from '@agent/shared';

import { extractBrowserReplay } from '../helpers/runtime-connector-utils';
import { buildCheckpointRef } from '../helpers/runtime-derived-records';

export function buildEvidenceCenter(input: {
  tasks: TaskRecord[];
  jobs: any[];
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
  const taskEvidence = input.tasks.flatMap(task =>
    task.externalSources?.length
      ? task.externalSources.map(source => ({
          ...source,
          taskGoal: task.goal,
          checkpointRef: buildCheckpointRef(
            { getCheckpoint: input.getCheckpoint } as unknown as {
              getCheckpoint: (sessionId: string) => ChatCheckpointRecord | undefined;
            },
            task.sessionId
          ),
          recoverable: Boolean(task.sessionId && input.getCheckpoint(task.sessionId))
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
            checkpointRef: buildCheckpointRef(
              { getCheckpoint: input.getCheckpoint } as unknown as {
                getCheckpoint: (sessionId: string) => ChatCheckpointRecord | undefined;
              },
              task.sessionId
            ),
            recoverable: Boolean(task.sessionId && input.getCheckpoint(task.sessionId))
          };
        })
  );
  const learningEvidence = input.jobs.flatMap(job =>
    (job.sources ?? []).map((source: any) => {
      const browserReplay = extractBrowserReplay(source.detail);
      return {
        ...source,
        taskGoal: job.goal ?? job.summary ?? job.documentUri,
        replay: source.replay ?? browserReplay,
        recoverable: false
      };
    })
  );
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
          createdAt: new Date().toISOString()
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
            latestReceipts: input.knowledgeOverview.latestReceipts
          },
          createdAt: new Date().toISOString()
        }
      ]
    : [];
  return [...knowledgeEvidence, ...governanceEvidence, ...learningEvidence, ...taskEvidence];
}
