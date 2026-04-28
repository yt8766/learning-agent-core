import { z } from 'zod/v4';

import type { SpecialistFindingRecord, TaskRecord } from '@agent/core';

import { SpecialistFindingInputSchema, SpecialistFindingSchema } from './specialist-finding.schema';

function normalizeStringList(values?: string[]): string[] | undefined {
  if (!values?.length) {
    return undefined;
  }

  const next = Array.from(new Set(values.map(item => item.trim()).filter(Boolean)));
  return next.length ? next : undefined;
}

function fallbackSummary(specialistId: SpecialistFindingRecord['specialistId'], role: SpecialistFindingRecord['role']) {
  return role === 'lead' ? `${specialistId} 已形成主导结论。` : `${specialistId} 已补充专项判断。`;
}

export function normalizeSpecialistFinding(
  input: z.input<typeof SpecialistFindingInputSchema>
): SpecialistFindingRecord {
  const parsed = SpecialistFindingInputSchema.parse(input);
  return SpecialistFindingSchema.parse({
    specialistId: parsed.specialistId,
    role: parsed.role,
    contractVersion: parsed.contractVersion ?? 'specialist-finding.v1',
    source: parsed.source ?? 'route',
    stage: parsed.stage ?? 'planning',
    summary: parsed.summary?.trim() || fallbackSummary(parsed.specialistId, parsed.role),
    domain: parsed.domain ?? parsed.specialistId,
    riskLevel: parsed.riskLevel,
    blockingIssues: normalizeStringList(parsed.blockingIssues),
    constraints: normalizeStringList(parsed.constraints),
    suggestions: normalizeStringList(parsed.suggestions),
    evidenceRefs: normalizeStringList(parsed.evidenceRefs),
    confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : undefined
  });
}

export function buildSpecialistFindingOutputInstruction() {
  const jsonSchema = z.toJSONSchema(SpecialistFindingSchema);
  const rootType = jsonSchema.type === 'array' ? 'JSON array' : 'JSON object';

  return [
    '你必须只返回结构化 JSON，不要输出解释、Markdown 或代码块。',
    '输出必须严格符合 SpecialistFinding 合同，用于支撑专家与主导专家之间的机器可读协作。',
    `Return only a single ${rootType} and do not include markdown code fences.`,
    'Do not add explanations, prefixes, suffixes, or extra prose.',
    'The JSON must satisfy this schema summary:',
    JSON.stringify(jsonSchema)
  ].join('\n');
}

export function upsertSpecialistFinding(task: TaskRecord, input: z.input<typeof SpecialistFindingInputSchema>) {
  const finding = normalizeSpecialistFinding(input);
  const current = task.specialistFindings ?? [];
  const next = current.filter(item => !(item.specialistId === finding.specialistId && item.role === finding.role));
  next.push(finding);
  task.specialistFindings = next;
  return finding;
}
