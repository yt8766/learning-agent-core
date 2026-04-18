import { z } from 'zod';

import {
  CapabilityAugmentationRecordSchema,
  CapabilityAttachmentRecordSchema,
  CapabilityGovernanceProfileRecordSchema,
  CapabilityOwnerTypeSchema,
  CapabilityOwnershipRecordSchema,
  CapabilityScopeSchema,
  CapabilityTierSchema,
  CapabilityTriggerSchema,
  CapabilityTypeSchema,
  GovernanceProfileRecordSchema,
  InstalledSkillRecordSchema,
  LocalSkillSuggestionRecordSchema,
  ProfilePolicyHintRecordSchema,
  RequestedExecutionHintsSchema,
  SourcePolicyModeSchema,
  SpecialistDomainSchema,
  WorkerDefinitionSchema,
  CompanyAgentRecordSchema,
  SkillManifestRecordSchema,
  SkillInstallReceiptSchema,
  SkillSafetyEvaluationRecordSchema,
  SkillSourceRecordSchema,
  SkillCardSchema,
  SkillConnectorContractSchema,
  SkillSearchMcpRecommendationSchema,
  SkillSearchRemoteSearchRecordSchema,
  SkillSearchStateRecordSchema,
  SkillSearchStatusSchema,
  SkillStepSchema,
  SkillSuggestionAvailabilitySchema,
  SkillSuggestionKindSchema,
  SkillTriggerReasonSchema,
  SkillToolContractSchema,
  WorkerKindSchema,
  WorkerDomainSchema
} from '../schemas';

export type CapabilityOwnerType = z.infer<typeof CapabilityOwnerTypeSchema>;
export type SourcePolicyMode = z.infer<typeof SourcePolicyModeSchema>;
export type WorkerKind = z.infer<typeof WorkerKindSchema>;
export type WorkerDomain = z.infer<typeof WorkerDomainSchema>;
export type SpecialistDomain = z.infer<typeof SpecialistDomainSchema>;
export type WorkerDefinition = z.infer<typeof WorkerDefinitionSchema>;
export type CapabilityTier = z.infer<typeof CapabilityTierSchema>;
export type CapabilityType = z.infer<typeof CapabilityTypeSchema>;
export type CapabilityScope = z.infer<typeof CapabilityScopeSchema>;
export type CapabilityTrigger = z.infer<typeof CapabilityTriggerSchema>;
export type CapabilityOwnershipRecord = z.infer<typeof CapabilityOwnershipRecordSchema>;
export type RequestedExecutionHints = z.infer<typeof RequestedExecutionHintsSchema>;
export type CapabilityAugmentationRecord = z.infer<typeof CapabilityAugmentationRecordSchema>;
export type CapabilityAttachmentRecord = z.infer<typeof CapabilityAttachmentRecordSchema>;
export type CapabilityGovernanceProfileRecord = z.infer<typeof CapabilityGovernanceProfileRecordSchema>;
export type GovernanceProfileRecord = z.infer<typeof GovernanceProfileRecordSchema>;
export type ProfilePolicyHintRecord = z.infer<typeof ProfilePolicyHintRecordSchema>;
export type InstalledSkillRecord = z.infer<typeof InstalledSkillRecordSchema>;
export type SkillInstallReceipt = z.infer<typeof SkillInstallReceiptSchema>;
export type CompanyAgentRecord = z.infer<typeof CompanyAgentRecordSchema>;
export type SkillSuggestionKind = z.infer<typeof SkillSuggestionKindSchema>;
export type SkillSuggestionAvailability = z.infer<typeof SkillSuggestionAvailabilitySchema>;
export type SkillTriggerReason = z.infer<typeof SkillTriggerReasonSchema>;
export type SkillSafetyEvaluationRecord = z.infer<typeof SkillSafetyEvaluationRecordSchema>;
export type SkillSourceRecord = z.infer<typeof SkillSourceRecordSchema>;
export type SkillManifestRecord = z.infer<typeof SkillManifestRecordSchema>;
export type LocalSkillSuggestionRecord = z.infer<typeof LocalSkillSuggestionRecordSchema>;
export type SkillSearchStatus = z.infer<typeof SkillSearchStatusSchema>;
export type SkillSearchRemoteSearchRecord = z.infer<typeof SkillSearchRemoteSearchRecordSchema>;
export type SkillSearchMcpRecommendation = z.infer<typeof SkillSearchMcpRecommendationSchema>;
export type SkillSearchStateRecord = z.infer<typeof SkillSearchStateRecordSchema>;
export type SkillStep = z.infer<typeof SkillStepSchema>;
export type SkillToolContract = z.infer<typeof SkillToolContractSchema>;
export type SkillConnectorContract = z.infer<typeof SkillConnectorContractSchema>;
export type SkillCard = z.infer<typeof SkillCardSchema>;
