import { describe, expect, it, vi } from 'vitest';

import {
  buildPlatformConsole,
  exportApprovalsCenter,
  exportEvalsCenter,
  exportRuntimeCenter
} from '../../../src/runtime/helpers/runtime-platform-console';

describe('runtime-platform-console helpers', () => {
  it('builds platform console with fallbacks and checkpoint aggregation', async () => {
    const consoleRecord = await buildPlatformConsole(
      {
        skillRegistry: {
          list: vi.fn(async () => {
            throw new Error('skills unavailable');
          })
        },
        orchestrator: {
          listRules: vi.fn(async () => {
            throw new Error('rules unavailable');
          }),
          listTasks: vi.fn(() => [{ id: 'task-1' }])
        },
        sessionCoordinator: {
          listSessions: vi.fn(() => [
            { id: 'session-1', title: 'runtime', updatedAt: '2026-04-01T00:00:00.000Z' } as any
          ]),
          getCheckpoint: vi.fn((sessionId: string) =>
            sessionId === 'session-1' ? ({ sessionId, taskId: 'task-1' } as any) : undefined
          )
        },
        getRuntimeCenter: vi.fn(async (_days?: number, filters?: Record<string, unknown>) => ({
          scope: 'runtime',
          filters
        })),
        getApprovalsCenter: vi.fn((filters?: Record<string, unknown>) => ({ scope: 'approvals', filters })),
        getLearningCenter: vi.fn(async () => {
          throw new Error('learning unavailable');
        }),
        getEvalsCenter: vi.fn(async () => ({ scope: 'evals' })),
        getEvidenceCenter: vi.fn(async () => ({ scope: 'evidence' })),
        getConnectorsCenter: vi.fn(async () => {
          throw new Error('connectors unavailable');
        }),
        getSkillSourcesCenter: vi.fn(async () => {
          throw new Error('sources unavailable');
        }),
        getCompanyAgentsCenter: vi.fn(() => {
          throw new Error('agents unavailable');
        })
      },
      14,
      {
        status: 'running',
        model: 'gpt-5.4',
        pricingSource: 'provider-billing',
        runtimeExecutionMode: 'plan',
        runtimeInteractionKind: 'plan-question',
        approvalsExecutionMode: 'execute',
        approvalsInteractionKind: 'approval'
      }
    );

    expect(consoleRecord.runtime).toEqual(
      expect.objectContaining({
        scope: 'runtime',
        filters: expect.objectContaining({
          status: 'running',
          executionMode: 'plan',
          interactionKind: 'plan-question'
        })
      })
    );
    expect(consoleRecord.approvals).toEqual(
      expect.objectContaining({
        scope: 'approvals',
        filters: {
          executionMode: 'execute',
          interactionKind: 'approval'
        }
      })
    );
    expect(consoleRecord.skills).toEqual([]);
    expect(consoleRecord.rules).toEqual([]);
    expect(consoleRecord.learning).toEqual(
      expect.objectContaining({
        totalCandidates: 0,
        pendingCandidates: 0
      })
    );
    expect(consoleRecord.skillSources).toEqual({
      sources: [],
      manifests: [],
      installed: [],
      receipts: []
    });
    expect(consoleRecord.connectors).toEqual([]);
    expect(consoleRecord.companyAgents).toEqual([]);
    expect(consoleRecord.tasks).toEqual([{ id: 'task-1' }]);
    expect(consoleRecord.checkpoints).toEqual([
      expect.objectContaining({
        checkpoint: expect.objectContaining({ taskId: 'task-1' })
      })
    ]);
  });

  it('exports runtime center as json and csv with normalized filters', async () => {
    const context = {
      getRuntimeCenter: vi.fn(async () => ({
        usageAnalytics: {
          daily: [
            {
              day: '2026-04-01',
              tokens: 1200,
              costUsd: 1.2,
              costCny: 8.6,
              runs: 3,
              overBudget: false
            }
          ]
        },
        recentRuns: [
          {
            id: 'task-1',
            status: 'waiting_approval',
            executionMode: 'planning-readonly',
            currentMinistry: 'gongbu',
            currentWorker: 'gongbu-code',
            pendingApproval: {
              requestedBy: 'gongbu'
            },
            activeInterrupt: {
              source: 'graph',
              kind: 'user-input',
              payload: {
                interactionKind: 'plan-question'
              }
            },
            streamStatus: {
              nodeLabel: '文书科',
              detail: '压缩上下文',
              progressPercent: 45
            },
            contextFilterState: {
              filteredContextSlice: {
                compressionApplied: true,
                compressionSource: 'llm',
                compressedMessageCount: 12
              }
            },
            updatedAt: '2026-04-01T09:00:00.000Z'
          }
        ],
        dailyTechBriefing: {
          scheduler: 'bree',
          schedule: 'daily 11:00',
          cron: '0 11 * * *',
          scheduleValid: true,
          jobKey: 'daily-tech',
          lastRegisteredAt: '2026-04-01T08:00:00.000Z',
          categories: [
            {
              category: 'ai-tech',
              status: 'sent',
              itemCount: 2,
              emptyDigest: false,
              sentAt: '2026-04-01T11:00:00.000Z'
            }
          ]
        }
      }))
    };

    const jsonExport = await exportRuntimeCenter(context, { days: 7, format: 'json' });
    const csvExport = await exportRuntimeCenter(context, {
      days: 7,
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'billing',
      executionMode: 'planning-readonly',
      interactionKind: 'plan-question'
    });

    expect(jsonExport.filename).toBe('runtime-center-7d.json');
    expect(jsonExport.mimeType).toBe('application/json');
    expect(jsonExport.content).toContain('"usageAnalytics"');
    expect(csvExport.filename).toBe('runtime-center-7d.csv');
    expect(csvExport.content).toContain('day,tokens,costUsd,costCny,runs,overBudget');
    expect(csvExport.content).toContain('"plan"');
    expect(csvExport.content).toContain('dailyTechScheduler');
    expect(csvExport.content).toContain('task-1');
  });

  it('exports approvals and evals center in json and csv formats', async () => {
    const approvalsContext = {
      getApprovalsCenter: vi.fn(() => [
        {
          taskId: 'task-approval',
          status: 'waiting_approval',
          executionMode: 'planning-readonly',
          currentMinistry: 'gongbu',
          currentWorker: 'gongbu-code',
          pendingApproval: {
            requestedBy: 'gongbu',
            intent: 'write_file',
            toolName: 'write_local_file',
            riskLevel: 'high',
            reason: 'needs approval'
          },
          activeInterrupt: {
            source: 'graph',
            payload: {
              interactionKind: 'approval',
              commandPreview: 'rm -rf dist',
              riskReason: 'destructive',
              riskCode: 'requires_approval_destructive',
              approvalScope: 'once'
            }
          },
          policyMatchStatus: 'matched',
          policyMatchSource: 'tool',
          lastStreamStatusAt: '2026-04-01T09:00:00.000Z'
        }
      ])
    };
    const evalsContext = {
      getEvalsCenter: vi.fn(async () => ({
        dailyTrend: [{ day: '2026-04-01', runCount: 3, passCount: 2, passRate: 66 }],
        recentRuns: [
          { taskId: 'task-eval', createdAt: '2026-04-01T09:00:00.000Z', success: true, scenarioIds: ['runtime-smoke'] }
        ],
        promptRegression: {
          suites: [{ suiteId: 'supervisor-plan', label: 'Supervisor Plan', promptCount: 2, versions: ['v1', 'v2'] }]
        }
      }))
    };

    const approvalsJson = await exportApprovalsCenter(approvalsContext, { format: 'json' });
    const approvalsCsv = await exportApprovalsCenter(approvalsContext, {
      executionMode: 'planning-readonly',
      interactionKind: 'approval'
    });
    const evalsJson = await exportEvalsCenter(evalsContext, { days: 30, format: 'json' });
    const evalsCsv = await exportEvalsCenter(evalsContext, { days: 30 });

    expect(approvalsJson.filename).toBe('approvals-center.json');
    expect(approvalsJson.content).toContain('task-approval');
    expect(approvalsCsv.content).toContain('"plan"');
    expect(approvalsCsv.content).toContain('rm -rf dist');
    expect(evalsJson.filename).toBe('evals-center-30d.json');
    expect(evalsJson.content).toContain('runtime-smoke');
    expect(evalsCsv.content).toContain('day,runCount,passCount,passRate');
    expect(evalsCsv.content).toContain('Supervisor Plan');
  });

  it('uses csv defaults and approval fallbacks when interrupt payload fields are absent', async () => {
    const runtimeContext = {
      getRuntimeCenter: vi.fn(async () => ({
        usageAnalytics: {
          persistedDailyHistory: [
            {
              day: '2026-04-02',
              tokens: 900,
              costUsd: 0.9,
              costCny: 6.5,
              runs: 2,
              overBudget: true
            }
          ]
        },
        recentRuns: [
          {
            id: 'task-runtime-2',
            status: 'running',
            executionMode: 'execute',
            currentMinistry: 'hubu',
            currentWorker: 'hubu-search',
            pendingApproval: undefined,
            activeInterrupt: undefined,
            updatedAt: '2026-04-02T09:00:00.000Z'
          }
        ],
        dailyTechBriefing: {
          categories: []
        }
      }))
    };
    const approvalsContext = {
      getApprovalsCenter: vi.fn(() => [
        {
          taskId: 'task-approval-2',
          status: 'waiting_approval',
          executionMode: 'execute',
          currentMinistry: 'hubu',
          currentWorker: 'hubu-search',
          activeInterrupt: {
            kind: 'user-input',
            source: 'graph',
            payload: {}
          }
        }
      ])
    };

    const runtimeCsv = await exportRuntimeCenter(runtimeContext, {});
    const approvalsCsv = await exportApprovalsCenter(approvalsContext, {});

    expect(runtimeCsv.filename).toBe('runtime-center-30d.csv');
    expect(runtimeCsv.content).toContain('2026-04-02,900,0.9,6.5,2,true');
    expect(approvalsCsv.content).toContain('"plan-question"');
    expect(approvalsCsv.content).toContain('"","","",""');
  });
});
