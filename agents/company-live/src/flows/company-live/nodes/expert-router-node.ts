import type { CompanyExpertId } from '@agent/core';

import {
  companyLiveCoreExpertIds,
  companyLiveCoreRoutingPriority,
  companyLiveExpertDefinitions
} from '../expert-definitions';

const DEFAULT_EXPERTS = ['productAgent', 'operationsAgent', 'contentAgent'] satisfies CompanyExpertId[];

const CORE_ROUTING_DEFINITIONS = companyLiveCoreRoutingPriority.map(expertId => {
  const definition = companyLiveExpertDefinitions.find(expertDefinition => expertDefinition.expertId === expertId);
  if (!definition) {
    throw new Error(`Missing company live expert definition for ${expertId}`);
  }
  return definition;
});

export function routeCompanyLiveExperts(question: string): CompanyExpertId[] {
  const normalized = question.trim();
  if (/会诊|专家们|整体看看|缺什么/i.test(normalized)) {
    return [...companyLiveCoreExpertIds];
  }

  const normalizedLowerCase = normalized.toLowerCase();
  const selected: CompanyExpertId[] = [];
  for (const definition of CORE_ROUTING_DEFINITIONS) {
    const matchesKeyword = definition.keywords.some(keyword => normalizedLowerCase.includes(keyword.toLowerCase()));
    if (matchesKeyword && !selected.includes(definition.expertId)) {
      selected.push(definition.expertId);
    }
  }

  return selected.length > 0 ? selected.slice(0, 4) : [...DEFAULT_EXPERTS];
}
