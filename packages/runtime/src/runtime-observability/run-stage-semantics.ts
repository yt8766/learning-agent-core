import type { RunStage } from '@agent/core';

import type { RunStageInput } from './runtime-observability.types';

const STAGE_KEYWORDS: Array<{ stage: RunStage; keywords: string[] }> = [
  { stage: 'interrupt', keywords: ['interrupt', 'approval', 'pending_approval', 'waiting_approval'] },
  { stage: 'recover', keywords: ['recover', 'resume', 'recovery', 'retry'] },
  { stage: 'learning', keywords: ['learning', 'memory', 'rule', 'skill_search'] },
  { stage: 'review', keywords: ['review', 'xingbu', 'critique', 'governance'] },
  { stage: 'delivery', keywords: ['delivery', 'libu', 'aggregat', 'answer', 'final'] },
  { stage: 'research', keywords: ['research', 'hubu', 'knowledge', 'citation', 'freshness'] },
  { stage: 'execution', keywords: ['execution', 'execute', 'gongbu', 'bingbu', 'tool', 'sandbox', 'code'] },
  { stage: 'route', keywords: ['route', 'router', 'entry', 'dispatch', 'mode_gate'] },
  { stage: 'plan', keywords: ['plan', 'draft', 'planning', 'intent'] }
];

function normalize(value?: string) {
  return value?.trim().toLowerCase();
}

function isRunStage(value?: string): value is RunStage {
  return ['plan', 'route', 'research', 'execution', 'review', 'delivery', 'interrupt', 'recover', 'learning'].includes(
    String(value)
  );
}

export function resolveRunStage(input: RunStageInput): RunStage {
  const directStage = normalize(input.stage);
  if (isRunStage(directStage)) {
    return directStage;
  }

  const candidates = [
    normalize(input.node),
    normalize(input.currentNode),
    normalize(input.currentStep),
    normalize(input.summary),
    normalize(input.currentMinistry)
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    for (const entry of STAGE_KEYWORDS) {
      if (entry.keywords.some(keyword => candidate.includes(keyword))) {
        return entry.stage;
      }
    }
  }

  return 'execution';
}
