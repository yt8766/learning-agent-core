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

export type CompanyExpertId = z.infer<typeof CompanyExpertIdSchema>;
export type CompanyExpertRole = z.infer<typeof CompanyExpertRoleSchema>;

const companyExpertRoleById: Record<CompanyExpertId, CompanyExpertRole> = {
  productAgent: 'product',
  operationsAgent: 'operations',
  contentAgent: 'content',
  growthAgent: 'growth',
  marketingAgent: 'marketing',
  intelligenceAgent: 'intelligence',
  riskAgent: 'risk',
  financeAgent: 'finance',
  supportAgent: 'support',
  supplyAgent: 'supply'
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

const isPlainJsonObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isPlainJsonObject(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
};

export const JsonValueSchema: z.ZodType<JsonValue> = z.custom<JsonValue>(isJsonValue, {
  message: 'Expected a JSON-safe value'
});

const addRoleMismatchIssue = (ctx: z.RefinementCtx, expertId: CompanyExpertId, role: CompanyExpertRole) => {
  const expectedRole = companyExpertRoleById[expertId];

  if (role !== expectedRole) {
    ctx.addIssue({
      code: 'custom',
      path: ['role'],
      message: `Expected role "${expectedRole}" for expert "${expertId}"`
    });
  }
};

export const CompanyExpertDefinitionSchema = z
  .object({
    expertId: CompanyExpertIdSchema,
    displayName: z.string().min(1),
    role: CompanyExpertRoleSchema,
    phase: z.enum(['core', 'reserved']),
    responsibilities: z.array(z.string().min(1)).min(1),
    boundaries: z.array(z.string().min(1)).min(1),
    keywords: z.array(z.string().min(1)).min(1)
  })
  .superRefine((definition, ctx) => {
    addRoleMismatchIssue(ctx, definition.expertId, definition.role);
  });

export const ExpertFindingSchema = z
  .object({
    expertId: CompanyExpertIdSchema,
    role: CompanyExpertRoleSchema,
    summary: z.string().min(1),
    diagnosis: z.array(z.string().min(1)),
    recommendations: z.array(z.string().min(1)),
    questionsToUser: z.array(z.string().min(1)),
    risks: z.array(z.string().min(1)),
    confidence: z.number().min(0).max(1),
    source: z.enum(['llm', 'fallback'])
  })
  .superRefine((finding, ctx) => {
    addRoleMismatchIssue(ctx, finding.expertId, finding.role);
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
      value: JsonValueSchema,
      reason: z.string().min(1)
    })
  )
});

const addDuplicateIssues = (ctx: z.RefinementCtx, values: readonly CompanyExpertId[], path: (string | number)[]) => {
  const seen = new Set<CompanyExpertId>();

  values.forEach((value, index) => {
    if (seen.has(value)) {
      ctx.addIssue({
        code: 'custom',
        path: [...path, index],
        message: `Duplicate expert "${value}"`
      });
    }

    seen.add(value);
  });
};

export const CompanyExpertConsultationSchema = z
  .object({
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
  })
  .superRefine((consultation, ctx) => {
    const selectedExperts = new Set(consultation.selectedExperts);

    addDuplicateIssues(ctx, consultation.selectedExperts, ['selectedExperts']);
    addDuplicateIssues(
      ctx,
      consultation.expertFindings.map(finding => finding.expertId),
      ['expertFindings']
    );

    consultation.expertFindings.forEach((finding, index) => {
      if (!selectedExperts.has(finding.expertId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['expertFindings', index, 'expertId'],
          message: `Expert "${finding.expertId}" must be selected before it can provide findings`
        });
      }
    });

    consultation.conflicts.forEach((conflict, conflictIndex) => {
      addDuplicateIssues(ctx, conflict.expertIds, ['conflicts', conflictIndex, 'expertIds']);

      conflict.expertIds.forEach((expertId, expertIndex) => {
        if (!selectedExperts.has(expertId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['conflicts', conflictIndex, 'expertIds', expertIndex],
            message: `Expert "${expertId}" must be selected before it can appear in a conflict`
          });
        }
      });
    });

    consultation.nextActions.forEach((action, index) => {
      if (!selectedExperts.has(action.ownerExpertId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['nextActions', index, 'ownerExpertId'],
          message: `Expert "${action.ownerExpertId}" must be selected before it can own an action`
        });
      }
    });
  });

export type CompanyExpertDefinition = z.infer<typeof CompanyExpertDefinitionSchema>;
export type ExpertFinding = z.infer<typeof ExpertFindingSchema>;
export type CompanyExpertConflict = z.infer<typeof CompanyExpertConflictSchema>;
export type CompanyExpertNextAction = z.infer<typeof CompanyExpertNextActionSchema>;
export type CompanyLiveBusinessPlanPatch = z.infer<typeof CompanyLiveBusinessPlanPatchSchema>;
export type CompanyExpertConsultation = z.infer<typeof CompanyExpertConsultationSchema>;
