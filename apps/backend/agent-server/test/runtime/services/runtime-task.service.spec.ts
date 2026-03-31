import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { RuntimeTaskService } from '../../../src/runtime/services/runtime-task.service';

describe('RuntimeTaskService', () => {
  const createService = () => {
    const taskRecord = {
      id: 'task-1',
      goal: '检查 AI 技术进展',
      connectorRefs: ['connector-1'],
      usedInstalledSkills: ['skill-1'],
      usedCompanyWorkers: ['worker-1'],
      currentWorker: 'worker-1',
      currentNode: 'hubu_research',
      currentStep: 'research',
      approvals: [{ intent: 'write_file', decision: 'approved', reason: 'ok' }],
      trace: [
        {
          at: '2026-03-27T10:00:00.000Z',
          node: 'research',
          summary: '开始检索',
          data: {
            browserReplay: {
              sessionId: 'browser-1',
              url: 'https://example.com',
              artifactRef: 'artifact-1',
              screenshotRef: 'screenshot-1',
              steps: [{ id: 'step-1' }]
            }
          }
        }
      ],
      updatedAt: '2026-03-27T10:02:00.000Z',
      status: 'running'
    };

    const orchestrator = {
      describeGraph: vi.fn(() => ['Goal Intake']),
      createTask: vi.fn(async (dto: any) => ({ id: 'task-created', ...dto })),
      listTasks: vi.fn(() => [taskRecord]),
      listPendingApprovals: vi.fn(() => [{ id: 'approval-1' }]),
      getTask: vi.fn((id: string) => (id === 'task-1' ? taskRecord : undefined)),
      getTaskAgents: vi.fn(() => [{ role: 'manager' }]),
      getTaskMessages: vi.fn(() => [{ id: 'msg-1' }]),
      getTaskPlan: vi.fn((id: string) => (id === 'task-1' ? { steps: [], subTasks: [] } : undefined)),
      getTaskReview: vi.fn((id: string) => (id === 'task-1' ? { taskId: id, decision: 'approved' } : undefined)),
      retryTask: vi.fn(async (id: string) => (id === 'task-1' ? { id, retried: true } : undefined)),
      applyApproval: vi.fn(async (id: string, dto: any, decision: string) =>
        id === 'task-1' ? { id, dto, decision } : undefined
      ),
      createDocumentLearningJob: vi.fn(async (dto: any) => ({ id: 'job-doc-1', ...dto })),
      createResearchLearningJob: vi.fn(async (dto: any) => ({ id: 'job-research-1', ...dto })),
      getLearningJob: vi.fn((id: string) => (id === 'job-doc-1' ? { id } : undefined))
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => ({
        governanceAudit: [
          {
            id: 'gov-1',
            at: '2026-03-27T10:01:00.000Z',
            scope: 'connector',
            targetId: 'connector-1',
            action: 'disable',
            reason: 'manual',
            outcome: 'ok'
          }
        ],
        usageAudit: [
          {
            taskId: 'task-1',
            updatedAt: '2026-03-27T10:03:00.000Z',
            totalTokens: 1200,
            totalCostUsd: 0.25,
            modelBreakdown: [{ model: 'gpt-5.4', tokens: 1200 }]
          }
        ]
      }))
    };
    const resolveTaskSkillSuggestions = vi.fn(async () => [{ id: 'skill-1' }]);

    return {
      service: new RuntimeTaskService(() => ({
        orchestrator,
        runtimeStateRepository,
        resolveTaskSkillSuggestions
      })),
      orchestrator,
      runtimeStateRepository,
      resolveTaskSkillSuggestions
    };
  };

  it('处理任务查询、诊断、审批和审计聚合', async () => {
    const { service, orchestrator, runtimeStateRepository, resolveTaskSkillSuggestions } = createService();

    expect(service.describeGraph()).toEqual(['Goal Intake']);
    expect(await service.createTask({ goal: 'demo' })).toEqual({ id: 'task-created', goal: 'demo' });
    expect(service.listTasks()).toHaveLength(1);
    expect(service.listPendingApprovals()).toEqual([{ id: 'approval-1' }]);
    expect(service.getTask('task-1')).toEqual(expect.objectContaining({ id: 'task-1' }));
    expect(service.listTaskTraces('task-1')).toHaveLength(1);
    expect(await service.getTaskAudit('task-1')).toEqual(
      expect.objectContaining({
        taskId: 'task-1',
        browserReplays: expect.any(Array),
        entries: expect.arrayContaining([
          expect.objectContaining({ type: 'governance' }),
          expect.objectContaining({ type: 'trace' }),
          expect.objectContaining({ type: 'approval' }),
          expect.objectContaining({ type: 'usage' })
        ])
      })
    );
    expect(service.listTaskAgents('task-1')).toEqual([{ role: 'manager' }]);
    expect(service.listTaskMessages('task-1')).toEqual([{ id: 'msg-1' }]);
    expect(service.getTaskPlan('task-1')).toEqual({ steps: [], subTasks: [] });
    expect(await service.getTaskLocalSkillSuggestions('task-1')).toEqual([{ id: 'skill-1' }]);
    expect(service.getTaskReview('task-1')).toEqual({ taskId: 'task-1', decision: 'approved' });
    expect(await service.retryTask('task-1')).toEqual({ id: 'task-1', retried: true });
    expect(await service.approveTaskAction('task-1', { actor: 'tester' } as never)).toEqual(
      expect.objectContaining({ id: 'task-1', decision: 'approved' })
    );
    expect(await service.rejectTaskAction('task-1', { actor: 'tester' } as never)).toEqual(
      expect.objectContaining({ id: 'task-1', decision: 'rejected' })
    );
    expect(
      await service.createAgentDiagnosisTask({
        taskId: 'task-1',
        errorCode: 'provider_timeout',
        message: 'timeout',
        diagnosisHint: '上游波动'
      })
    ).toEqual(
      expect.objectContaining({
        id: 'task-created',
        context: 'diagnosis_for:task-1',
        constraints: ['prefer-xingbu-diagnosis', 'preserve-trace-context']
      })
    );
    expect(await service.createDocumentLearningJob({ documentUri: 'file:///doc.md' })).toEqual({
      id: 'job-doc-1',
      documentUri: 'file:///doc.md'
    });
    expect(await service.createResearchLearningJob({ goal: 'learn' })).toEqual({
      id: 'job-research-1',
      goal: 'learn'
    });
    expect(service.getLearningJob('job-doc-1')).toEqual({ id: 'job-doc-1' });

    expect(runtimeStateRepository.load).toHaveBeenCalledTimes(1);
    expect(resolveTaskSkillSuggestions).toHaveBeenCalledWith('检查 AI 技术进展', {
      usedInstalledSkills: ['skill-1'],
      limit: 6
    });
    expect(orchestrator.applyApproval).toHaveBeenCalledTimes(2);
  });

  it('任务存在但 review 尚未生成时返回 null，而不是 404', () => {
    const { service, orchestrator } = createService();
    orchestrator.getTaskReview.mockReturnValue(undefined);

    expect(service.getTaskReview('task-1')).toBeNull();
  });

  it('任务存在但没有显式 plan 时返回 fallback plan，而不是 404', () => {
    const { service, orchestrator } = createService();
    orchestrator.getTaskPlan.mockReturnValue(undefined);

    expect(service.getTaskPlan('task-1')).toEqual(
      expect.objectContaining({
        id: 'fallback-plan:task-1',
        steps: expect.any(Array),
        subTasks: expect.arrayContaining([expect.objectContaining({ id: 'task-1:fallback-subtask' })])
      })
    );
  });

  it('对缺失 task/learning job 抛出 NotFoundException', async () => {
    const { service } = createService();

    expect(() => service.getTask('missing-task')).toThrow(NotFoundException);
    expect(() => service.getTaskPlan('missing-task')).toThrow(NotFoundException);
    expect(() => service.getTaskReview('missing-task')).toThrow(NotFoundException);
    expect(() => service.getLearningJob('missing-job')).toThrow(NotFoundException);
    await expect(service.retryTask('missing-task')).rejects.toBeInstanceOf(NotFoundException);
  });
});
