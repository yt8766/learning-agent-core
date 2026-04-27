import { z } from 'zod';

import { RiskLevelSchema } from '../../primitives';

export const AgentWorkspaceScopeSchema = z.enum(['personal', 'company', 'platform', 'cli']);
export const AgentWorkspaceStatusSchema = z.enum(['active', 'archived']);
export const AgentIdentityKindSchema = z.enum(['human', 'agent', 'system']);

export const AgentIdentitySchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: AgentIdentityKindSchema
});

export const AgentWorkspaceSummarySchema = z.object({
  workspaceId: z.string(),
  scope: AgentWorkspaceScopeSchema,
  activeDraftCount: z.number().int().min(0),
  approvedDraftCount: z.number().int().min(0),
  reuseRecordCount: z.number().int().min(0),
  updatedAt: z.string()
});

export const AgentWorkspaceSchema = z.object({
  id: z.string(),
  profileId: z.string(),
  name: z.string(),
  scope: AgentWorkspaceScopeSchema,
  status: AgentWorkspaceStatusSchema,
  owner: AgentIdentitySchema,
  policyRefs: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  summary: AgentWorkspaceSummarySchema.optional()
});

export const AgentSkillDraftStatusSchema = z.enum(['draft', 'shadow', 'active', 'trusted', 'rejected', 'retired']);

export const AgentSkillDraftInstallStatusSchema = z.enum([
  'not_requested',
  'pending',
  'approved',
  'installing',
  'installed',
  'failed',
  'rejected'
]);

export const AgentSkillDraftInstallPhaseSchema = z.enum([
  'requested',
  'approved',
  'downloading',
  'verifying',
  'installing',
  'installed',
  'failed'
]);

export const AgentSkillDraftLifecycleNextActionSchema = z.enum([
  'review_draft',
  'install_from_skill_lab',
  'approve_install',
  'retry_install',
  'ready_to_reuse',
  'none'
]);

export const AgentSkillDraftInstallSummarySchema = z.object({
  receiptId: z.string(),
  skillId: z.string(),
  sourceId: z.string(),
  version: z.string().optional(),
  status: AgentSkillDraftInstallStatusSchema,
  phase: AgentSkillDraftInstallPhaseSchema.optional(),
  installedAt: z.string().optional(),
  failureCode: z.string().optional()
});

export const AgentWorkspaceEvidenceSummarySchema = z
  .object({
    evidenceId: z.string(),
    title: z.string().optional(),
    summary: z.string().optional(),
    sourceKind: z.string().optional(),
    citationId: z.string().optional()
  })
  .strict();

export const AgentSkillDraftProvenanceSummarySchema = z.object({
  sourceKind: z.literal('workspace-draft'),
  sourceTaskId: z.string().optional(),
  sourceEvidenceIds: z.array(z.string()).optional(),
  evidenceCount: z.number().int().min(0).optional(),
  evidenceRefs: z.array(AgentWorkspaceEvidenceSummarySchema).optional(),
  manifestId: z.string().optional(),
  manifestSourceId: z.literal('workspace-skill-drafts').optional()
});

export const AgentSkillDraftLifecycleSummarySchema = z.object({
  draftStatus: AgentSkillDraftStatusSchema,
  installStatus: z.string().optional(),
  reusable: z.boolean(),
  nextAction: AgentSkillDraftLifecycleNextActionSchema.optional()
});

export const AgentSkillDraftSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  description: z.string().default(''),
  triggerHints: z.array(z.string()).default([]),
  bodyMarkdown: z.string(),
  requiredTools: z.array(z.string()).default([]),
  requiredConnectors: z.array(z.string()).default([]),
  sourceTaskId: z.string(),
  sourceEvidenceIds: z.array(z.string()).default([]),
  status: AgentSkillDraftStatusSchema,
  riskLevel: RiskLevelSchema,
  confidence: z.number().min(0).max(1),
  createdBy: AgentIdentitySchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  install: AgentSkillDraftInstallSummarySchema.optional(),
  provenance: AgentSkillDraftProvenanceSummarySchema.optional(),
  lifecycle: AgentSkillDraftLifecycleSummarySchema.optional()
});

export const AgentSkillDraftDecisionSchema = z
  .object({
    draftId: z.string(),
    decision: z.enum(['approved', 'rejected', 'changes_requested']),
    decidedBy: AgentIdentitySchema,
    draftRiskLevel: RiskLevelSchema,
    evidenceRefs: z.array(z.string()).default([]),
    rationale: z.string().optional(),
    decidedAt: z.string()
  })
  .superRefine((decision, context) => {
    if (
      decision.decision === 'approved' &&
      (decision.draftRiskLevel === 'high' || decision.draftRiskLevel === 'critical') &&
      decision.evidenceRefs.length === 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['evidenceRefs'],
        message: 'High or critical skill drafts require evidence before approval.'
      });
    }
  });

export const AgentSkillReuseRecordSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  skillId: z.string(),
  reusedBy: AgentIdentitySchema,
  taskId: z.string().optional(),
  sourceDraftId: z.string().optional(),
  outcome: z.enum(['succeeded', 'failed', 'skipped']),
  evidenceRefs: z.array(z.string()).default([]),
  reusedAt: z.string()
});
