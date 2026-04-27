import { z } from 'zod';

import {
  AgentIdentityKindSchema,
  AgentIdentitySchema,
  AgentSkillDraftDecisionSchema,
  AgentSkillDraftInstallPhaseSchema,
  AgentSkillDraftInstallStatusSchema,
  AgentSkillDraftInstallSummarySchema,
  AgentSkillDraftLifecycleNextActionSchema,
  AgentSkillDraftLifecycleSummarySchema,
  AgentSkillDraftProvenanceSummarySchema,
  AgentSkillDraftSchema,
  AgentSkillDraftStatusSchema,
  AgentSkillReuseRecordSchema,
  AgentWorkspaceEvidenceSummarySchema,
  AgentWorkspaceSchema,
  AgentWorkspaceStatusSchema,
  AgentWorkspaceScopeSchema,
  AgentWorkspaceSummarySchema
} from '../schemas';

export type AgentWorkspaceScope = z.infer<typeof AgentWorkspaceScopeSchema>;
export type AgentWorkspaceStatus = z.infer<typeof AgentWorkspaceStatusSchema>;
export type AgentIdentityKind = z.infer<typeof AgentIdentityKindSchema>;
export type AgentIdentity = z.infer<typeof AgentIdentitySchema>;
export type AgentWorkspaceSummary = z.infer<typeof AgentWorkspaceSummarySchema>;
export type AgentWorkspace = z.infer<typeof AgentWorkspaceSchema>;
export type AgentWorkspaceEvidenceSummary = z.infer<typeof AgentWorkspaceEvidenceSummarySchema>;
export type AgentSkillDraftStatus = z.infer<typeof AgentSkillDraftStatusSchema>;
export type AgentSkillDraftInstallStatus = z.infer<typeof AgentSkillDraftInstallStatusSchema>;
export type AgentSkillDraftInstallPhase = z.infer<typeof AgentSkillDraftInstallPhaseSchema>;
export type AgentSkillDraftLifecycleNextAction = z.infer<typeof AgentSkillDraftLifecycleNextActionSchema>;
export type AgentSkillDraftInstallSummary = z.infer<typeof AgentSkillDraftInstallSummarySchema>;
export type AgentSkillDraftProvenanceSummary = z.infer<typeof AgentSkillDraftProvenanceSummarySchema>;
export type AgentSkillDraftLifecycleSummary = z.infer<typeof AgentSkillDraftLifecycleSummarySchema>;
export type AgentSkillDraft = z.infer<typeof AgentSkillDraftSchema>;
export type AgentSkillDraftDecision = z.infer<typeof AgentSkillDraftDecisionSchema>;
export type AgentSkillReuseRecord = z.infer<typeof AgentSkillReuseRecordSchema>;
