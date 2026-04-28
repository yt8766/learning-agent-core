import { CritiqueResultRecordSchema, SpecialistFindingRecordSchema } from '@agent/core';
import type { CritiqueResultRecord } from '@agent/core';

import type { RuntimeSpecialistFindingRecord } from './runtime-specialist-finding.types';

function normalizeStringList(values?: string[]): string[] | undefined {
  if (!values?.length) {
    return undefined;
  }

  const next = Array.from(new Set(values.map(item => item.trim()).filter(Boolean)));
  return next.length ? next : undefined;
}

function fallbackCritiqueSummary(decision: CritiqueResultRecord['decision']) {
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

function fallbackSpecialistSummary(
  specialistId: RuntimeSpecialistFindingRecord['specialistId'],
  role: RuntimeSpecialistFindingRecord['role']
) {
  return role === 'lead' ? `${specialistId} 已形成主导结论。` : `${specialistId} 已补充专项判断。`;
}

export function normalizeRuntimeCritiqueResult(
  input: Partial<CritiqueResultRecord> & Pick<CritiqueResultRecord, 'decision'>
) {
  return CritiqueResultRecordSchema.parse({
    contractVersion: input.contractVersion ?? 'critique-result.v1',
    decision: input.decision,
    summary: input.summary?.trim() || fallbackCritiqueSummary(input.decision),
    blockingIssues: normalizeStringList(input.blockingIssues),
    constraints: normalizeStringList(input.constraints),
    evidenceRefs: normalizeStringList(input.evidenceRefs),
    shouldBlockEarly: input.shouldBlockEarly ?? input.decision === 'block'
  });
}

export function normalizeRuntimeSpecialistFinding(
  input: Partial<RuntimeSpecialistFindingRecord> & Pick<RuntimeSpecialistFindingRecord, 'specialistId' | 'role'>
): RuntimeSpecialistFindingRecord {
  return SpecialistFindingRecordSchema.parse({
    specialistId: input.specialistId,
    role: input.role,
    contractVersion: input.contractVersion ?? 'specialist-finding.v1',
    source: input.source ?? 'route',
    stage: input.stage ?? 'planning',
    summary: input.summary?.trim() || fallbackSpecialistSummary(input.specialistId, input.role),
    domain: input.domain ?? input.specialistId,
    riskLevel: input.riskLevel,
    blockingIssues: normalizeStringList(input.blockingIssues),
    constraints: normalizeStringList(input.constraints),
    suggestions: normalizeStringList(input.suggestions),
    evidenceRefs: normalizeStringList(input.evidenceRefs),
    confidence: typeof input.confidence === 'number' ? Math.max(0, Math.min(1, input.confidence)) : undefined
  }) as RuntimeSpecialistFindingRecord;
}
