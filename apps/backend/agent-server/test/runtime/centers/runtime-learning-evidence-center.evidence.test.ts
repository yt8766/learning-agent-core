import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildEvidenceCenter } from '../../../src/runtime/centers/runtime-learning-evidence-center';

describe('runtime-learning-evidence-center evidence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds evidence from knowledge/governance overviews, learning jobs, task sources, and trace fallbacks', () => {
    const checkpoints = {
      'session-ext': {
        taskId: 'task-ext',
        checkpointId: 'ck-1',
        traceCursor: 9,
        recoverability: 'full'
      },
      'session-trace': {
        taskId: 'task-trace',
        checkpointId: 'ck-2',
        traceCursor: 3,
        recoverability: 'partial'
      }
    } as const;

    const result = buildEvidenceCenter({
      tasks: [
        {
          id: 'task-ext',
          goal: '整理外部资料',
          sessionId: 'session-ext',
          runId: 'run-ext',
          externalSources: [
            {
              id: 'source-ext',
              taskId: 'task-ext',
              sourceType: 'web',
              sourceUrl: 'https://example.com/report',
              trustClass: 'external',
              summary: '外部报告',
              detail: { score: 0.9 },
              createdAt: '2026-04-08T08:00:00.000Z'
            }
          ],
          trace: [],
          updatedAt: '2026-04-08T08:05:00.000Z'
        },
        {
          id: 'task-trace',
          goal: '复现浏览器路径',
          sessionId: 'session-trace',
          runId: 'run-trace',
          externalSources: [],
          trace: [
            {
              at: '2026-04-08T09:00:00.000Z',
              summary: '打开页面',
              data: {
                toolName: 'browse_page',
                url: 'https://example.com/app',
                snapshotSummary: '页面已经打开',
                stepTrace: ['open page']
              }
            },
            {
              at: '2026-04-08T09:05:00.000Z',
              summary: '普通 trace',
              data: {
                foo: 'bar'
              }
            }
          ],
          updatedAt: '2026-04-08T09:10:00.000Z'
        }
      ] as any,
      jobs: [
        {
          goal: '学习沉淀',
          sources: [
            {
              id: 'job-source-1',
              sourceType: 'document',
              detail: {
                sourceUrl: 'https://example.com/learning',
                screenshotRef: 'shot-1'
              }
            }
          ]
        }
      ],
      getCheckpoint: (sessionId: string) => checkpoints[sessionId as keyof typeof checkpoints] as any,
      wenyuanOverview: {
        memoryCount: 5,
        sessionCount: 2,
        checkpointCount: 3,
        traceCount: 8,
        governanceHistoryCount: 4
      },
      knowledgeOverview: {
        sourceCount: 6,
        chunkCount: 18,
        embeddingCount: 10,
        searchableDocumentCount: 5,
        blockedDocumentCount: 1,
        latestReceipts: [{ id: 'receipt-1', status: 'completed', updatedAt: '2026-04-08T11:59:00.000Z' }]
      }
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'cangjing:overview',
        taskGoal: '藏经阁本地知识链',
        summary: '藏经阁索引 source 6 / searchable 5 / blocked 1',
        createdAt: '2026-04-08T12:00:00.000Z'
      })
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        id: 'wenyuan:overview',
        taskGoal: '文渊阁统一观测',
        summary: '文渊阁汇总 memory 5 / session 2 / checkpoint 3'
      })
    );
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'job-source-1',
          taskGoal: '学习沉淀',
          recoverable: false,
          replay: expect.objectContaining({
            screenshotRef: 'shot-1',
            url: 'https://example.com/learning'
          })
        }),
        expect.objectContaining({
          id: 'source-ext',
          taskGoal: '整理外部资料',
          recoverable: true,
          checkpointRef: {
            sessionId: 'session-ext',
            taskId: 'task-ext',
            checkpointId: 'ck-1',
            checkpointCursor: 9,
            recoverability: 'full'
          }
        }),
        expect.objectContaining({
          id: 'task-trace:0',
          sourceType: 'browser_trace',
          sourceUrl: 'https://example.com/app',
          replay: expect.objectContaining({
            url: 'https://example.com/app',
            snapshotSummary: '页面已经打开',
            stepTrace: ['open page']
          }),
          checkpointRef: {
            sessionId: 'session-trace',
            taskId: 'task-trace',
            checkpointId: 'ck-2',
            checkpointCursor: 3,
            recoverability: 'partial'
          },
          recoverable: true
        }),
        expect.objectContaining({
          id: 'task-trace:1',
          sourceType: 'trace',
          replay: undefined
        })
      ])
    );
  });

  it('returns task trace evidence without checkpoint refs when no session checkpoint exists', () => {
    const result = buildEvidenceCenter({
      tasks: [
        {
          id: 'task-1',
          goal: '只看 trace',
          sessionId: 'session-missing',
          trace: [
            {
              at: '2026-04-08T09:00:00.000Z',
              summary: 'trace only',
              data: {}
            }
          ]
        }
      ] as any,
      jobs: [],
      getCheckpoint: () => undefined
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'task-1:0',
        checkpointRef: undefined,
        recoverable: false
      })
    ]);
  });

  it('reuses the session checkpoint binding for all evidence items of the same task', () => {
    const getCheckpoint = vi.fn(() => ({
      taskId: 'task-1',
      checkpointId: 'ck-1',
      traceCursor: 5,
      recoverability: 'full'
    }));

    const result = buildEvidenceCenter({
      tasks: [
        {
          id: 'task-1',
          goal: '聚合同一 session 的证据',
          sessionId: 'session-1',
          trace: [
            {
              at: '2026-04-08T09:00:00.000Z',
              summary: 'trace-1',
              data: {}
            },
            {
              at: '2026-04-08T09:01:00.000Z',
              summary: 'trace-2',
              data: {}
            }
          ]
        }
      ] as any,
      jobs: [],
      getCheckpoint
    });

    expect(result).toHaveLength(2);
    expect(getCheckpoint).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkpointRef: {
            sessionId: 'session-1',
            taskId: 'task-1',
            checkpointId: 'ck-1',
            checkpointCursor: 5,
            recoverability: 'full'
          },
          recoverable: true
        })
      ])
    );
  });
});
