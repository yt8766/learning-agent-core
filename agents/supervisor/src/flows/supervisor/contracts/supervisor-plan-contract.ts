import type { ManagerPlan, PlannerStrategyRecord } from '@agent/core';
import { AgentRole } from '../supervisor-architecture-helpers';

import type { SupervisorPlanOutput } from '../schemas/supervisor-plan-schema';

export interface SupervisorPlanContext {
  taskId: string;
  goal: string;
  specialistLead?: {
    displayName: string;
    domain: string;
    requiredCapabilities?: string[];
    candidateAgentIds?: string[];
  };
  supportingSpecialists?: Array<{
    displayName: string;
    domain: string;
    requiredCapabilities?: string[];
    candidateAgentIds?: string[];
  }>;
}

export interface PlannerStrategyLead {
  displayName: string;
  domain?: string;
  requiredCapabilities?: string[];
  agentId?: string;
  candidateAgentIds?: string[];
}

export interface PlannerStrategyContext {
  specialistLead?: PlannerStrategyLead;
}

export function derivePlannerStrategyRecord(
  context: PlannerStrategyContext,
  now = new Date().toISOString()
): PlannerStrategyRecord {
  const lead = context.specialistLead;
  const candidateAgentIds = lead?.candidateAgentIds ?? [];
  const requiredCapabilities = lead?.requiredCapabilities;
  const gapDetected = Boolean(requiredCapabilities?.length) && candidateAgentIds.length === 0;
  const hasRichCandidates = candidateAgentIds.length >= 2;

  return {
    mode: gapDetected ? 'capability-gap' : hasRichCandidates ? 'rich-candidates' : 'default',
    summary: gapDetected
      ? `当前主导专家 ${lead?.displayName ?? '未命名专家'} 所需能力尚未命中官方 Agent，规划需要先确认 capability gap 与替代路径。`
      : hasRichCandidates
        ? `当前主导专家 ${lead?.displayName ?? '未命名专家'} 命中了 ${candidateAgentIds.length} 个候选官方 Agent，规划需要先并行研究后再收敛。`
        : `当前主导专家 ${lead?.displayName ?? '未命名专家'} 已形成单一路径规划，可按默认研究 -> 执行 -> 评审策略推进。`,
    leadDomain: lead?.domain,
    requiredCapabilities,
    preferredAgentId: lead?.agentId ?? candidateAgentIds[0],
    candidateAgentIds: candidateAgentIds.length ? candidateAgentIds : undefined,
    candidateCount: candidateAgentIds.length,
    gapDetected,
    updatedAt: now
  };
}

function inferRequiredCapabilities(subTask: {
  title: string;
  description: string;
  assignedTo: AgentRole;
}): string[] | undefined {
  const normalized = `${subTask.title} ${subTask.description}`.toLowerCase();

  if (/风险|合规|审查|review|复核/.test(normalized) || subTask.assignedTo === AgentRole.REVIEWER) {
    return ['specialist.risk-compliance'];
  }

  if (/架构|技术|重构|代码|实现|性能|报表|dashboard|看板/.test(normalized)) {
    return ['specialist.technical-architecture'];
  }

  return undefined;
}

export function inferDispatchKind(subTask: {
  title: string;
  description: string;
  assignedTo: AgentRole;
}): 'strategy' | 'ministry' | 'fallback' {
  const normalized = `${subTask.title} ${subTask.description}`.toLowerCase();
  if (subTask.assignedTo === AgentRole.MANAGER || /兜底|保底|直接回答|整理答复|通用助理/.test(normalized)) {
    return 'fallback';
  }
  if (/策略|约束|路线|风险|架构|投放|支付|产品|合规|票拟/.test(normalized)) {
    return 'strategy';
  }
  return 'ministry';
}

export function buildFallbackSupervisorPlan(context: SupervisorPlanContext): SupervisorPlanOutput {
  const strategy = derivePlannerStrategyRecord(context);
  const lead = context.specialistLead;
  const leadCapabilities = strategy.requiredCapabilities?.length
    ? strategy.requiredCapabilities
    : ['specialist.technical-architecture'];
  const reviewCapabilities = context.supportingSpecialists?.find(item => item.domain === 'risk-compliance')
    ?.requiredCapabilities ?? ['specialist.risk-compliance'];
  const candidateCount = strategy.candidateCount;
  const hasCapabilityGap = strategy.mode === 'capability-gap';
  const hasRichCandidates = strategy.mode === 'rich-candidates';

  return {
    summary: hasCapabilityGap
      ? `首辅识别到 ${lead?.displayName ?? '当前主导专家'} 所需能力暂未命中官方 Agent，已优先转为“能力缺口确认 -> 低风险执行 -> 风险复核”的三阶段规划。`
      : hasRichCandidates
        ? `首辅已基于 ${lead?.displayName ?? '当前主导专家'} 的多候选 specialist 线索，拆分为“并行研究 -> 收敛执行 -> 风险复核”三个阶段。`
        : '首辅已将任务拆分为研究、执行、评审三个阶段。',
    steps: hasCapabilityGap
      ? ['确认能力缺口与替代路径', '执行低风险可落地动作', '复核风险并决定是否补足能力']
      : hasRichCandidates
        ? ['并行研究候选 specialist 视角', '执行最合适的动作', '评审结果并沉淀经验']
        : ['研究相关上下文', '执行最合适的动作', '评审结果并沉淀经验'],
    subTasks: [
      {
        title: hasCapabilityGap ? '确认能力缺口' : '研究上下文',
        description: hasCapabilityGap
          ? `确认 ${lead?.displayName ?? '主导专家'} 所需能力是否缺失，并检索可替代的技能、连接器或通用执行路径：${context.goal}`
          : hasRichCandidates
            ? `结合 ${candidateCount} 个候选 specialist 线索，检索与目标相关的历史记忆、规则和技能：${context.goal}`
            : `检索与目标相关的历史记忆、规则和技能：${context.goal}`,
        assignedTo: AgentRole.RESEARCH,
        requiredCapabilities: leadCapabilities
      },
      {
        title: '执行任务',
        description: hasCapabilityGap
          ? `在能力尚未完全补足前，优先围绕目标执行最合适的低风险方案，并记录仍需补足的 capability：${context.goal}`
          : hasRichCandidates
            ? `围绕候选 specialist 中最合适的方案收敛执行路径：${context.goal}`
            : `围绕目标执行最合适的方案：${context.goal}`,
        assignedTo: AgentRole.EXECUTOR,
        requiredCapabilities: leadCapabilities
      },
      {
        title: '评审结果',
        description: hasCapabilityGap
          ? `评审执行质量、能力缺口风险与后续补足路径，并决定是否沉淀经验：${context.goal}`
          : `评审执行质量并决定是否沉淀经验：${context.goal}`,
        assignedTo: AgentRole.REVIEWER,
        requiredCapabilities: reviewCapabilities
      }
    ]
  };
}

export function toManagerPlan(context: SupervisorPlanContext, output: SupervisorPlanOutput): ManagerPlan {
  return {
    id: `plan_${context.taskId}`,
    goal: context.goal,
    summary: output.summary,
    steps: output.steps,
    subTasks: output.subTasks.map((subTask, index) => ({
      id: `sub_${context.taskId}_${index + 1}`,
      title: subTask.title,
      description: subTask.description,
      assignedTo: subTask.assignedTo,
      requiredCapabilities:
        subTask.requiredCapabilities ??
        (subTask.assignedTo === AgentRole.REVIEWER
          ? context.supportingSpecialists?.find(item => item.domain === 'risk-compliance')?.requiredCapabilities
          : context.specialistLead?.requiredCapabilities) ??
        inferRequiredCapabilities(subTask),
      status: 'pending'
    })),
    createdAt: new Date().toISOString()
  };
}
