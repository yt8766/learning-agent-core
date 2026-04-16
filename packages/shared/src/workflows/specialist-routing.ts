import type {
  ContextSliceRecord,
  EvidenceRecord,
  RequestedExecutionHints,
  SpecialistDomain,
  SpecialistLeadRecord,
  SpecialistSupportRecord
} from '../types';
import { getSpecialistDisplayName, normalizeSpecialistDomain } from '../types';
import { buildSpecialistFindingOutputInstruction } from '@agent/core';

const SPECIALIST_DISPLAY_NAMES: Record<SpecialistDomain, string> = {
  'general-assistant': '通用助理',
  'product-strategy': '产品策略专家',
  'growth-marketing': '增长投放专家',
  'payment-channel': '支付通道专家',
  'live-ops': '直播互动专家（兼容别名）',
  'risk-compliance': '风控合规专家',
  'technical-architecture': '技术架构专家'
};

const SPECIALIST_RULES: Array<{
  domain: SpecialistDomain;
  leadTokens: string[];
  supportTokens?: string[];
  domainInstruction: string;
}> = [
  {
    domain: 'product-strategy',
    leadTokens: ['产品', '规划', '路线', '版本', '优先级', '商业化', '留存'],
    domainInstruction: '聚焦业务闭环、优先级、收益与用户价值，不要展开无关技术细节。'
  },
  {
    domain: 'growth-marketing',
    leadTokens: ['投放', '增长', '获客', '代理', 'roi', '转化', '裂变', '买量'],
    domainInstruction: '聚焦投放、代理、增长漏斗、转化和 ROI。'
  },
  {
    domain: 'payment-channel',
    leadTokens: ['支付', '入金', '提现', '通道', '客诉', 'success rate'],
    domainInstruction: '聚焦支付链路、通道稳定性、入提转化与支付体验。'
  },
  {
    domain: 'live-ops',
    leadTokens: ['直播', '主播', '挂件', '短剧', 'ugc', '互动', '开播'],
    domainInstruction: '聚焦直播互动、内容心流、主播与社区体验。'
  },
  {
    domain: 'risk-compliance',
    leadTokens: ['风控', '套利', '合规', '审查', '风险', 'jackpot', '封控'],
    domainInstruction: '聚焦风险识别、阻断条件、合规约束和安全边界。'
  },
  {
    domain: 'technical-architecture',
    leadTokens: ['架构', '性能', 'bet', '组推', '服务', '负载', '技术', '重构', '代码', '报表', '看板', 'dashboard'],
    domainInstruction:
      '聚焦架构、实现约束、技术风险、性能与可维护性；如果任务与数据报表相关，优先抽取共享骨架与模块边界。'
  }
];

function toRecord(domain: SpecialistDomain, reason: string): SpecialistLeadRecord {
  const displayName = getSpecialistDisplayName({ domain }) ?? SPECIALIST_DISPLAY_NAMES[domain];
  return {
    id: domain,
    displayName,
    domain,
    reason
  };
}

function toSupport(domain: SpecialistDomain, reason: string): SpecialistSupportRecord {
  const displayName = getSpecialistDisplayName({ domain }) ?? SPECIALIST_DISPLAY_NAMES[domain];
  return {
    id: domain,
    displayName,
    domain,
    reason
  };
}

function normalizeText(goal: string, context?: string) {
  return `${goal}\n${context ?? ''}`.toLowerCase();
}

function scoreDomain(text: string, tokens: string[]) {
  return tokens.reduce((score, token) => (text.includes(token.toLowerCase()) ? score + 1 : score), 0);
}

export function resolveSpecialistRoute(params: {
  goal: string;
  context?: string;
  requestedHints?: RequestedExecutionHints;
  externalSources?: EvidenceRecord[];
  conversationSummary?: string;
  recentTurns?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  relatedHistory?: string[];
}): {
  specialistLead: SpecialistLeadRecord;
  supportingSpecialists: SpecialistSupportRecord[];
  routeConfidence: number;
  contextSlicesBySpecialist: ContextSliceRecord[];
} {
  const text = normalizeText(params.goal, params.context);
  const requestedSpecialist = normalizeRequestedSpecialist(
    params.requestedHints?.requestedSpecialist,
    params.goal,
    params.context
  );
  const ranked = SPECIALIST_RULES.map(rule => ({
    rule,
    score: scoreDomain(text, rule.leadTokens)
  }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score);

  const requestedRule = requestedSpecialist
    ? SPECIALIST_RULES.find(rule => rule.domain === requestedSpecialist)
    : undefined;
  const leadRule = requestedRule ?? ranked[0]?.rule;
  const specialistLead = requestedRule
    ? toRecord(
        requestedRule.domain,
        `已优先遵循你的指定，由 ${SPECIALIST_DISPLAY_NAMES[requestedRule.domain]} 主导本轮判断。`
      )
    : leadRule
      ? toRecord(leadRule.domain, `问题语义与 ${SPECIALIST_DISPLAY_NAMES[leadRule.domain]} 高度相关。`)
      : toRecord('general-assistant', '当前问题领域边界不够明确，先由通用助理主导。');

  const supportingSpecialists = ranked
    .filter(item => item.rule.domain !== specialistLead.domain)
    .slice(0, 3)
    .map(item =>
      toSupport(item.rule.domain, `作为并发支撑专家补充 ${SPECIALIST_DISPLAY_NAMES[item.rule.domain]} 视角。`)
    );

  const topScore = ranked[0]?.score ?? 0;
  const routeConfidence = requestedRule
    ? Math.max(0.72, Math.min(0.96, 0.6 + topScore * 0.08))
    : leadRule && ranked[0]
      ? Math.min(0.95, 0.45 + ranked[0].score * 0.15)
      : 0.32;
  const evidenceRefs = (params.externalSources ?? []).slice(0, 5).map(source => source.id);
  const contextSummary = params.conversationSummary?.trim() || params.context?.trim() || params.goal.trim();
  const recentTurns = (params.recentTurns ?? [])
    .map(turn => ({
      role: turn.role,
      content: turn.content.trim()
    }))
    .filter(turn => turn.content)
    .slice(-2);
  const relatedHistory = (params.relatedHistory ?? [])
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const slices = [specialistLead, ...supportingSpecialists].map(specialist => {
    const rule = SPECIALIST_RULES.find(item => item.domain === specialist.domain);
    return {
      specialistId: specialist.id,
      summary: contextSummary,
      recentTurns: recentTurns.length
        ? recentTurns
        : [
            {
              role: 'user' as const,
              content: params.goal.trim()
            }
          ],
      relatedHistory: relatedHistory.length
        ? relatedHistory
        : params.context
          ? [params.context.trim()].filter(Boolean).slice(0, 2)
          : [],
      evidenceRefs,
      domainInstruction: rule?.domainInstruction ?? '聚焦用户当前问题，给出直接、清晰的专业支持。',
      outputInstruction: buildSpecialistFindingOutputInstruction()
    } satisfies ContextSliceRecord;
  });

  return {
    specialistLead,
    supportingSpecialists,
    routeConfidence,
    contextSlicesBySpecialist: slices
  };
}

function normalizeRequestedSpecialist(
  requested?: string,
  goal?: string,
  context?: string
): SpecialistDomain | undefined {
  if (!requested) {
    return undefined;
  }

  const normalized = requested.trim().toLowerCase();
  const canonical = normalizeSpecialistDomain({ domain: normalized, goal, context });
  if (canonical === 'general-assistant') {
    return 'general-assistant';
  }
  const matched = SPECIALIST_RULES.find(rule => rule.domain === canonical);
  return matched?.domain;
}
