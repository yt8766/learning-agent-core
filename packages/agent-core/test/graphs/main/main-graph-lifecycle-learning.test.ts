import { describe, expect, it, vi } from 'vitest';

import {
  createLifecycleDocumentLearningJob,
  createLifecycleResearchLearningJob,
  enqueueLifecycleTaskLearning,
  getLifecycleLearningJob,
  listLifecycleLearningJobs,
  listLifecycleLearningQueue,
  listLifecycleRules,
  processLifecycleLearningQueue,
  scanLifecycleLearningConflicts,
  updateLifecycleLearningConflictStatus
} from '../../../src/graphs/main/lifecycle/main-graph-lifecycle-learning';

describe('main-graph lifecycle learning helpers', () => {
  it('scans active memory conflicts and persists governance suggestions', async () => {
    const load = vi.fn(async () => ({}));
    const save = vi.fn(async () => undefined);
    const result = await scanLifecycleLearningConflicts({
      memoryRepository: {
        list: vi.fn(async () => [
          {
            id: 'mem-1',
            contextSignature: 'sig-a',
            conflictSetId: 'set-a',
            effectiveness: 0.82,
            status: 'active'
          },
          {
            id: 'mem-2',
            contextSignature: 'sig-a',
            conflictSetId: 'set-a',
            effectiveness: 0.8,
            status: 'active'
          },
          {
            id: 'mem-3',
            contextSignature: 'sig-b',
            effectiveness: 0.4,
            status: 'superseded'
          }
        ])
      } as any,
      runtimeStateRepository: {
        load,
        save
      } as any
    });

    expect(result?.conflictPairs).toEqual([
      expect.objectContaining({
        id: 'conflict:set-a',
        severity: 'high',
        resolution: 'plan_question_required',
        memoryIds: ['mem-1', 'mem-2']
      })
    ]);
    expect(result?.manualReviewQueue).toHaveLength(1);
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        governance: expect.objectContaining({
          learningConflictScan: expect.objectContaining({
            mergeSuggestions: expect.arrayContaining([
              expect.objectContaining({
                conflictId: 'conflict:set-a'
              })
            ])
          })
        })
      })
    );
  });

  it('processes lifecycle learning queue with auto-confirm, missing-task and priority limits', async () => {
    const task = {
      id: 'task-1',
      runId: 'run-1',
      trace: [],
      result: 'done',
      updatedAt: '2026-04-01T09:00:00.000Z',
      learningCandidates: [{ id: 'cand-1', autoConfirmEligible: true }],
      learningEvaluation: { autoConfirmCandidateIds: ['cand-1'], score: 90 }
    } as any;
    const tasks = new Map([['task-1', task]]);
    const learningQueue = new Map<string, any>([
      [
        'queue-task',
        {
          id: 'queue-task',
          taskId: 'task-1',
          status: 'queued',
          priority: 'high',
          updatedAt: '2026-04-01T09:00:00.000Z'
        }
      ],
      [
        'queue-missing',
        {
          id: 'queue-missing',
          taskId: 'task-missing',
          status: 'queued',
          priority: 'normal',
          updatedAt: '2026-04-01T08:00:00.000Z'
        }
      ]
    ]);
    const ensureCandidates = vi.fn();
    const confirmCandidates = vi.fn(async () => undefined);
    const persistAndEmitTask = vi.fn(async () => undefined);

    const processed = await processLifecycleLearningQueue(
      {
        tasks,
        learningQueue,
        learningFlow: {
          ensureCandidates,
          confirmCandidates
        } as any,
        persistAndEmitTask
      },
      2
    );

    expect(processed).toEqual([
      expect.objectContaining({
        id: 'queue-task',
        status: 'completed',
        aggregationResult: 'done'
      }),
      expect.objectContaining({
        id: 'queue-missing',
        status: 'failed',
        userFeedback: 'task_not_found'
      })
    ]);
    expect(ensureCandidates).toHaveBeenCalledWith(task);
    expect(confirmCandidates).toHaveBeenCalledWith(task, ['cand-1']);
    expect(persistAndEmitTask).toHaveBeenCalledWith(task);
  });

  it('updates conflict status and exposes learning jobs, rules and queue items', async () => {
    const load = vi.fn(async () => ({
      governance: {
        learningConflictScan: {
          conflictPairs: [
            {
              id: 'conflict:set-a',
              status: 'open',
              preferredMemoryId: 'mem-1',
              updatedAt: '2026-04-01T09:00:00.000Z'
            }
          ],
          manualReviewQueue: [
            {
              id: 'conflict:set-a',
              status: 'open',
              preferredMemoryId: 'mem-1',
              updatedAt: '2026-04-01T09:00:00.000Z'
            }
          ]
        }
      }
    }));
    const save = vi.fn(async () => undefined);
    const learningQueue = new Map<string, any>();
    const task = {
      id: 'task-2',
      runId: 'run-2',
      trace: [],
      review: { decision: 'blocked' },
      approvalFeedback: 'rollback requested',
      learningEvaluation: { score: 81, timeoutStats: { defaultAppliedCount: 1 } }
    } as any;

    const queued = enqueueLifecycleTaskLearning({ learningQueue }, task, 'needs review');
    expect(queued).toEqual(
      expect.objectContaining({
        taskId: 'task-2',
        priority: 'high',
        reason: 'blocked_review',
        userFeedback: 'needs review'
      })
    );
    expect(listLifecycleLearningQueue({ learningQueue }).map(item => item.mode)).toEqual(
      expect.arrayContaining(['task-learning', 'dream-task'])
    );

    const updated = await updateLifecycleLearningConflictStatus(
      {
        runtimeStateRepository: {
          load,
          save
        } as any
      },
      'conflict:set-a',
      'merged',
      'mem-2'
    );
    expect(updated).toEqual(
      expect.objectContaining({
        id: 'conflict:set-a',
        status: 'merged',
        preferredMemoryId: 'mem-2'
      })
    );

    const learningJobsRuntime = {
      createDocumentLearningJob: vi.fn(dto => ({ id: 'job-doc', dto })),
      createResearchLearningJob: vi.fn(dto => ({ id: 'job-research', dto })),
      getLearningJob: vi.fn(jobId => ({ id: jobId })),
      listLearningJobs: vi.fn(() => [{ id: 'job-doc' }, { id: 'job-research' }])
    };
    const ruleRepository = {
      list: vi.fn(async () => [{ id: 'rule-1' }])
    };

    await expect(listLifecycleRules({ ruleRepository } as any)).resolves.toEqual([{ id: 'rule-1' }]);
    await expect(
      createLifecycleDocumentLearningJob({ learningJobsRuntime } as any, { documentUri: 'file:///doc.md' } as any)
    ).resolves.toEqual({ id: 'job-doc', dto: { documentUri: 'file:///doc.md' } });
    await expect(
      createLifecycleResearchLearningJob({ learningJobsRuntime } as any, { goal: 'study routing' } as any)
    ).resolves.toEqual({ id: 'job-research', dto: { goal: 'study routing' } });
    expect(getLifecycleLearningJob({ learningJobsRuntime } as any, 'job-doc')).toEqual({ id: 'job-doc' });
    expect(listLifecycleLearningJobs({ learningJobsRuntime } as any)).toEqual([
      { id: 'job-doc' },
      { id: 'job-research' }
    ]);
  });

  it('handles auto-preferred conflicts and empty lifecycle learning state', async () => {
    const save = vi.fn(async () => undefined);
    const scan = await scanLifecycleLearningConflicts({
      memoryRepository: {
        list: vi.fn(async () => [
          {
            id: 'mem-top',
            contextSignature: 'sig-auto',
            effectiveness: 0.95,
            status: 'active'
          },
          {
            id: 'mem-low',
            contextSignature: 'sig-auto',
            effectiveness: 0.6,
            status: 'active'
          }
        ])
      } as any,
      runtimeStateRepository: {
        load: vi.fn(async () => ({})),
        save
      } as any
    });

    expect(scan?.conflictPairs).toEqual([
      expect.objectContaining({
        id: 'conflict:sig-auto',
        severity: 'low',
        resolution: 'auto_preferred',
        preferredMemoryId: 'mem-top'
      })
    ]);
    expect(scan?.manualReviewQueue).toEqual([]);
    expect(
      await updateLifecycleLearningConflictStatus(
        {
          runtimeStateRepository: {
            load: vi.fn(async () => ({})),
            save
          } as any
        },
        'conflict:missing',
        'merged'
      )
    ).toBeUndefined();
    await expect(
      processLifecycleLearningQueue(
        {
          tasks: new Map(),
          learningQueue: new Map(),
          learningFlow: {
            ensureCandidates: vi.fn(),
            confirmCandidates: vi.fn()
          } as any,
          persistAndEmitTask: vi.fn(async () => undefined)
        },
        1
      )
    ).resolves.toEqual([]);
  });

  it('enqueues and materializes dream-task items for high-value blocked runs', async () => {
    const learningQueue = new Map<string, any>();
    const task = {
      id: 'task-dream',
      runId: 'run-dream',
      trace: [],
      result: 'need retrospection',
      review: { decision: 'blocked' },
      learningEvaluation: { score: 90, notes: ['用户纠正了执行偏好'] },
      learningCandidates: [
        { id: 'mem-1', type: 'memory' },
        { id: 'rule-1', type: 'rule' }
      ],
      updatedAt: '2026-04-01T09:00:00.000Z'
    } as any;

    const queued = enqueueLifecycleTaskLearning({ learningQueue }, task, 'please learn');

    expect(queued.mode).toBe('task-learning');
    expect([...learningQueue.values()].map(item => item.mode)).toEqual(
      expect.arrayContaining(['task-learning', 'dream-task'])
    );

    const tasks = new Map([[task.id, task]]);
    const ensureCandidates = vi.fn();
    const confirmCandidates = vi.fn(async () => undefined);
    const persistAndEmitTask = vi.fn(async () => undefined);

    const processed = await processLifecycleLearningQueue(
      {
        tasks,
        learningQueue,
        learningFlow: {
          ensureCandidates,
          confirmCandidates
        } as any,
        persistAndEmitTask
      },
      5
    );

    expect(processed.some(item => item.mode === 'dream-task' && item.status === 'completed')).toBe(true);
    expect(task.backgroundLearningState).toEqual(
      expect.objectContaining({
        status: 'completed'
      })
    );
    expect(persistAndEmitTask).toHaveBeenCalled();
  });

  it('keeps lightweight conflicts open and reopens manual review entries when needed', async () => {
    const save = vi.fn(async () => undefined);
    const scan = await scanLifecycleLearningConflicts({
      memoryRepository: {
        list: vi.fn(async () => [
          {
            id: 'mem-a',
            contextSignature: 'sig-light',
            effectiveness: 0.74,
            status: 'active'
          },
          {
            id: 'mem-b',
            contextSignature: 'sig-light',
            effectiveness: 0.69,
            status: 'active'
          }
        ])
      } as any,
      runtimeStateRepository: {
        load: vi.fn(async () => ({})),
        save
      } as any
    });

    expect(scan?.conflictPairs).toEqual([
      expect.objectContaining({
        id: 'conflict:sig-light',
        severity: 'medium',
        resolution: 'lightweight_review_required'
      })
    ]);

    const reopened = await updateLifecycleLearningConflictStatus(
      {
        runtimeStateRepository: {
          load: vi.fn(async () => ({
            governance: {
              learningConflictScan: {
                conflictPairs: [
                  {
                    id: 'conflict:sig-light',
                    status: 'merged',
                    preferredMemoryId: 'mem-a',
                    updatedAt: '2026-04-01T09:00:00.000Z'
                  }
                ],
                manualReviewQueue: []
              }
            }
          })),
          save
        } as any
      },
      'conflict:sig-light',
      'open',
      'mem-b'
    );

    expect(reopened).toEqual(
      expect.objectContaining({
        id: 'conflict:sig-light',
        status: 'open',
        preferredMemoryId: 'mem-b'
      })
    );
  });
});
