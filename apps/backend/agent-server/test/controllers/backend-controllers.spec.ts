import { describe, expect, it, vi } from 'vitest';

import { ApprovalsController } from '../../src/approvals/approvals.controller';
import { EvidenceController } from '../../src/evidence/evidence.controller';
import { LearningController } from '../../src/learning/learning.controller';
import { RulesController } from '../../src/rules/rules.controller';
import { SkillsController } from '../../src/skills/skills.controller';
import { TasksController } from '../../src/tasks/tasks.controller';

describe('backend controllers', () => {
  it('delegates approvals controller endpoints', () => {
    const approvalsService = {
      listPending: vi.fn(() => ['approval-1']),
      approve: vi.fn((id, dto) => ({ id, ...dto, action: 'approve' })),
      reject: vi.fn((id, dto) => ({ id, ...dto, action: 'reject' }))
    };
    const controller = new ApprovalsController(approvalsService as never);

    expect(controller.listPending()).toEqual(['approval-1']);
    expect(controller.approve('task-1', { actor: 'tester' } as any)).toEqual({
      id: 'task-1',
      actor: 'tester',
      action: 'approve'
    });
    expect(controller.reject('task-1', { actor: 'tester' } as any)).toEqual({
      id: 'task-1',
      actor: 'tester',
      action: 'reject'
    });
  });

  it('delegates evidence, learning and rules controller endpoints', () => {
    const evidenceService = {
      getCenter: vi.fn(() => ({ total: 3 }))
    };
    const learningService = {
      getCenter: vi.fn(() => ({ jobs: [] })),
      createDocumentLearningJob: vi.fn(dto => ({ type: 'document', dto })),
      createResearchLearningJob: vi.fn(dto => ({ type: 'research', dto })),
      getLearningJob: vi.fn(id => ({ id }))
    };
    const rulesService = {
      list: vi.fn(() => ['rule-1']),
      invalidate: vi.fn((id, dto) => ({ id, dto, action: 'invalidate' })),
      supersede: vi.fn((id, dto) => ({ id, dto, action: 'supersede' })),
      restore: vi.fn(id => ({ id, action: 'restore' })),
      retire: vi.fn((id, dto) => ({ id, dto, action: 'retire' }))
    };

    const evidenceController = new EvidenceController(evidenceService as never);
    const learningController = new LearningController(learningService as never);
    const rulesController = new RulesController(rulesService as never);

    expect(evidenceController.getCenter()).toEqual({ total: 3 });
    expect(learningController.getCenter()).toEqual({ jobs: [] });
    expect(learningController.createDocumentLearningJob({ documentUri: 'file:///guide.md' } as any)).toEqual({
      type: 'document',
      dto: { documentUri: 'file:///guide.md' }
    });
    expect(learningController.createResearchLearningJob({ goal: 'study adapters' } as any)).toEqual({
      type: 'research',
      dto: { goal: 'study adapters' }
    });
    expect(learningController.getLearningJob('job-1')).toEqual({ id: 'job-1' });
    expect(rulesController.list()).toEqual(['rule-1']);
    expect(rulesController.invalidate('rule-1', { reason: 'stale' } as any)).toEqual({
      id: 'rule-1',
      dto: { reason: 'stale' },
      action: 'invalidate'
    });
    expect(rulesController.supersede('rule-1', { supersededBy: 'rule-2' } as any)).toEqual({
      id: 'rule-1',
      dto: { supersededBy: 'rule-2' },
      action: 'supersede'
    });
    expect(rulesController.restore('rule-1')).toEqual({ id: 'rule-1', action: 'restore' });
    expect(rulesController.retire('rule-1', { reason: 'legacy' } as any)).toEqual({
      id: 'rule-1',
      dto: { reason: 'legacy' },
      action: 'retire'
    });
  });

  it('normalizes skills status filter and delegates tasks controller endpoints', () => {
    const skillsService = {
      listLab: vi.fn(() => ['skill-lab-1']),
      list: vi.fn(status => ({ status })),
      getById: vi.fn(id => ({ id })),
      promote: vi.fn(id => ({ id, action: 'promote' })),
      disable: vi.fn(id => ({ id, action: 'disable' })),
      restore: vi.fn(id => ({ id, action: 'restore' })),
      retire: vi.fn(id => ({ id, action: 'retire' }))
    };
    const tasksService = {
      listTasks: vi.fn(() => ['task-1']),
      createTask: vi.fn(dto => ({ type: 'task', dto })),
      createAgentDiagnosisTask: vi.fn(dto => ({ type: 'diagnosis', dto })),
      getTask: vi.fn(id => ({ id })),
      listTaskTraces: vi.fn(id => ({ id, kind: 'traces' })),
      getTaskAudit: vi.fn(id => ({ id, kind: 'audit' })),
      listTaskAgents: vi.fn(id => ({ id, kind: 'agents' })),
      listTaskMessages: vi.fn(id => ({ id, kind: 'messages' })),
      getTaskPlan: vi.fn(id => ({ id, kind: 'plan' })),
      getTaskReview: vi.fn(id => ({ id, kind: 'review' })),
      getTaskLocalSkillSuggestions: vi.fn(id => ({ id, kind: 'local-skill-suggestions' })),
      retryTask: vi.fn(id => ({ id, action: 'retry' }))
    };

    const skillsController = new SkillsController(skillsService as never);
    const tasksController = new TasksController(tasksService as never);

    expect(skillsController.listLab()).toEqual(['skill-lab-1']);
    expect(skillsController.list('stable' as any)).toEqual({ status: 'stable' });
    expect(skillsController.list('invalid-status' as any)).toEqual({ status: undefined });
    expect(skillsController.getById('skill-1')).toEqual({ id: 'skill-1' });
    expect(skillsController.promote('skill-1')).toEqual({ id: 'skill-1', action: 'promote' });
    expect(skillsController.disable('skill-1')).toEqual({ id: 'skill-1', action: 'disable' });
    expect(skillsController.restore('skill-1')).toEqual({ id: 'skill-1', action: 'restore' });
    expect(skillsController.retire('skill-1')).toEqual({ id: 'skill-1', action: 'retire' });

    expect(tasksController.listTasks()).toEqual(['task-1']);
    expect(tasksController.createTask({ goal: 'ship' } as any)).toEqual({ type: 'task', dto: { goal: 'ship' } });
    expect(tasksController.createAgentDiagnosisTask({ taskId: 'task-1' } as any)).toEqual({
      type: 'diagnosis',
      dto: { taskId: 'task-1' }
    });
    expect(tasksController.getTask('task-1')).toEqual({ id: 'task-1' });
    expect(tasksController.getTaskTraces('task-1')).toEqual({ id: 'task-1', kind: 'traces' });
    expect(tasksController.getTaskAudit('task-1')).toEqual({ id: 'task-1', kind: 'audit' });
    expect(tasksController.getTaskAgents('task-1')).toEqual({ id: 'task-1', kind: 'agents' });
    expect(tasksController.getTaskMessages('task-1')).toEqual({ id: 'task-1', kind: 'messages' });
    expect(tasksController.getTaskPlan('task-1')).toEqual({ id: 'task-1', kind: 'plan' });
    expect(tasksController.getTaskReview('task-1')).toEqual({ id: 'task-1', kind: 'review' });
    expect(tasksController.getTaskLocalSkillSuggestions('task-1')).toEqual({
      id: 'task-1',
      kind: 'local-skill-suggestions'
    });
    expect(tasksController.retryTask('task-1')).toEqual({ id: 'task-1', action: 'retry' });
  });
});
