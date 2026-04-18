import { z } from 'zod';

import { RiskLevelSchema } from '../../primitives';

export const SkillSuggestionKindSchema = z.enum(['installed', 'manifest', 'connector-template', 'remote-skill']);
export const SkillSuggestionAvailabilitySchema = z.enum([
  'ready',
  'installable',
  'installable-local',
  'installable-remote',
  'approval-required',
  'blocked'
]);
export const SkillTriggerReasonSchema = z.enum([
  'user_requested',
  'capability_gap_detected',
  'domain_specialization_needed'
]);

export const SkillSafetyEvaluationRecordSchema = z.object({
  verdict: z.enum(['allow', 'needs-approval', 'blocked']),
  trustScore: z.number(),
  sourceTrustClass: z.string().optional(),
  profileCompatible: z.boolean().optional(),
  maxRiskLevel: RiskLevelSchema,
  reasons: z.array(z.string()),
  riskyTools: z.array(z.string()),
  missingDeclarations: z.array(z.string())
});

export const ProfilePolicyHintRecordSchema = z.object({
  enabledByProfile: z.boolean(),
  recommendedForProfiles: z.array(z.enum(['platform', 'company', 'personal', 'cli'])),
  reason: z.string()
});
