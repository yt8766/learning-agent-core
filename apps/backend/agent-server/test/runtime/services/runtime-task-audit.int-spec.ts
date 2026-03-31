import { describe, expect, it, vi } from 'vitest';

import { RuntimeTaskService } from '../../../src/runtime/services/runtime-task.service';

function createService() {
  const taskRecord = {
    id: 'task-int-1',
    goal: '检查支付通道异常并给出恢复建议',
    connectorRefs: ['connector-1'],
    usedInstalledSkills: ['payment-diagnosis'],
    usedCompanyWorkers: ['worker-ops'],
    currentWorker: 'worker-ops',
    currentNode: 'xingbu_review',
    currentStep: 'review',
    approvals: [{ intent: 'switch_connector', decision: 'approved', reason: 'manual ok' }],
    trace: [
      {
        spanId: 'span-root',
        at: '2026-03-27T10:00:00.000Z',
        node: 'supervisor_plan',
        summary: '开始规划',
        latencyMs: 80
      },
      {
        spanId: 'span-child',
        parentSpanId: 'span-root',
        at: '2026-03-27T10:00:01.000Z',
        node: 'gongbu_ops',
        summary: '执行通道切换',
        latencyMs: 220,
        data: {
          toolName: 'browse_page',
          sessionId: 'browser-2',
          url: 'https://ops.example.com',
          artifactRef: 'artifact-2',
          screenshotRef: 'screenshot-2',
          steps: [{ id: 'step-1' }, { id: 'step-2' }]
        }
      }
    ],
    updatedAt: '2026-03-27T10:03:00.000Z',
    status: 'running'
  };

  const orchestrator = {
    getTask: vi.fn((id: string) => (id === 'task-int-1' ? taskRecord : undefined)),
    applyApproval: vi.fn(async (id: string, dto: any, decision: string) =>
      id === 'task-int-1' ? { id, dto, decision, status: 'running' } : undefined
    )
  };

  const runtimeStateRepository = {
    load: vi.fn(async () => ({
      governanceAudit: [
        {
          id: 'gov-1',
          at: '2026-03-27T10:01:30.000Z',
          scope: 'connector',
          targetId: 'connector-1',
          action: 'switch',
          reason: '切流到备用通道',
          outcome: 'ok'
        }
      ],
      usageAudit: [
        {
          taskId: 'task-int-1',
          updatedAt: '2026-03-27T10:04:00.000Z',
          totalTokens: 980,
          totalCostUsd: 0.18,
          modelBreakdown: [{ model: 'gpt-5.4', tokens: 980 }]
        }
      ]
    }))
  };

  const service = new RuntimeTaskService(() => ({
    orchestrator,
    runtimeStateRepository,
    resolveTaskSkillSuggestions: vi.fn(async () => [])
  }));

  return {
    service,
    orchestrator,
    runtimeStateRepository
  };
}

describe('RuntimeTaskService audit integration', () => {
  it('aggregates trace, browser replay, governance, usage and approval actions in one audit flow', async () => {
    const { service, orchestrator, runtimeStateRepository } = createService();

    const audit = await service.getTaskAudit('task-int-1');
    const approved = await service.approveTaskAction('task-int-1', { actor: 'tester' } as never);
    const rejected = await service.rejectTaskAction('task-int-1', { actor: 'tester', feedback: '补回滚方案' } as never);

    expect(runtimeStateRepository.load).toHaveBeenCalledTimes(1);
    expect(audit).toEqual(
      expect.objectContaining({
        taskId: 'task-int-1',
        browserReplays: [
          expect.objectContaining({
            sessionId: 'browser-2',
            stepCount: 2
          })
        ],
        entries: expect.arrayContaining([
          expect.objectContaining({ type: 'trace', title: 'supervisor_plan' }),
          expect.objectContaining({ type: 'trace', title: 'gongbu_ops' }),
          expect.objectContaining({ type: 'governance', summary: 'connector:connector-1' }),
          expect.objectContaining({ type: 'approval', summary: 'approved' }),
          expect.objectContaining({ type: 'usage', summary: '980 tokens / $0.1800' })
        ]),
        traceSummary: expect.objectContaining({
          criticalPaths: [
            expect.objectContaining({
              pathLabel: 'supervisor_plan -> gongbu_ops',
              totalLatencyMs: 300
            })
          ],
          slowestSpan: expect.objectContaining({
            node: 'gongbu_ops',
            latencyMs: 220
          })
        })
      })
    );

    expect(approved).toEqual(expect.objectContaining({ decision: 'approved' }));
    expect(rejected).toEqual(expect.objectContaining({ decision: 'rejected' }));
    expect(orchestrator.applyApproval).toHaveBeenCalledTimes(2);
  });
});
