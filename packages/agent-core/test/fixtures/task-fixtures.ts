import { TaskStatus } from '@agent/shared';

// Legacy executionMode aliases stay in fixtures only to verify canonical executionPlan.mode normalization.
export function buildWaitingApprovalTask() {
  return {
    id: 'task-1',
    goal: '安装远程 skill',
    status: TaskStatus.WAITING_APPROVAL,
    currentStep: 'waiting_skill_install_approval',
    pendingApproval: {
      intent: 'install_skill',
      riskLevel: 'medium',
      reason: '需要先安装 find-skills。'
    },
    trace: [
      {
        node: 'approval_gate',
        at: '2026-03-29T00:00:00.000Z',
        summary: '等待安装审批'
      }
    ],
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:01.000Z'
  };
}

export function buildPlanningReadonlyTask() {
  return {
    id: 'task-2',
    goal: '先收敛方案再决定是否实现',
    status: TaskStatus.RUNNING,
    currentStep: 'research',
    currentMinistry: 'hubu-search',
    // Legacy compatibility sample: canonical output should still read this as executionPlan.mode = plan.
    executionMode: 'planning-readonly',
    planDraft: {
      summary: '先收敛方案。',
      autoResolved: [],
      openQuestions: ['验证范围如何收口？'],
      assumptions: [],
      microBudget: {
        readOnlyToolLimit: 3,
        readOnlyToolsUsed: 2,
        budgetTriggered: false
      }
    },
    trace: [
      {
        node: 'planning_readonly_guard',
        at: '2026-03-29T00:00:00.000Z',
        summary: '规划阶段已启用只读研究边界。'
      }
    ],
    createdAt: '2026-03-29T00:00:00.000Z',
    updatedAt: '2026-03-29T00:00:01.000Z'
  };
}
