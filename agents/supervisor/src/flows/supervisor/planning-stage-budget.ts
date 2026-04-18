import type { CreateTaskDto } from '@agent/core';
import type { PlanDraftRecord } from '@agent/core';
import type { PlanningCallbacks, SupervisorPlanningTaskLike } from './pipeline-stage-node.types';

export function applyPlanningMicroBudget<TTask extends SupervisorPlanningTaskLike>(
  task: TTask,
  planDraft: PlanDraftRecord,
  dto: CreateTaskDto,
  callbacks: PlanningCallbacks<TTask>,
  compiledSkillAttachment?: {
    displayName?: string;
    id: string;
    metadata?: {
      steps?: unknown[];
    };
  }
) {
  const budget = planDraft.microBudget;
  if (!budget || budget.readOnlyToolsUsed > 0 || budget.budgetTriggered) {
    return;
  }

  const explorationCandidates = [
    {
      toolName: 'planning.workflow_inspect',
      summary: task.resolvedWorkflow ? `已命中流程模板：${task.resolvedWorkflow.displayName}` : '',
      attachedBy: 'workflow' as const,
      ownerType: 'shared' as const,
      reason: '规划阶段读取流程模板与输出契约。'
    },
    {
      toolName: 'planning.context_digest',
      summary: dto.context?.trim() ? '用户已提供额外上下文，可直接纳入方案' : '',
      attachedBy: 'user' as const,
      ownerType: 'user-attached' as const,
      reason: '规划阶段读取用户补充上下文。'
    },
    {
      toolName: 'planning.specialist_snapshot',
      summary: task.specialistLead ? `主导专家已确定为：${task.specialistLead.displayName}` : '',
      attachedBy: 'specialist' as const,
      ownerType: 'specialist-owned' as const,
      ownerId: task.specialistLead?.id,
      reason: '规划阶段读取已选专家与专项线索。'
    },
    {
      toolName: 'planning.skill_contract_inspect',
      summary: compiledSkillAttachment?.displayName ? `已挂载技能线索：${compiledSkillAttachment.displayName}` : '',
      attachedBy: 'runtime' as const,
      ownerType: 'runtime-derived' as const,
      reason: '规划阶段读取已挂载技能步骤与约束。'
    }
  ].filter(item => item.summary);

  const allowedCount = Math.min(budget.readOnlyToolLimit, explorationCandidates.length);
  const usedCandidates = explorationCandidates.slice(0, allowedCount);
  const skippedCandidates = explorationCandidates.slice(allowedCount);

  for (const candidate of usedCandidates) {
    callbacks.attachTool?.(task, {
      toolName: candidate.toolName,
      attachedBy: candidate.attachedBy,
      ownerType: candidate.ownerType,
      ownerId: candidate.ownerId,
      family: 'plan-readonly',
      preferred: true,
      reason: candidate.reason
    });
    callbacks.recordToolUsage?.(task, {
      toolName: candidate.toolName,
      status: 'used',
      requestedBy: 'runtime-planning',
      reason: candidate.reason,
      route: 'local',
      family: 'plan-readonly',
      capabilityType: 'local-tool',
      riskLevel: 'low'
    });
  }

  for (const candidate of skippedCandidates) {
    callbacks.attachTool?.(task, {
      toolName: candidate.toolName,
      attachedBy: candidate.attachedBy,
      ownerType: candidate.ownerType,
      ownerId: candidate.ownerId,
      family: 'plan-readonly',
      preferred: false,
      reason: 'planning micro-budget 已触顶，未继续展开更多只读探索。'
    });
    callbacks.recordToolUsage?.(task, {
      toolName: candidate.toolName,
      status: 'blocked',
      requestedBy: 'runtime-planning',
      reason: candidate.reason,
      blockedReason: 'planning micro-budget exceeded',
      route: 'local',
      family: 'plan-readonly',
      capabilityType: 'local-tool',
      riskLevel: 'low'
    });
  }

  const replacedPrefixes = ['已命中流程模板：', '用户已提供额外上下文', '主导专家已确定为：', '已挂载技能线索：'];
  planDraft.autoResolved = Array.from(
    new Set([
      ...planDraft.autoResolved.filter(item => !replacedPrefixes.some(prefix => item.startsWith(prefix))),
      ...usedCandidates.map(item => item.summary)
    ])
  );
  planDraft.microBudget = {
    ...budget,
    readOnlyToolsUsed: usedCandidates.length,
    budgetTriggered: skippedCandidates.length > 0
  };
  if (skippedCandidates.length > 0) {
    planDraft.assumptions = Array.from(
      new Set([...(planDraft.assumptions ?? []), '规划阶段只读探索已触顶，剩余未知项直接转为计划提问。'])
    );
    planDraft.questionSet = {
      ...planDraft.questionSet,
      summary: `${planDraft.questionSet?.summary ?? '存在关键未知项。'} 当前 planning micro-budget 已触顶，系统将直接向用户提问收敛。`
    };
    callbacks.addTrace(task, 'budget_exhausted', '规划阶段只读探索预算已触顶，停止继续展开。', {
      family: 'plan-readonly',
      readOnlyToolLimit: budget.readOnlyToolLimit,
      readOnlyToolsUsed: usedCandidates.length,
      skippedTools: skippedCandidates.map(item => item.toolName)
    });
    callbacks.addProgressDelta(task, '规划阶段的只读探索预算已触顶，接下来会直接通过计划问题向你收敛关键决策。');
  } else if (usedCandidates.length > 0) {
    callbacks.addTrace(task, 'planning_research_budget', '规划阶段已完成预算内只读探索。', {
      family: 'plan-readonly',
      readOnlyToolLimit: budget.readOnlyToolLimit,
      readOnlyToolsUsed: usedCandidates.length,
      exploredTools: usedCandidates.map(item => item.toolName)
    });
  }
}
