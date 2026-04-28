import type { PlannerStrategyRecord } from '@agent/core';

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
