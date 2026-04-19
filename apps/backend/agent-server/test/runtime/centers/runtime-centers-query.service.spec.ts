import { readFile } from 'node:fs/promises';

import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RuntimeCentersQueryService } from '../../../src/runtime/centers/runtime-centers-query.service';
import { buildPlatformConsole } from '../../../src/runtime/helpers/runtime-platform-console';
import { getDisabledCompanyWorkerIds } from '../../../src/runtime/helpers/runtime-connector-registry';
import { summarizeAndPersistEvalHistory } from '@agent/runtime';
import { loadPromptRegressionConfigSummary } from '../../../src/runtime/helpers/prompt-regression-summary';
import {
  readInstalledSkillRecords,
  readSkillInstallReceipts
} from '../../../src/runtime/skills/runtime-skill-install.service';
import {
  listSkillManifests,
  listSkillSources,
  searchLocalSkillSuggestions
} from '../../../src/runtime/skills/runtime-skill-sources.service';
import { ingestLocalKnowledge, readKnowledgeOverview } from '../../../src/runtime/knowledge/runtime-knowledge-store';

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn()
  };
});

vi.mock('../../../src/runtime/helpers/runtime-connector-registry', () => ({
  getDisabledCompanyWorkerIds: vi.fn(() => ['worker-disabled'])
}));

vi.mock('../../../src/runtime/helpers/runtime-platform-console', () => ({
  buildPlatformConsole: vi.fn(async () => ({ scope: 'console' })),
  exportApprovalsCenter: vi.fn(async () => ({ scope: 'approvals-export' })),
  exportEvalsCenter: vi.fn(async () => ({ scope: 'evals-export' })),
  exportRuntimeCenter: vi.fn(async () => ({ scope: 'runtime-export' }))
}));

vi.mock('@agent/runtime', async importOriginal => {
  const actual = await importOriginal<typeof import('@agent/runtime')>();
  return {
    ...actual,
    summarizeAndPersistEvalHistory: vi.fn(async () => ({ total: 2, outcomes: ['passed'] })),
    summarizeAndPersistUsageAnalytics: vi.fn(async () => ({ summaries: [] }))
  };
});

vi.mock('../../../src/runtime/helpers/prompt-regression-summary', () => ({
  loadPromptRegressionConfigSummary: vi.fn(async () => ({ promptCount: 3, suiteCount: 1 }))
}));

vi.mock('../../../src/runtime/skills/runtime-skill-install.service', () => ({
  readInstalledSkillRecords: vi.fn(async () => [
    { skillId: 'remote-vercel-labs-skills-find-skills', installedAt: '2026-04-01T09:00:00.000Z' }
  ]),
  readSkillInstallReceipts: vi.fn(async () => [{ receiptId: 'receipt-1', installedAt: '2026-04-01T09:00:00.000Z' }])
}));

vi.mock('../../../src/runtime/skills/runtime-skill-sources.service', () => ({
  listSkillSources: vi.fn(async () => [{ id: 'workspace-skills', kind: 'workspace' }]),
  listSkillManifests: vi.fn(async () => [{ id: 'find-skills', displayName: 'find-skills' }]),
  searchLocalSkillSuggestions: vi.fn(async () => ({
    suggestions: [],
    gapSummary: undefined,
    profile: 'platform',
    usedInstalledSkills: []
  }))
}));

vi.mock('../../../src/runtime/knowledge/runtime-knowledge-store', () => ({
  ingestLocalKnowledge: vi.fn(async () => ({
    sourceCount: 0,
    chunkCount: 0,
    embeddingCount: 0,
    searchableDocumentCount: 0,
    blockedDocumentCount: 0,
    latestReceipts: []
  })),
  readKnowledgeOverview: vi.fn(async () => ({
    sourceCount: 0,
    chunkCount: 0,
    embeddingCount: 0,
    searchableDocumentCount: 0,
    blockedDocumentCount: 0,
    latestReceipts: []
  }))
}));

describe('RuntimeCentersQueryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps pending approvals and applies execution-mode and interaction filters', () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          orchestrator: {
            listPendingApprovals: () => [
              {
                id: 'task-terminal',
                goal: 'Inspect production logs',
                status: 'waiting_approval',
                sessionId: 'session-1',
                currentMinistry: 'gongbu',
                currentWorker: 'worker-1',
                executionMode: 'plan',
                streamStatus: { updatedAt: '2026-04-01T10:00:00.000Z' },
                contextFilterState: { active: true },
                pendingApproval: { reasonCode: 'policy-match' },
                activeInterrupt: {
                  kind: 'tool',
                  interactionKind: 'terminal-command',
                  payload: {
                    commandPreview: 'pnpm test',
                    riskReason: 'Writes to disk',
                    riskCode: 'destructive-command',
                    approvalScope: 'workspace-write'
                  }
                },
                entryDecision: { route: 'code' },
                interruptHistory: [{ id: 'interrupt-1' }],
                planDraft: { summary: 'Plan draft' },
                approvals: [{ id: 'approval-1' }]
              },
              {
                id: 'task-question',
                goal: 'Need more input',
                status: 'waiting_approval',
                sessionId: 'session-2',
                currentMinistry: 'libu',
                currentWorker: 'worker-2',
                planMode: 'drafting',
                streamStatus: { updatedAt: '2026-04-01T09:00:00.000Z' },
                pendingApproval: undefined,
                activeInterrupt: {
                  kind: 'user-input',
                  payload: {}
                },
                entryDecision: { route: 'plan' }
              },
              {
                id: 'task-execute',
                goal: 'Ship fix',
                status: 'waiting_approval',
                sessionId: 'session-3',
                currentMinistry: 'hubu',
                currentWorker: 'worker-3',
                executionPlan: { mode: 'execute' },
                pendingApproval: { reasonCode: 'manual' },
                activeInterrupt: {
                  kind: 'approval',
                  payload: {
                    interactionKind: 'approval'
                  }
                },
                entryDecision: { route: 'ship' }
              }
            ]
          }
        }) as any
    );

    const allItems = service.getApprovalsCenter();
    expect(allItems).toHaveLength(3);
    expect(allItems[0]).toMatchObject({
      taskId: 'task-terminal',
      commandPreview: 'pnpm test',
      riskReason: 'Writes to disk',
      riskCode: 'destructive-command',
      approvalScope: 'workspace-write',
      policyMatchStatus: 'manual-pending',
      policyMatchSource: 'manual',
      lastStreamStatusAt: '2026-04-01T10:00:00.000Z'
    });
    expect(allItems[1]).toMatchObject({
      taskId: 'task-question',
      executionMode: 'plan'
    });

    expect(
      service.getApprovalsCenter({
        executionMode: 'plan',
        interactionKind: 'terminal-command'
      })
    ).toHaveLength(1);

    expect(
      service.getApprovalsCenter({
        executionMode: 'plan',
        interactionKind: 'plan-question'
      })
    ).toEqual([
      expect.objectContaining({
        taskId: 'task-question',
        currentWorker: 'worker-2'
      })
    ]);

    expect(
      service.getApprovalsCenter({
        executionMode: 'execute',
        interactionKind: 'approval'
      })
    ).toEqual([
      expect.objectContaining({
        taskId: 'task-execute',
        riskCode: 'manual'
      })
    ]);
  });

  it('builds company agents center using connector disablement state', () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          orchestrator: {
            listTasks: () => [
              {
                id: 'task-1',
                currentWorker: 'worker-disabled',
                usedCompanyWorkers: [],
                updatedAt: '2026-04-01T08:00:00.000Z',
                status: 'completed',
                goal: 'Deliver weekly report',
                runId: 'run-1'
              }
            ],
            listWorkers: () => [
              { id: 'worker-disabled', kind: 'company', requiredConnectors: [] },
              { id: 'worker-ready', kind: 'company', requiredConnectors: ['github'] }
            ]
          },
          getConnectorRegistryContext: () => ({})
        }) as any
    );

    expect(service.getCompanyAgentsCenter()).toEqual([
      expect.objectContaining({
        id: 'worker-disabled',
        enabled: false,
        governanceStatus: 'disabled',
        promotionState: 'validated'
      }),
      expect.objectContaining({
        id: 'worker-ready',
        enabled: true,
        governanceStatus: 'connector-bound',
        totalTaskCount: 0
      })
    ]);
    expect(getDisabledCompanyWorkerIds).toHaveBeenCalledWith({});
  });

  it('loads browser replay payloads and raises not-found when the replay is missing', async () => {
    vi.mocked(readFile).mockResolvedValueOnce('{"events":[{"id":"step-1"}]}');
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          settings: {
            workspaceRoot: '/workspace'
          }
        }) as any
    );

    await expect(service.getBrowserReplay('session-1')).resolves.toEqual({
      events: [{ id: 'step-1' }]
    });
    expect(readFile).toHaveBeenCalledWith('/workspace/data/browser-replays/session-1/replay.json', 'utf8');

    vi.mocked(readFile).mockRejectedValueOnce(new Error('missing'));
    await expect(service.getBrowserReplay('missing-session')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('combines eval history with prompt regression metadata and delegates platform console building', async () => {
    const appLogger = {
      log: vi.fn(),
      warn: vi.fn()
    };
    const context = {
      appLogger,
      getPlatformConsoleContext: () => ({ runtime: 'context' }),
      orchestrator: {
        listTasks: () => [{ id: 'task-1' }]
      },
      runtimeStateRepository: {
        load: vi.fn(async () => ({})),
        save: vi.fn(async () => undefined)
      },
      settings: {
        workspaceRoot: '/workspace'
      }
    };
    vi.mocked(buildPlatformConsole).mockResolvedValueOnce({
      scope: 'console',
      tasks: [{ id: 'task-1' }],
      sessions: [],
      diagnostics: {
        cacheStatus: 'miss',
        generatedAt: '2026-04-01T09:00:00.000Z',
        timingsMs: {
          total: 420,
          runtime: 150,
          approvals: 10,
          evals: 180,
          tasks: 5,
          checkpoints: 1
        }
      }
    } as any);
    const service = new RuntimeCentersQueryService(() => context as any);

    await expect(service.getEvalsCenter(14, { scenarioId: 'scenario-1', outcome: 'passed' })).resolves.toEqual({
      total: 2,
      outcomes: ['passed'],
      promptRegression: { promptCount: 3, suiteCount: 1 }
    });
    expect(summarizeAndPersistEvalHistory).toHaveBeenCalledWith({
      runtimeStateRepository: context.runtimeStateRepository,
      tasks: [{ id: 'task-1' }],
      days: 14,
      filters: { scenarioId: 'scenario-1', outcome: 'passed' }
    });
    expect(loadPromptRegressionConfigSummary).toHaveBeenCalledWith('/workspace');

    await expect(
      service.getPlatformConsole(7, {
        status: 'running',
        runtimeExecutionMode: 'plan',
        approvalsInteractionKind: 'approval'
      })
    ).resolves.toEqual(
      expect.objectContaining({
        scope: 'console'
      })
    );
    expect(buildPlatformConsole).toHaveBeenCalledWith({ runtime: 'context' }, 7, {
      status: 'running',
      runtimeExecutionMode: 'plan',
      approvalsInteractionKind: 'approval'
    });
    expect(appLogger.log).toHaveBeenCalledWith(
      {
        event: 'runtime.platform_console.fresh_aggregate',
        days: 7,
        filters: {
          status: 'running',
          runtimeExecutionMode: 'plan',
          approvalsInteractionKind: 'approval'
        },
        cacheStatus: 'miss',
        timingsMs: {
          total: 420,
          runtime: 150,
          approvals: 10,
          evals: 180,
          tasks: 5,
          checkpoints: 1
        },
        taskCount: 1,
        sessionCount: 0,
        totalDurationMs: 420,
        thresholdMs: 300
      },
      {
        context: 'RuntimeCentersQueryService'
      }
    );
    expect(appLogger.warn).not.toHaveBeenCalled();
  });

  it('warns when platform console aggregation crosses the slow threshold', async () => {
    const appLogger = {
      log: vi.fn(),
      warn: vi.fn()
    };
    vi.mocked(buildPlatformConsole).mockResolvedValueOnce({
      scope: 'console',
      tasks: [{ id: 'task-1' }, { id: 'task-2' }],
      sessions: [{ id: 'session-1' }],
      diagnostics: {
        cacheStatus: 'miss',
        generatedAt: '2026-04-01T09:00:00.000Z',
        timingsMs: {
          total: 1_280,
          runtime: 480,
          approvals: 18,
          evals: 510,
          tasks: 7,
          checkpoints: 3
        }
      }
    } as any);
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          appLogger,
          getPlatformConsoleContext: () => ({ runtime: 'context' })
        }) as any
    );

    await expect(service.getPlatformConsole(30)).resolves.toEqual(
      expect.objectContaining({
        scope: 'console'
      })
    );
    expect(appLogger.warn).toHaveBeenCalledWith(
      {
        event: 'runtime.platform_console.slow',
        days: 30,
        filters: undefined,
        cacheStatus: 'miss',
        timingsMs: {
          total: 1_280,
          runtime: 480,
          approvals: 18,
          evals: 510,
          tasks: 7,
          checkpoints: 3
        },
        taskCount: 2,
        sessionCount: 1,
        totalDurationMs: 1_280,
        thresholdMs: 1_000
      },
      {
        context: 'RuntimeCentersQueryService',
        days: 30,
        filters: undefined,
        cacheStatus: 'miss',
        timingsMs: {
          total: 1_280,
          runtime: 480,
          approvals: 18,
          evals: 510,
          tasks: 7,
          checkpoints: 3
        },
        taskCount: 2,
        sessionCount: 1
      }
    );
    expect(appLogger.log).not.toHaveBeenCalled();
  });

  it('builds skill sources and tools centers, and delegates export helpers', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          getSkillSourcesContext: () => ({ workspaceRoot: '/workspace' }),
          getSkillInstallContext: () => ({ workspaceRoot: '/workspace' }),
          orchestrator: {
            listTasks: () => [
              {
                id: 'task-1',
                goal: 'Continue browse flow',
                updatedAt: '2026-04-01T10:00:00.000Z',
                createdAt: '2026-04-01T09:30:00.000Z',
                status: 'completed',
                usedInstalledSkills: ['installed-skill:remote-vercel-labs-skills-find-skills'],
                toolUsageSummary: [
                  {
                    toolName: 'webSearchPrime',
                    family: 'browser',
                    capabilityType: 'local-tool',
                    status: 'completed',
                    route: 'local',
                    requestedBy: 'bingbu-ops',
                    usedAt: '2026-04-01T10:00:00.000Z'
                  }
                ],
                pendingApproval: {
                  toolName: 'run_terminal',
                  reason: 'Need approval',
                  riskLevel: 'high'
                },
                toolAttachments: [{ toolName: 'webSearchPrime', ownerType: 'task', ownerId: 'task-1' }],
                agentStates: [{ role: 'reviewer', toolCalls: ['tool:webSearchPrime'] }],
                trace: [{ summary: 'Completed browse flow' }]
              }
            ]
          },
          skillRegistry: {
            list: vi.fn(async () => [
              {
                id: 'remote-vercel-labs-skills-find-skills',
                governanceRecommendation: 'allow',
                allowedTools: ['webSearchPrime'],
                compatibility: { profile: 'platform' }
              }
            ])
          },
          toolRegistry: {
            list: () => [
              {
                name: 'webSearchPrime',
                family: 'browser',
                requiresApproval: false,
                capabilityType: 'local-tool'
              },
              {
                name: 'run_terminal',
                family: 'terminal',
                requiresApproval: true,
                capabilityType: 'governance-tool'
              }
            ],
            listFamilies: () => [
              { id: 'browser', displayName: 'Browser' },
              { id: 'terminal', displayName: 'Terminal' }
            ]
          }
        }) as any
    );

    await expect(service.getSkillSourcesCenter()).resolves.toEqual(
      expect.objectContaining({
        sources: [{ id: 'workspace-skills', kind: 'workspace' }],
        manifests: [{ id: 'find-skills', displayName: 'find-skills' }],
        installed: [
          expect.objectContaining({
            skillId: 'remote-vercel-labs-skills-find-skills',
            governanceRecommendation: 'allow',
            activeTaskCount: 0,
            totalTaskCount: 1,
            successRate: 1,
            lastOutcome: 'success'
          })
        ],
        receipts: [{ receiptId: 'receipt-1', installedAt: '2026-04-01T09:00:00.000Z' }]
      })
    );
    expect(listSkillSources).toHaveBeenCalledWith({ workspaceRoot: '/workspace' });
    expect(listSkillManifests).toHaveBeenCalledWith({ workspaceRoot: '/workspace' });
    expect(readInstalledSkillRecords).toHaveBeenCalledWith({ workspaceRoot: '/workspace' });
    expect(readSkillInstallReceipts).toHaveBeenCalledWith({ workspaceRoot: '/workspace' });

    expect(service.getToolsCenter()).toEqual(
      expect.objectContaining({
        totalTools: 2,
        familyCount: 2,
        blockedToolCount: 1,
        approvalRequiredCount: 1,
        governanceToolCount: 1,
        mcpBackedCount: 0
      })
    );

    await expect(service.exportRuntimeCenter({ days: 3 })).resolves.toEqual({ scope: 'runtime-export' });
    await expect(service.exportApprovalsCenter({ executionMode: 'plan' })).resolves.toEqual({
      scope: 'approvals-export'
    });
    await expect(service.exportEvalsCenter({ days: 5 })).resolves.toEqual({ scope: 'evals-export' });
  });

  it('builds learning center with timeout-style local skill fallback and queue summaries', async () => {
    vi.mocked(searchLocalSkillSuggestions).mockRejectedValueOnce(new Error('timeout'));

    const service = new RuntimeCentersQueryService(
      () =>
        ({
          orchestrator: {
            listTasks: () => [
              {
                id: 'task-learn-1',
                goal: 'Review runtime center architecture',
                updatedAt: '2026-04-01T10:00:00.000Z',
                learningQueueItemId: 'queue-1',
                learningCandidates: [
                  {
                    id: 'candidate-1',
                    type: 'memory',
                    status: 'pending_confirmation',
                    autoConfirmEligible: true,
                    createdAt: '2026-04-01T09:00:00.000Z'
                  }
                ],
                learningEvaluation: {
                  score: 91,
                  confidence: 'high',
                  timeoutStats: { count: 1, defaultAppliedCount: 2 },
                  candidateReasons: ['stable preference'],
                  skippedReasons: [],
                  conflictTargets: [],
                  derivedFromLayers: [],
                  expertiseSignals: ['architecture']
                }
              }
            ],
            listLearningJobs: () => [
              {
                id: 'job-1',
                sourceType: 'research',
                conflictDetected: false,
                persistedMemoryIds: ['memory-1'],
                updatedAt: '2026-04-01T10:00:00.000Z'
              }
            ],
            listLearningQueue: () => [
              {
                id: 'queue-1',
                taskId: 'task-learn-1',
                mode: 'dream-task',
                status: 'queued',
                priority: 'high',
                updatedAt: '2026-04-01T10:00:00.000Z'
              },
              {
                id: 'queue-2',
                taskId: 'task-learn-1',
                mode: 'task-learning',
                status: 'running',
                priority: 'normal',
                updatedAt: '2026-04-01T09:30:00.000Z'
              }
            ]
          },
          wenyuanFacade: {
            getOverview: vi.fn(async () => ({
              memoryCount: 2,
              sessionCount: 1,
              checkpointCount: 1,
              traceCount: 3,
              governanceHistoryCount: 1
            })),
            listCrossCheckEvidence: vi.fn(async () => [
              {
                memoryId: 'memory-1',
                record: {
                  id: 'cross-check-1',
                  summary: 'confirmed by source',
                  sourceType: 'web',
                  trustClass: 'verified'
                }
              }
            ]),
            listMemories: vi.fn(async () => [
              {
                id: 'memory-1',
                status: 'invalidated'
              },
              {
                id: 'memory-2',
                status: 'active',
                quarantined: true,
                summary: 'needs review',
                quarantineCategory: 'staleness',
                quarantineRestoreSuggestion: 'refresh source',
                quarantinedAt: '2026-04-01T10:00:00.000Z'
              }
            ])
          },
          ruleRepository: {
            list: vi.fn(async () => [{ id: 'rule-1', status: 'invalidated' }])
          },
          runtimeStateRepository: {
            load: vi.fn(async () => ({
              governance: {
                counselorSelectorConfigs: [],
                learningConflictScan: {
                  scannedAt: '2026-04-01T10:00:00.000Z',
                  conflictPairs: [],
                  mergeSuggestions: [],
                  manualReviewQueue: []
                }
              }
            })),
            save: vi.fn(async () => undefined)
          },
          getSkillSourcesContext: () => ({ workspaceRoot: '/workspace' }),
          settings: {
            workspaceRoot: '/tmp/runtime-centers-query-learning',
            knowledgeRoot: '/tmp/runtime-centers-query-learning/data/knowledge'
          }
        }) as any
    );

    const result = await service.getLearningCenter();
    expect(result.learningQueueSummary).toEqual(
      expect.objectContaining({
        total: 2,
        queued: 1,
        processing: 1,
        dreamTaskQueued: 1,
        taskLearningProcessing: 1
      })
    );
    expect(result.timeoutStats).toEqual({
      timedOutTaskCount: 1,
      defaultAppliedCount: 2
    });
    expect(result.localSkillSuggestions).toEqual([
      expect.objectContaining({
        taskId: 'task-learn-1',
        gapSummary: 'local-skill-suggestions-timeout',
        suggestions: []
      })
    ]);
    expect(result.invalidatedMemories).toBe(1);
    expect(result.quarantinedMemories).toBe(1);
  });

  it('builds a run observability detail bundle from task and checkpoint state', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          orchestrator: {
            listTasks: () => [
              {
                id: 'task-1',
                goal: 'Diagnose execution regression',
                status: 'failed',
                sessionId: 'session-1',
                currentNode: 'approval_interrupt',
                currentMinistry: 'gongbu',
                currentWorker: 'worker-1',
                createdAt: '2026-04-19T09:59:00.000Z',
                updatedAt: '2026-04-19T10:03:00.000Z',
                trace: [
                  {
                    spanId: 'span-1',
                    node: 'gongbu_execute',
                    at: '2026-04-19T10:01:00.000Z',
                    summary: '工部执行并触发回退',
                    status: 'failed',
                    isFallback: true,
                    fallbackReason: 'budget guard triggered'
                  }
                ],
                activeInterrupt: {
                  id: 'interrupt-1',
                  kind: 'approval',
                  status: 'pending',
                  createdAt: '2026-04-19T10:02:00.000Z'
                },
                learningEvaluation: {
                  governanceWarnings: ['Need stronger evidence before auto delivery']
                },
                externalSources: [{ id: 'ev-1', summary: 'CI log points to retry storm', sourceType: 'runtime-log' }]
              }
            ]
          },
          wenyuanFacade: {
            getCheckpoint: () => ({
              checkpointId: 'cp-1',
              sessionId: 'session-1',
              taskId: 'task-1',
              recoverability: 'safe',
              graphState: {
                status: 'failed',
                currentStep: 'approval_interrupt'
              },
              pendingApprovals: [{ id: 'approval-1' }],
              agentStates: [{ id: 'agent-1' }],
              createdAt: '2026-04-19T10:02:30.000Z',
              updatedAt: '2026-04-19T10:02:45.000Z'
            })
          }
        }) as any
    );

    await expect(service.getRunObservatoryDetail('task-1')).resolves.toMatchObject({
      run: {
        taskId: 'task-1',
        currentStage: 'interrupt',
        hasFallback: true,
        hasRecoverableCheckpoint: true
      },
      checkpoints: [expect.objectContaining({ checkpointId: 'cp-1', recoverability: 'safe' })],
      diagnostics: expect.arrayContaining([
        expect.objectContaining({ kind: 'approval_blocked' }),
        expect.objectContaining({ kind: 'recoverable_failure' })
      ])
    });
  });

  it('builds a filtered run observability list from task summaries', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          orchestrator: {
            listTasks: () => [
              {
                id: 'task-1',
                goal: 'Diagnose regression',
                status: 'running',
                sessionId: 'session-1',
                currentNode: 'approval_interrupt',
                executionPlan: { mode: 'plan' },
                activeInterrupt: {
                  id: 'interrupt-1',
                  kind: 'approval',
                  status: 'pending',
                  createdAt: '2026-04-19T10:02:00.000Z'
                },
                trace: [
                  {
                    spanId: 'span-1',
                    node: 'gongbu_execute',
                    at: '2026-04-19T10:01:00.000Z',
                    summary: '工部执行并触发回退',
                    status: 'failed',
                    isFallback: true,
                    modelUsed: 'gpt-5.4-mini'
                  }
                ],
                llmUsage: {
                  promptTokens: 10,
                  completionTokens: 20,
                  totalTokens: 30,
                  estimated: true,
                  measuredCallCount: 0,
                  estimatedCallCount: 1,
                  updatedAt: '2026-04-19T10:03:00.000Z',
                  models: [
                    {
                      model: 'gpt-5.4-mini',
                      promptTokens: 10,
                      completionTokens: 20,
                      totalTokens: 30,
                      callCount: 1,
                      pricingSource: 'estimated'
                    }
                  ]
                },
                createdAt: '2026-04-19T09:59:00.000Z',
                updatedAt: '2026-04-19T10:03:00.000Z'
              },
              {
                id: 'task-2',
                goal: 'Draft plan',
                status: 'completed',
                sessionId: 'session-2',
                executionPlan: { mode: 'execute' },
                trace: [],
                createdAt: '2026-04-19T08:59:00.000Z',
                updatedAt: '2026-04-19T09:03:00.000Z'
              }
            ]
          },
          wenyuanFacade: {
            getCheckpoint: (sessionId: string) =>
              sessionId === 'session-1'
                ? {
                    checkpointId: 'cp-1',
                    sessionId,
                    taskId: 'task-1',
                    recoverability: 'safe',
                    graphState: {
                      status: 'running'
                    },
                    pendingApprovals: [],
                    agentStates: [],
                    createdAt: '2026-04-19T10:02:30.000Z',
                    updatedAt: '2026-04-19T10:02:45.000Z'
                  }
                : undefined
          }
        }) as any
    );

    await expect(
      service.getRunObservatory({
        status: 'running',
        model: 'gpt-5.4-mini',
        pricingSource: 'estimated',
        executionMode: 'plan',
        hasInterrupt: 'true',
        hasFallback: 'true',
        hasRecoverableCheckpoint: 'true',
        q: 'regression'
      })
    ).resolves.toEqual([
      expect.objectContaining({
        taskId: 'task-1',
        hasInterrupt: true,
        hasFallback: true,
        hasRecoverableCheckpoint: true
      })
    ]);
  });

  it('raises not found when the run observability detail task does not exist', async () => {
    const service = new RuntimeCentersQueryService(
      () =>
        ({
          orchestrator: {
            listTasks: () => []
          },
          wenyuanFacade: {
            getCheckpoint: () => undefined
          }
        }) as any
    );

    await expect(service.getRunObservatoryDetail('missing-task')).rejects.toBeInstanceOf(NotFoundException);
  });
});
