import { z } from 'zod';

export const QualityGateHookSchema = z.enum([
  'pre_plan',
  'post_plan',
  'pre_action',
  'post_action',
  'pre_delivery',
  'post_delivery'
]);

export const QualityGateSchema = z.object({
  gateId: z.string().min(1),
  hook: QualityGateHookSchema,
  requiredForRisk: z.array(z.enum(['low', 'medium', 'high', 'critical'])).default([]),
  evaluator: z.enum(['schema', 'test', 'reviewer', 'policy', 'source_check', 'custom']),
  onFail: z.enum(['block', 'request_revision', 'require_approval', 'warn'])
});

export const QualityGateResultSchema = z.object({
  gateId: z.string().min(1),
  status: z.enum(['passed', 'failed', 'warned', 'skipped']),
  evaluatedAt: z.string().min(1),
  reason: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string().min(1)).default([])
});
