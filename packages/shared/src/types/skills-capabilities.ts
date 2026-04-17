import type {
  CapabilityAttachmentRecord as CoreCapabilityAttachmentRecord,
  CapabilityGovernanceProfileRecord as CoreCapabilityGovernanceProfileRecord,
  CapabilityOwnerType as CoreCapabilityOwnerType,
  CapabilityOwnershipRecord as CoreCapabilityOwnershipRecord,
  CapabilityScope as CoreCapabilityScope,
  CapabilityTier as CoreCapabilityTier,
  CapabilityTrigger as CoreCapabilityTrigger,
  CapabilityType as CoreCapabilityType,
  GovernanceProfileRecord as CoreGovernanceProfileRecord,
  RequestedExecutionHints as CoreRequestedExecutionHints
} from '@agent/core';
import type {
  RiskLevel,
  RuntimeProfile,
  SkillSuggestionAvailability,
  SkillSuggestionKind,
  SourcePolicyMode,
  SpecialistDomain,
  TrustClass,
  WorkerDomain,
  WorkerKind,
  WorkflowApprovalPolicy
} from './primitives';

export type CapabilityOwnerType = CoreCapabilityOwnerType;
export type CapabilityTier = CoreCapabilityTier;
export type CapabilityType = CoreCapabilityType;
export type CapabilityScope = CoreCapabilityScope;
export type CapabilityTrigger = CoreCapabilityTrigger;
export type CapabilityOwnershipRecord = CoreCapabilityOwnershipRecord;
export type RequestedExecutionHints = CoreRequestedExecutionHints;

export interface CapabilityAugmentationRecord {
  id: string;
  kind: 'skill' | 'connector' | 'tool' | 'both' | 'none';
  status: 'suggested' | 'waiting_approval' | 'installing' | 'configuring' | 'ready' | 'failed' | 'blocked';
  requestedBy: 'user' | 'supervisor' | 'specialist' | 'workflow';
  targetKind?: CapabilityType;
  target?: string;
  reason: string;
  owner: CapabilityOwnershipRecord;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export type CapabilityAttachmentRecord = CoreCapabilityAttachmentRecord;
export type CapabilityGovernanceProfileRecord = CoreCapabilityGovernanceProfileRecord;
export type GovernanceProfileRecord = CoreGovernanceProfileRecord;

export interface CapabilityPromotionRecord {
  capabilityId: string;
  fromOwnerType: CapabilityOwnerType;
  toOwnerType: Exclude<CapabilityOwnerType, 'user-attached' | 'runtime-derived'>;
  reason: string;
  recommendedAt: string;
}

export interface BootstrapSkillRecord {
  id: string;
  displayName: string;
  description: string;
  bootstrap: true;
  ownerType: 'shared';
  activationPhase: 'session_start' | 'task_create' | 'pre_execution';
  responsibilities: string[];
}

export interface WorkerDefinition {
  id: string;
  ministry: WorkerDomain;
  kind?: WorkerKind;
  displayName: string;
  defaultModel: string;
  supportedCapabilities: string[];
  reviewPolicy: 'none' | 'self-check' | 'mandatory-xingbu';
  sourceId?: string;
  owner?: string;
  tags?: string[];
  requiredConnectors?: string[];
  preferredContexts?: string[];
  allowedSourcePolicies?: SourcePolicyMode[];
}

export interface ProfilePolicyHintRecord {
  enabledByProfile: boolean;
  recommendedForProfiles: RuntimeProfile[];
  reason: string;
}

export interface SkillSafetyEvaluationRecord {
  verdict: 'allow' | 'needs-approval' | 'blocked';
  trustScore: number;
  sourceTrustClass?: TrustClass;
  profileCompatible?: boolean;
  maxRiskLevel: RiskLevel;
  reasons: string[];
  riskyTools: string[];
  missingDeclarations: string[];
}

export type SkillTriggerReason = 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed';

export interface LocalSkillSuggestionRecord {
  id: string;
  kind: SkillSuggestionKind;
  displayName: string;
  summary: string;
  sourceId?: string;
  score: number;
  availability: SkillSuggestionAvailability;
  reason: string;
  requiredCapabilities: string[];
  requiredConnectors?: string[];
  version?: string;
  sourceLabel?: string;
  sourceTrustClass?: TrustClass;
  installationMode?: 'builtin' | 'configured' | 'marketplace-managed';
  successRate?: number;
  governanceRecommendation?: 'promote' | 'keep-lab' | 'disable' | 'retire';
  safety?: SkillSafetyEvaluationRecord;
  repo?: string;
  skillName?: string;
  detailsUrl?: string;
  installCommand?: string;
  discoverySource?: string;
  triggerReason?: SkillTriggerReason;
  bootstrap?: boolean;
  ownership?: CapabilityOwnershipRecord;
  domains?: string[];
  specialistAffinity?: string[];
  preferredMinistries?: WorkerDomain[];
  preferredConnectors?: string[];
  allowedTools?: string[];
  triggers?: string[];
  recommendedSpecialists?: SpecialistDomain[];
  executionHints?: string[];
  compressionHints?: string[];
}
