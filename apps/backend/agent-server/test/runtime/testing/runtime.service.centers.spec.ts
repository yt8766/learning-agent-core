import { describe, expect, it, vi } from 'vitest';

import { collaborators, createService } from './runtime.service.test-helpers';

// activeInterrupt fixtures in this spec represent persisted 司礼监 / InterruptController projections.
describe('RuntimeService centers', () => {
  it('evals center 会暴露 prompt 回归配置概览', async () => {
    const service = createService();

    const evals = await service.getEvalsCenter(30);

    expect(evals.promptRegression).toEqual(
      expect.objectContaining({
        configPath: 'packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml',
        promptCount: expect.any(Number),
        promptSuiteCount: expect.any(Number),
        testCount: expect.any(Number),
        providerCount: expect.any(Number),
        suites: expect.arrayContaining([
          expect.objectContaining({
            suiteId: 'supervisor-plan'
          }),
          expect.objectContaining({
            suiteId: 'hubu-research'
          })
        ])
      })
    );
  });

  it('platform console 在 connectors center 拉取失败时会降级返回', async () => {
    const service = createService();
    vi.spyOn((service as any).centersService, 'getConnectorsCenter').mockRejectedValue(
      new Error('connector discovery failed')
    );

    const consoleRecord = await service.getPlatformConsole(30);

    expect(consoleRecord.connectors).toEqual([]);
    expect(consoleRecord.runtime).toEqual(expect.objectContaining({ taskCount: expect.any(Number) }));
  });

  it('platform console 会按 runtime/approvals 过滤条件裁剪返回', async () => {
    const service = createService();
    collaborators(service).orchestrator.listTasks.mockReturnValue([
      {
        id: 'task-plan',
        goal: '先收敛方案',
        status: 'waiting_interrupt',
        executionMode: 'plan',
        currentMinistry: 'libu',
        currentWorker: 'planner',
        activeInterrupt: {
          kind: 'user-input',
          interactionKind: 'plan-question',
          payload: { interactionKind: 'plan-question' }
        },
        approvals: [],
        trace: [],
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'task-run',
        goal: '直接执行',
        status: 'running',
        executionMode: 'execute',
        currentMinistry: 'gongbu',
        currentWorker: 'executor',
        approvals: [],
        trace: [],
        createdAt: '2026-03-28T01:00:00.000Z',
        updatedAt: '2026-03-28T01:00:00.000Z'
      }
    ]);
    collaborators(service).orchestrator.listPendingApprovals.mockReturnValue([
      {
        id: 'task-plan',
        goal: '先收敛方案',
        status: 'waiting_interrupt',
        executionMode: 'plan',
        currentMinistry: 'libu',
        currentWorker: 'planner',
        activeInterrupt: {
          kind: 'user-input',
          interactionKind: 'plan-question',
          payload: { interactionKind: 'plan-question' }
        },
        approvals: []
      },
      {
        id: 'task-approval',
        goal: '写入配置',
        status: 'waiting_approval',
        executionMode: 'execute',
        currentMinistry: 'gongbu',
        currentWorker: 'executor',
        pendingApproval: {
          intent: 'write_file'
        },
        approvals: []
      }
    ]);

    const consoleRecord = await service.getPlatformConsole(30, {
      runtimeExecutionMode: 'plan',
      runtimeInteractionKind: 'plan-question',
      approvalsExecutionMode: 'plan',
      approvalsInteractionKind: 'plan-question'
    });

    expect(consoleRecord.runtime.recentRuns).toHaveLength(1);
    expect(consoleRecord.runtime.recentRuns[0]?.id).toBe('task-plan');
    expect(consoleRecord.approvals).toHaveLength(1);
    expect(consoleRecord.approvals[0]?.taskId).toBe('task-plan');
  });

  it('approvals center 会透出 streamStatus、文书科压缩元数据与高危审批字段', () => {
    const service = createService();
    collaborators(service).orchestrator.listPendingApprovals.mockReturnValue([
      {
        id: 'task-risky',
        goal: '清理临时目录',
        status: 'waiting_approval',
        executionMode: 'execute',
        currentMinistry: 'gongbu',
        currentWorker: 'gongbu-code',
        streamStatus: {
          nodeId: 'context_filter',
          nodeLabel: '文书科',
          detail: '正在压缩历史上下文',
          progressPercent: 45,
          updatedAt: '2026-03-31T00:00:00.000Z'
        },
        contextFilterState: {
          filteredContextSlice: {
            summary: '已裁剪不相关上下文',
            compressionApplied: true,
            compressionSource: 'llm',
            compressedMessageCount: 12
          }
        },
        activeInterrupt: {
          kind: 'approval',
          source: 'graph',
          intent: 'write_file',
          requestedBy: 'gongbu-code',
          payload: {
            interactionKind: 'approval',
            commandPreview: 'rm -rf /tmp/runtime-cache',
            riskReason: '命中高危命令策略，需要人工确认。',
            riskCode: 'requires_approval_high_risk',
            approvalScope: 'once'
          }
        },
        pendingApproval: {
          intent: 'write_file',
          riskLevel: 'high',
          reason: '需要确认删除操作',
          reasonCode: 'requires_approval_destructive'
        },
        approvals: []
      }
    ]);

    const approvals = service.getApprovalsCenter();

    expect(approvals).toEqual([
      expect.objectContaining({
        taskId: 'task-risky',
        streamStatus: expect.objectContaining({ nodeLabel: '文书科' }),
        contextFilterState: expect.objectContaining({
          filteredContextSlice: expect.objectContaining({
            compressionApplied: true,
            compressionSource: 'llm',
            compressedMessageCount: 12
          })
        }),
        commandPreview: 'rm -rf /tmp/runtime-cache',
        riskReason: '命中高危命令策略，需要人工确认。',
        riskCode: 'requires_approval_high_risk',
        approvalScope: 'once'
      })
    ]);
  });

  it('runtime center 会暴露最近的 agent 级结构化错误', async () => {
    const service = createService();
    collaborators(service).orchestrator.listTasks.mockReturnValue([
      {
        id: 'task-agent-error',
        goal: '检查最近 AI 技术进展',
        status: 'failed',
        currentNode: 'hubu_research',
        currentStep: 'research',
        currentMinistry: 'hubu-search',
        currentWorker: 'hubu-search-worker',
        connectorRefs: [],
        approvals: [],
        messages: [],
        agentStates: [],
        createdAt: '2026-03-27T09:00:00.000Z',
        updatedAt: '2026-03-27T09:00:00.000Z',
        trace: [
          {
            node: 'agent_error',
            at: '2026-03-27T09:01:00.000Z',
            summary: '户部执行失败 timeout',
            data: {
              phase: 'task_pipeline',
              node: 'hubu_research',
              step: 'research',
              ministry: 'hubu-search',
              worker: 'hubu-search-worker',
              errorCode: 'provider_transient_error',
              errorCategory: 'provider',
              errorName: 'TimeoutError',
              errorMessage: 'research provider timeout',
              retryable: true,
              stack: 'TimeoutError: research provider timeout'
            }
          }
        ]
      }
    ]);

    const runtime = await service.getRuntimeCenter();

    expect(runtime.recentAgentErrors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'task-agent-error',
          errorCode: 'provider_transient_error',
          errorCategory: 'provider',
          retryable: true,
          ministry: 'hubu-search',
          diagnosisHint: expect.stringContaining('瞬时波动'),
          recommendedAction: expect.stringContaining('重试'),
          recoveryPlaybook: expect.arrayContaining([expect.stringContaining('重试当前任务')])
        })
      ])
    );
  });

  it('runtime center 会暴露文渊阁/藏经阁知识总览', async () => {
    const service = createService();

    const runtime = await service.getRuntimeCenter();

    expect(runtime.knowledgeOverview).toEqual(
      expect.objectContaining({
        stores: expect.arrayContaining([
          expect.objectContaining({ store: 'wenyuan' }),
          expect.objectContaining({ store: 'cangjing' })
        ]),
        sourceCount: expect.any(Number),
        chunkCount: expect.any(Number),
        embeddingCount: expect.any(Number)
      })
    );
    expect(runtime.dailyTechBriefing).toEqual(
      expect.objectContaining({
        enabled: false,
        schedule: expect.any(String),
        categories: expect.any(Array)
      })
    );
  });

  it('supports explicitly refreshing persisted runtime and eval metrics snapshots', async () => {
    const service = createService();

    const refreshed = await service.refreshMetricsSnapshots(14);

    expect(refreshed).toEqual(
      expect.objectContaining({
        days: 14,
        runtime: expect.objectContaining({
          historyDays: expect.any(Number),
          persistedDailyHistoryCount: expect.any(Number)
        }),
        evals: expect.objectContaining({
          historyDays: expect.any(Number),
          persistedDailyHistoryCount: expect.any(Number)
        })
      })
    );
    expect(collaborators(service).runtimeStateRepository.save).toHaveBeenCalled();
  });
});
