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

export type CapabilityOwnerType =
  | 'shared'
  | 'ministry-owned'
  | 'specialist-owned'
  | 'imperial-attached'
  | 'temporary-assignment'
  | 'user-attached'
  | 'runtime-derived';

export type CapabilityTier =
  | 'shared'
  | 'ministry-owned'
  | 'specialist-owned'
  | 'imperial-attached'
  | 'temporary-assignment';

export type CapabilityType = 'skill' | 'connector' | 'tool';

export type CapabilityScope = 'task' | 'session' | 'workspace';

export type CapabilityTrigger =
  | 'bootstrap'
  | 'user_requested'
  | 'specialist_requested'
  | 'capability_gap_detected'
  | 'workflow_required';

export interface CapabilityOwnershipRecord {
  ownerType: CapabilityOwnerType;
  ownerId?: string;
  tier?: CapabilityTier;
  capabilityType: CapabilityType;
  scope: CapabilityScope;
  trigger: CapabilityTrigger;
  consumedByMinistry?: WorkerDomain;
  consumedBySpecialist?: string;
}

export interface RequestedExecutionHints {
  requestedSpecialist?: string;
  requestedSkill?: string;
  requestedConnectorTemplate?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
  requestedCapability?: string;
  preferredModelId?: string;
  preferredMode?: 'direct-reply' | 'workflow' | 'research-first';
  createSkillIntent?: {
    description: string;
    displayName?: string;
  };
}

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

export interface CapabilityAttachmentRecord {
  id: string;
  displayName: string;
  kind: CapabilityType;
  owner: CapabilityOwnershipRecord;
  enabled: boolean;
  sourceId?: string;
  permission?: 'readonly' | 'write' | 'external-side-effect' | 'publish';
  riskLevel?: RiskLevel;
  promotionStatus?: 'candidate' | 'active' | 'stable' | 'deprecated';
  deprecated_in_favor_of?: string;
  stats?: {
    successCount?: number;
    failureCount?: number;
    avgTokenCost?: number;
    avgCostUsd?: number;
  };
  capabilityTrust?: {
    trustLevel: 'high' | 'medium' | 'low';
    trustTrend: 'up' | 'steady' | 'down';
    lastGovernanceSummary?: string;
    lastReason?: string;
    updatedAt: string;
  };
  governanceProfile?: {
    reportCount: number;
    promoteCount: number;
    holdCount: number;
    downgradeCount: number;
    passCount: number;
    reviseRequiredCount: number;
    blockCount: number;
    lastTaskId?: string;
    lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    lastTrustAdjustment?: 'promote' | 'hold' | 'downgrade';
    recentOutcomes?: Array<{
      taskId: string;
      reviewDecision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
      trustAdjustment: 'promote' | 'hold' | 'downgrade';
      updatedAt: string;
    }>;
    updatedAt: string;
  };
  metadata?: {
    steps?: Array<{
      title: string;
      instruction: string;
      toolNames?: string[];
    }>;
    requiredTools?: string[];
    optionalTools?: string[];
    approvalSensitiveTools?: string[];
    preferredConnectors?: string[];
    requiredConnectors?: string[];
  };
  createdAt: string;
  updatedAt?: string;
}

export interface CapabilityGovernanceProfileRecord {
  capabilityId: string;
  displayName: string;
  ownerType: CapabilityOwnerType;
  kind: CapabilityType;
  trustLevel: 'high' | 'medium' | 'low';
  trustTrend: 'up' | 'steady' | 'down';
  reportCount: number;
  promoteCount: number;
  holdCount: number;
  downgradeCount: number;
  passCount: number;
  reviseRequiredCount: number;
  blockCount: number;
  lastTaskId?: string;
  lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
  lastTrustAdjustment?: 'promote' | 'hold' | 'downgrade';
  lastReason?: string;
  lastGovernanceSummary?: string;
  recentOutcomes?: Array<{
    taskId: string;
    reviewDecision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    trustAdjustment: 'promote' | 'hold' | 'downgrade';
    updatedAt: string;
  }>;
  updatedAt: string;
}

export interface GovernanceProfileRecord {
  entityId: string;
  displayName: string;
  entityKind: 'ministry' | 'worker' | 'specialist';
  trustLevel: 'high' | 'medium' | 'low';
  trustTrend: 'up' | 'steady' | 'down';
  reportCount: number;
  promoteCount: number;
  holdCount: number;
  downgradeCount: number;
  passCount: number;
  reviseRequiredCount: number;
  blockCount: number;
  lastTaskId?: string;
  lastReviewDecision?: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
  lastTrustAdjustment?: 'promote' | 'hold' | 'downgrade';
  lastReason?: string;
  lastGovernanceSummary?: string;
  recentOutcomes?: Array<{
    taskId: string;
    reviewDecision: 'pass' | 'revise_required' | 'block' | 'needs_human_approval';
    trustAdjustment: 'promote' | 'hold' | 'downgrade';
    updatedAt: string;
  }>;
  updatedAt: string;
}

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
