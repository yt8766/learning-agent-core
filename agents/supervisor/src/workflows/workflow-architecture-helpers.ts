import type { ContextSliceRecord, SpecialistDomain } from '@agent/core';

export { AgentRole } from '@agent/core';
export type { AgentRoleValue as WorkflowAgentRole } from '@agent/core';

export type WorkflowContextSliceRecord = ContextSliceRecord;

export interface WorkflowSpecialistLeadRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
}

export interface WorkflowSpecialistSupportRecord {
  id: SpecialistDomain;
  displayName: string;
  domain: SpecialistDomain;
  reason?: string;
}

const SPECIALIST_ALIAS_MAP = {
  'general-assistant': 'general-assistant',
  'product-strategy': 'product-strategy',
  'growth-marketing': 'growth-marketing',
  'payment-channel': 'payment-channel',
  'risk-compliance': 'risk-compliance',
  'technical-architecture': 'technical-architecture',
  'live-ops': 'growth-marketing'
} as const;

const SPECIALIST_LABELS = {
  'general-assistant': '通才阁臣',
  'product-strategy': '产品策略阁臣',
  'growth-marketing': '增长营销阁臣',
  'payment-channel': '支付通道阁臣',
  'risk-compliance': '风控合规阁臣',
  'technical-architecture': '技术架构阁臣'
} as const;

type WorkflowSpecialistAlias = keyof typeof SPECIALIST_ALIAS_MAP;
type WorkflowCanonicalSpecialistDomain = (typeof SPECIALIST_ALIAS_MAP)[WorkflowSpecialistAlias];

export function normalizeSpecialistDomain(params: {
  domain?: string;
  goal?: string;
  context?: string;
}): WorkflowCanonicalSpecialistDomain | undefined {
  if (!params.domain) {
    return undefined;
  }
  if (params.domain !== 'live-ops') {
    return SPECIALIST_ALIAS_MAP[params.domain as WorkflowSpecialistAlias];
  }
  const text = `${params.goal ?? ''}\n${params.context ?? ''}`.toLowerCase();
  const productSignals = ['产品', '规划', '路线', '版本', '优先级', '功能', '体验'];
  const hasStrongProductSignal = productSignals.some(signal => text.includes(signal));
  return hasStrongProductSignal ? 'product-strategy' : 'growth-marketing';
}

export function getSpecialistDisplayName(params: {
  domain?: string;
  goal?: string;
  context?: string;
}): string | undefined {
  const canonical = normalizeSpecialistDomain(params);
  return canonical ? SPECIALIST_LABELS[canonical] : params.domain;
}

export function normalizeExecutionMode(mode?: string): 'plan' | 'execute' | 'imperial_direct' | undefined {
  if (!mode) {
    return undefined;
  }
  if (mode === 'planning-readonly') {
    return 'plan';
  }
  if (mode === 'standard') {
    return 'execute';
  }
  if (mode === 'plan' || mode === 'execute' || mode === 'imperial_direct') {
    return mode;
  }
  return undefined;
}
