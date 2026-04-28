import { z } from 'zod/v4';

const SpecialistDomainSchema = z.enum([
  'general-assistant',
  'product-strategy',
  'growth-marketing',
  'payment-channel',
  'live-ops',
  'risk-compliance',
  'technical-architecture'
]);

const RiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const SpecialistFindingSchema = z.object({
  specialistId: SpecialistDomainSchema,
  role: z.enum(['lead', 'support']),
  contractVersion: z.literal('specialist-finding.v1'),
  source: z.enum(['route', 'research', 'execution', 'critique']),
  stage: z.enum(['planning', 'research', 'execution', 'review']),
  summary: z.string().trim().min(1),
  domain: SpecialistDomainSchema,
  riskLevel: RiskLevelSchema.optional(),
  blockingIssues: z.array(z.string().trim().min(1)).optional(),
  constraints: z.array(z.string().trim().min(1)).optional(),
  suggestions: z.array(z.string().trim().min(1)).optional(),
  evidenceRefs: z.array(z.string().trim().min(1)).optional(),
  confidence: z.number().min(0).max(1).optional()
});

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
