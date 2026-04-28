import type { CritiqueResultRecord } from '@agent/core';

import { CritiqueResultSchema } from './critique-result.schema';

function normalizeStringList(values?: string[]): string[] | undefined {
  if (!values?.length) {
    return undefined;
  }

  const next = Array.from(new Set(values.map(item => item.trim()).filter(Boolean)));
  return next.length ? next : undefined;
}

function fallbackSummary(decision: CritiqueResultRecord['decision']) {
  switch (decision) {
    case 'block':
      return '刑部判定当前方案存在阻断问题。';
    case 'revise_required':
      return '刑部认为当前草稿仍需修订。';
    case 'needs_human_approval':
      return '刑部认为当前动作需要人工审批后才能继续。';
    default:
      return '刑部审查通过。';
  }
}

export function normalizeCritiqueResult(input: Partial<CritiqueResultRecord> & Pick<CritiqueResultRecord, 'decision'>) {
  return CritiqueResultSchema.parse({
    contractVersion: input.contractVersion ?? 'critique-result.v1',
    decision: input.decision,
    summary: input.summary?.trim() || fallbackSummary(input.decision),
    blockingIssues: normalizeStringList(input.blockingIssues),
    constraints: normalizeStringList(input.constraints),
    evidenceRefs: normalizeStringList(input.evidenceRefs),
    shouldBlockEarly: input.shouldBlockEarly ?? input.decision === 'block'
  });
}
