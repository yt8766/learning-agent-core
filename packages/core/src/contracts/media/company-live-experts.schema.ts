import { z } from 'zod/v4';

export const CompanyExpertIdSchema = z.enum([
  'productAgent',
  'operationsAgent',
  'contentAgent',
  'growthAgent',
  'marketingAgent',
  'intelligenceAgent',
  'riskAgent',
  'financeAgent',
  'supportAgent',
  'supplyAgent'
]);

export const CompanyExpertRoleSchema = z.enum([
  'product',
  'operations',
  'content',
  'growth',
  'marketing',
  'intelligence',
  'risk',
  'finance',
  'support',
  'supply'
]);

export const CompanyExpertDefinitionSchema = z.object({
  expertId: CompanyExpertIdSchema,
  displayName: z.string().min(1),
  role: CompanyExpertRoleSchema,
  phase: z.enum(['core', 'reserved']),
  responsibilities: z.array(z.string().min(1)).min(1),
  boundaries: z.array(z.string().min(1)).min(1),
  keywords: z.array(z.string().min(1)).min(1)
});

export const ExpertFindingSchema = z.object({
  expertId: CompanyExpertIdSchema,
  role: CompanyExpertRoleSchema,
  summary: z.string().min(1),
  diagnosis: z.array(z.string().min(1)),
  recommendations: z.array(z.string().min(1)),
  questionsToUser: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  source: z.enum(['llm', 'fallback'])
});

export const CompanyExpertConflictSchema = z.object({
  conflictId: z.string().min(1),
  summary: z.string().min(1),
  expertIds: z.array(CompanyExpertIdSchema).min(2),
  resolutionHint: z.string().min(1)
});

export const CompanyExpertNextActionSchema = z.object({
  actionId: z.string().min(1),
  ownerExpertId: CompanyExpertIdSchema,
  label: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high'])
});

export const CompanyLiveBusinessPlanPatchSchema = z.object({
  briefId: z.string().min(1),
  updates: z.array(
    z.object({
      path: z.string().min(1),
      value: z.unknown(),
      reason: z.string().min(1)
    })
  )
});

export const CompanyExpertConsultationSchema = z.object({
  consultationId: z.string().min(1),
  briefId: z.string().min(1),
  userQuestion: z.string().min(1),
  selectedExperts: z.array(CompanyExpertIdSchema).min(1),
  expertFindings: z.array(ExpertFindingSchema).min(1),
  missingInputs: z.array(z.string().min(1)),
  conflicts: z.array(CompanyExpertConflictSchema),
  nextActions: z.array(CompanyExpertNextActionSchema),
  businessPlanPatch: CompanyLiveBusinessPlanPatchSchema,
  createdAt: z.string().datetime()
});

export type CompanyExpertId = z.infer<typeof CompanyExpertIdSchema>;
export type CompanyExpertRole = z.infer<typeof CompanyExpertRoleSchema>;
export type CompanyExpertDefinition = z.infer<typeof CompanyExpertDefinitionSchema>;
export type ExpertFinding = z.infer<typeof ExpertFindingSchema>;
export type CompanyExpertConflict = z.infer<typeof CompanyExpertConflictSchema>;
export type CompanyExpertNextAction = z.infer<typeof CompanyExpertNextActionSchema>;
export type CompanyLiveBusinessPlanPatch = z.infer<typeof CompanyLiveBusinessPlanPatchSchema>;
export type CompanyExpertConsultation = z.infer<typeof CompanyExpertConsultationSchema>;
