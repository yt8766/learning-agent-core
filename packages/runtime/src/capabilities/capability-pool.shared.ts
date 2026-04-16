import type {
  CapabilityAttachmentRecord,
  CapabilityAugmentationRecord,
  CapabilityOwnershipRecord,
  LocalSkillSuggestionRecord,
  WorkerDomain
} from '@agent/shared';
import {
  getMinistryDisplayName,
  getSpecialistDisplayName,
  normalizeMinistryId,
  normalizeSpecialistDomain
} from '@agent/shared';

export const MINISTRY_LABELS: Record<WorkerDomain, string> = {
  'libu-governance': '吏部能力池',
  'libu-router': '吏部能力池',
  'hubu-search': '户部能力池',
  'gongbu-code': '工部能力池',
  'bingbu-ops': '兵部能力池',
  'xingbu-review': '刑部能力池',
  'libu-delivery': '礼部能力池',
  'libu-docs': '礼部能力池'
};

export const SPECIALIST_LABELS: Record<string, string> = {
  'general-assistant': '通用助理能力池',
  'product-strategy': '产品策略能力池',
  'growth-marketing': '增长投放能力池',
  'payment-channel': '支付通道能力池',
  'live-ops': '直播互动能力池（兼容别名）',
  'risk-compliance': '风控合规能力池',
  'technical-architecture': '技术架构能力池'
};

export const CONNECTOR_TEMPLATE_TO_DISPLAY: Record<string, string> = {
  'github-mcp-template': 'GitHub MCP',
  'browser-mcp-template': 'Browser MCP',
  'lark-mcp-template': 'Lark MCP'
};

export function toCapabilityTrigger(
  triggerReason?: 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed'
): CapabilityOwnershipRecord['trigger'] {
  if (triggerReason === 'user_requested') {
    return 'user_requested';
  }
  if (triggerReason === 'domain_specialization_needed') {
    return 'specialist_requested';
  }
  return 'capability_gap_detected';
}

export function toAttachmentFromSuggestion(
  suggestion: LocalSkillSuggestionRecord,
  now: string,
  ownerId?: string,
  specialistDomain?: string
): CapabilityAttachmentRecord {
  const owner = suggestion.ownership ?? inferOwnershipFromSuggestion(suggestion, ownerId, specialistDomain);
  return {
    id: `suggestion:${suggestion.kind}:${suggestion.id}`,
    displayName: suggestion.displayName,
    kind: suggestion.kind === 'connector-template' ? 'connector' : 'skill',
    owner,
    enabled: suggestion.availability === 'ready',
    sourceId: suggestion.sourceId,
    createdAt: now,
    updatedAt: now
  };
}

function inferOwnershipFromSuggestion(
  suggestion: LocalSkillSuggestionRecord,
  ownerId?: string,
  specialistDomain?: string
): CapabilityOwnershipRecord {
  if (suggestion.kind === 'connector-template') {
    return {
      ownerType: 'runtime-derived',
      tier: 'temporary-assignment',
      ownerId: ownerId ?? 'task',
      capabilityType: 'connector',
      scope: 'task',
      trigger: 'capability_gap_detected',
      consumedBySpecialist: specialistDomain
    };
  }
  if (suggestion.kind === 'installed') {
    return {
      ownerType: 'shared',
      tier: 'shared',
      ownerId: suggestion.id,
      capabilityType: 'skill',
      scope: 'workspace',
      trigger: 'workflow_required',
      consumedBySpecialist: specialistDomain
    };
  }
  return {
    ownerType: 'runtime-derived',
    tier: 'temporary-assignment',
    ownerId: ownerId ?? 'task',
    capabilityType: 'skill',
    scope: 'task',
    trigger: toCapabilityTrigger(suggestion.triggerReason),
    consumedBySpecialist: specialistDomain
  };
}

export function normalizeConnectorTag(value?: string) {
  const normalized = value?.toLowerCase() ?? '';
  if (normalized.includes('github')) {
    return 'repo';
  }
  if (normalized.includes('browser')) {
    return 'browser';
  }
  if (normalized.includes('lark') || normalized.includes('feishu')) {
    return 'feishu';
  }
  return normalized;
}

export function specialistTags(domain?: string) {
  switch (domain) {
    case 'technical-architecture':
      return ['architecture', 'repo', 'code', 'refactor'];
    case 'risk-compliance':
      return ['review', 'security', 'compliance'];
    case 'payment-channel':
      return ['payment', 'knowledge'];
    case 'product-strategy':
      return ['documentation', 'delivery', 'product'];
    default:
      return [];
  }
}

export function ministryTags(ministryId?: string) {
  const normalized = normalizeMinistryId(ministryId ?? '') ?? ministryId;
  switch (normalized) {
    case 'hubu-search':
      return ['research', 'knowledge', 'memory'];
    case 'gongbu-code':
      return ['code', 'refactor'];
    case 'bingbu-ops':
      return ['sandbox', 'terminal', 'release'];
    case 'xingbu-review':
      return ['review', 'security', 'compliance'];
    case 'libu-delivery':
      return ['documentation', 'delivery'];
    case 'libu-governance':
    case 'libu-router':
      return ['routing', 'budget', 'supervisor'];
    default:
      return [];
  }
}

export function hasCapabilityAffinity(
  connectorIds: Set<string>,
  enabledConnectorIds: Set<string>,
  augmentationTargets: Set<string>,
  tokens: string[]
) {
  return tokens.some(token => {
    const normalized = token.toLowerCase();
    return (
      Array.from(enabledConnectorIds).some(item => item.includes(normalized)) ||
      Array.from(connectorIds).some(item => item.includes(normalized)) ||
      Array.from(augmentationTargets).some(item => item.includes(normalized))
    );
  });
}

export function getAttachmentTrust(
  attachments: CapabilityAttachmentRecord[] | undefined,
  predicate: (attachment: CapabilityAttachmentRecord) => boolean
) {
  const attachment = (attachments ?? []).find(predicate);
  return {
    level: attachment?.capabilityTrust?.trustLevel,
    trend: attachment?.capabilityTrust?.trustTrend
  };
}

export function isDegradedTrust(level?: 'high' | 'medium' | 'low', trend?: 'up' | 'steady' | 'down') {
  return level === 'low' || trend === 'down';
}

export function dedupeAttachments(attachments: CapabilityAttachmentRecord[]) {
  return Array.from(new Map(attachments.map(item => [item.id, item])).values());
}

export function dedupeAugmentations(augmentations: CapabilityAugmentationRecord[]) {
  return Array.from(new Map(augmentations.map(item => [item.id, item])).values());
}

export function resolveMinistryDisplay(ministry: WorkerDomain) {
  return getMinistryDisplayName(ministry) ?? MINISTRY_LABELS[ministry] ?? ministry;
}

export function resolveSpecialistDisplay(domain: string, displayName: string) {
  return getSpecialistDisplayName({ domain }) ?? SPECIALIST_LABELS[domain] ?? displayName;
}

export { normalizeMinistryId, normalizeSpecialistDomain };
