import { z } from 'zod/v4';

import { RiskLevelSchema } from '@agent/core';

const SpecialistDomainSchema = z.enum([
  'general-assistant',
  'product-strategy',
  'growth-marketing',
  'payment-channel',
  'live-ops',
  'risk-compliance',
  'technical-architecture'
]);

const SpecialistFindingRoleSchema = z.enum(['lead', 'support']);
const SpecialistFindingSourceSchema = z.enum(['route', 'research', 'execution', 'critique']);
const SpecialistFindingStageSchema = z.enum(['planning', 'research', 'execution', 'review']);

export const SpecialistFindingInputSchema = z.object({
  specialistId: SpecialistDomainSchema,
  role: SpecialistFindingRoleSchema,
  contractVersion: z.literal('specialist-finding.v1').optional(),
  source: SpecialistFindingSourceSchema.optional(),
  stage: SpecialistFindingStageSchema.optional(),
  summary: z.string().trim().optional(),
  domain: SpecialistDomainSchema.optional(),
  riskLevel: RiskLevelSchema.optional(),
  blockingIssues: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  evidenceRefs: z.array(z.string()).optional(),
  confidence: z.number().optional()
});

export const SpecialistFindingSchema = z.object({
  specialistId: SpecialistDomainSchema,
  role: SpecialistFindingRoleSchema,
  contractVersion: z.literal('specialist-finding.v1'),
  source: SpecialistFindingSourceSchema,
  stage: SpecialistFindingStageSchema,
  summary: z.string().trim().min(1),
  domain: SpecialistDomainSchema,
  riskLevel: RiskLevelSchema.optional(),
  blockingIssues: z.array(z.string().trim().min(1)).optional(),
  constraints: z.array(z.string().trim().min(1)).optional(),
  suggestions: z.array(z.string().trim().min(1)).optional(),
  evidenceRefs: z.array(z.string().trim().min(1)).optional(),
  confidence: z.number().min(0).max(1).optional()
});
