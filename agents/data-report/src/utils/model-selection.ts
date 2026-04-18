import type {
  DataReportJsonModelSelectorPreference,
  DataReportJsonNodeModelSelector,
  LlmProviderLike,
  LlmProviderLikeModelInfo
} from '@agent/core';

const FAST_MODEL_KEYWORDS = [
  'flash',
  'flashx',
  'highspeed',
  'turbo',
  'haiku',
  'mini',
  'small',
  'lite',
  'instant',
  'airx',
  'air'
];

const QUALITY_MODEL_KEYWORDS = [
  'glm-5.1',
  'glm-5',
  'm2.7',
  'm2.5',
  'opus',
  'sonnet',
  'pro',
  'max',
  'thinking',
  'reason'
];

function normalizeModelId(modelId: string) {
  return modelId.trim().toLowerCase();
}

function includesKeyword(modelId: string, keywords: string[]) {
  const normalized = normalizeModelId(modelId);
  return keywords.some(keyword => {
    if (keyword === 'mini' || keyword === 'air' || keyword === 'max' || keyword === 'pro') {
      return new RegExp(`(^|[-_/])${keyword}($|[-_/])`).test(normalized);
    }
    return normalized.includes(keyword);
  });
}

function scoreModelForTier(model: LlmProviderLikeModelInfo, tier: DataReportJsonModelSelectorPreference['tier']) {
  const normalized = normalizeModelId(model.id);
  const fastHit = includesKeyword(normalized, FAST_MODEL_KEYWORDS);
  const qualityHit = includesKeyword(normalized, QUALITY_MODEL_KEYWORDS);
  let score = 0;

  if (tier === 'fast') {
    score += fastHit ? 40 : 0;
    score -= qualityHit && !fastHit ? 8 : 0;
    score -= model.contextWindow > 256_000 ? 2 : 0;
    score += model.maxOutput <= 32_000 ? 2 : 0;
  } else if (tier === 'quality') {
    score += qualityHit ? 40 : 0;
    score -= fastHit && !qualityHit ? 10 : 0;
    score += model.contextWindow >= 128_000 ? 4 : 0;
    score += model.maxOutput >= 16_000 ? 2 : 0;
  } else {
    score += fastHit ? 4 : 0;
    score += qualityHit ? 4 : 0;
    score += model.contextWindow >= 128_000 ? 2 : 0;
  }

  score += model.capabilities.includes('tool-call') ? 2 : 0;
  score += model.capabilities.includes('thinking') ? (tier === 'quality' ? 2 : -1) : 0;
  score += Math.min(model.contextWindow / 100_000, 3);

  return score;
}

function resolveSelectorPreference(
  selector: DataReportJsonNodeModelSelector
): DataReportJsonModelSelectorPreference | undefined {
  return typeof selector === 'string' ? undefined : selector;
}

export function resolveModelSelectorCandidateIds(params: {
  llm?: LlmProviderLike;
  selector?: DataReportJsonNodeModelSelector;
  explicitModelId?: string;
}): string[] {
  const { llm, selector, explicitModelId } = params;
  const supportedModels = llm?.supportedModels() ?? [];
  const supportedModelIds = new Set(supportedModels.map(model => model.id));
  const resolved = new Set<string>();

  if (explicitModelId && (!supportedModels.length || supportedModelIds.has(explicitModelId))) {
    resolved.add(explicitModelId);
  }

  if (!selector) {
    return Array.from(resolved);
  }

  if (typeof selector === 'string') {
    if (!supportedModels.length || supportedModelIds.has(selector)) {
      resolved.add(selector);
    }
    return Array.from(resolved);
  }

  for (const preferredModelId of selector.preferredModelIds ?? []) {
    if (!supportedModels.length || supportedModelIds.has(preferredModelId)) {
      resolved.add(preferredModelId);
    }
  }

  const rankedModels = [...supportedModels]
    .sort((left, right) => scoreModelForTier(right, selector.tier) - scoreModelForTier(left, selector.tier))
    .map(model => model.id);

  for (const candidate of rankedModels) {
    resolved.add(candidate);
  }

  return Array.from(resolved);
}

export function resolveFirstModelSelectorCandidate(params: {
  llm?: LlmProviderLike;
  selector?: DataReportJsonNodeModelSelector;
  explicitModelId?: string;
}) {
  return resolveModelSelectorCandidateIds(params)[0];
}

export function isSemanticModelSelector(
  selector: DataReportJsonNodeModelSelector | undefined
): selector is DataReportJsonModelSelectorPreference {
  if (!selector) {
    return false;
  }
  return Boolean(resolveSelectorPreference(selector));
}
