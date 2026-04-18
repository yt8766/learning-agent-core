import type { SkillCard, WorkerDomain } from '@agent/core';
import { getMinistryDisplayName, normalizeMinistryId } from './runtime-architecture-helpers';

export function toCapabilityDisplayName(toolName: string) {
  return toolName
    .split(/[._:-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function inferCapabilityRiskLevel(toolName: string): 'low' | 'medium' | 'high' | 'critical' {
  const lowered = toolName.toLowerCase();
  if (/(delete|merge|publish|release|write|comment|create|submit|click|navigate|open_page)/.test(lowered)) {
    return 'high';
  }
  if (/(screenshot|extract|analysis|diff|capture)/.test(lowered)) {
    return 'medium';
  }
  return 'low';
}

export function inferCapabilityRequiresApproval(toolName: string): boolean {
  return inferCapabilityRiskLevel(toolName) !== 'low';
}

export function inferCapabilityCategory(toolName: string): 'knowledge' | 'system' | 'action' | 'memory' {
  const lowered = toolName.toLowerCase();
  if (/(open|click|navigate|create|write|delete|merge|submit|release|comment)/.test(lowered)) {
    return 'action';
  }
  return 'knowledge';
}

export function resolveInstalledSkillMinistry(skill: SkillCard): WorkerDomain {
  const capabilities = [...(skill.requiredCapabilities ?? []), ...(skill.requiredTools ?? [])].map(item =>
    item.toLowerCase()
  );
  if (capabilities.some(item => item.includes('browser') || item.includes('release') || item.includes('terminal'))) {
    return 'bingbu-ops';
  }
  if (capabilities.some(item => item.includes('review') || item.includes('security') || item.includes('compliance'))) {
    return 'xingbu-review';
  }
  if (
    capabilities.some(item => item.includes('documentation') || item.includes('ui-spec') || item.includes('openapi'))
  ) {
    return 'libu-delivery';
  }
  if (capabilities.some(item => item.includes('write') || item.includes('code') || item.includes('refactor'))) {
    return 'gongbu-code';
  }
  if (capabilities.some(item => item.includes('search') || item.includes('memory') || item.includes('knowledge'))) {
    return 'hubu-search';
  }
  return 'libu-delivery';
}

export function resolveInstalledSkillModel(
  zhipuModels: {
    research: string;
    reviewer: string;
    executor: string;
    manager: string;
  },
  skill: SkillCard
): string {
  const ministry = resolveInstalledSkillMinistry(skill);
  switch (normalizeMinistryId(ministry)) {
    case 'hubu-search':
      return zhipuModels.research;
    case 'xingbu-review':
      return zhipuModels.reviewer;
    case 'gongbu-code':
    case 'bingbu-ops':
      return zhipuModels.executor;
    case 'libu-delivery':
    case 'libu-governance':
    default:
      return zhipuModels.manager;
  }
}

export function toMinistryDisplayName(ministry?: string) {
  return getMinistryDisplayName(ministry) ?? ministry ?? '未知部';
}
