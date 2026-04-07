import type {
  RiskLevel,
  RuntimeProfile,
  SkillInstallPhase,
  SkillInstallStatus,
  SkillSourceDiscoveryMode,
  SkillSourceKind,
  SkillSourcePriority,
  SkillSourceSyncStrategy,
  SkillSuggestionAvailability,
  SkillSuggestionKind,
  SourcePolicyMode,
  TrustClass,
  WorkerDomain,
  WorkerKind,
  SpecialistDomain,
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

export interface SkillSourceRecord {
  id: string;
  name: string;
  kind: SkillSourceKind;
  baseUrl: string;
  discoveryMode?: SkillSourceDiscoveryMode;
  indexUrl?: string;
  packageBaseUrl?: string;
  authRef?: string;
  syncStrategy?: SkillSourceSyncStrategy;
  allowedProfiles?: RuntimeProfile[];
  trustClass: TrustClass;
  priority: SkillSourcePriority;
  enabled: boolean;
  authMode?: 'none' | 'token' | 'oauth' | 'header';
  lastSyncedAt?: string;
  healthState?: 'healthy' | 'degraded' | 'error' | 'unknown' | 'disabled';
  healthReason?: string;
  profilePolicy?: ProfilePolicyHintRecord;
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

export interface SkillManifestRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  publisher: string;
  sourceId: string;
  requiredCapabilities: string[];
  requiredConnectors?: string[];
  allowedTools?: string[];
  sourcePolicy?: {
    mode: SourcePolicyMode;
    preferredUrls?: string[];
  };
  approvalPolicy: WorkflowApprovalPolicy;
  riskLevel: RiskLevel;
  entry: string;
  artifactUrl?: string;
  readmeUrl?: string;
  homepageUrl?: string;
  integrity?: string;
  integrityAlgorithm?: string;
  publishedAt?: string;
  sourceRef?: string;
  sizeBytes?: number;
  summary?: string;
  license?: string;
  compatibility?: string;
  installHints?: {
    requiresApproval?: boolean;
    requiredEnv?: string[];
    postInstallSteps?: string[];
  };
  bootstrap?: boolean;
  ownership?: CapabilityOwnershipRecord;
  domains?: string[];
  specialistAffinity?: string[];
  preferredMinistries?: WorkerDomain[];
  preferredConnectors?: string[];
  triggers?: string[];
  recommendedSpecialists?: SpecialistDomain[];
  executionHints?: string[];
  compressionHints?: string[];
  metadata?: Record<string, string>;
  safety?: SkillSafetyEvaluationRecord;
}

export interface InstalledSkillRecord {
  skillId: string;
  version: string;
  sourceId: string;
  installLocation: string;
  installedAt: string;
  status: SkillInstallStatus;
  receiptId: string;
  ownership?: CapabilityOwnershipRecord;
}

export interface SkillInstallReceipt {
  id: string;
  skillId: string;
  version: string;
  sourceId: string;
  phase?: SkillInstallPhase;
  integrity?: string;
  approvedBy?: string;
  rejectedBy?: string;
  reason?: string;
  downloadRef?: string;
  failureCode?: string;
  failureDetail?: string;
  installedAt?: string;
  status: SkillInstallStatus;
  result?: string;
  repo?: string;
  skillName?: string;
  detailsUrl?: string;
  installCommand?: string;
  triggerReason?: SkillTriggerReason;
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

export type SkillSearchStatus = 'not-needed' | 'suggested' | 'auto-installed' | 'blocked';

export interface SkillSearchStateRecord {
  capabilityGapDetected: boolean;
  status: SkillSearchStatus;
  suggestions: LocalSkillSuggestionRecord[];
  safetyNotes: string[];
  query?: string;
  triggerReason?: SkillTriggerReason;
  remoteSearch?: {
    query: string;
    discoverySource: string;
    resultCount: number;
    executedAt: string;
  };
  mcpRecommendation?: {
    kind: 'skill' | 'connector' | 'not-needed';
    summary: string;
    reason: string;
    connectorTemplateId?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
  };
}

export interface InstallSkillDto {
  manifestId?: string;
  sourceId?: string;
  actor?: string;
}

export interface RemoteSkillSearchDto {
  query: string;
  triggerReason?: SkillTriggerReason;
  limit?: number;
}

export interface RemoteSkillSearchResultRecord {
  query: string;
  discoverySource: string;
  triggerReason: SkillTriggerReason;
  executedAt: string;
  results: LocalSkillSuggestionRecord[];
}

export interface InstallRemoteSkillDto {
  repo: string;
  skillName?: string;
  actor?: string;
  detailsUrl?: string;
  installCommand?: string;
  triggerReason?: SkillTriggerReason;
  summary?: string;
}

export interface ResolveSkillInstallDto {
  actor?: string;
  reason?: string;
}

export interface ConfigureConnectorDto {
  templateId: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
  transport: 'stdio' | 'http';
  displayName?: string;
  endpoint?: string;
  command?: string;
  args?: string[];
  apiKey?: string;
  actor?: string;
  enabled?: boolean;
}

export interface ConfiguredConnectorRecord extends ConfigureConnectorDto {
  connectorId: string;
  configuredAt: string;
  ownership?: CapabilityOwnershipRecord;
  specialistAffinity?: string[];
  preferredMinistries?: WorkerDomain[];
  bootstrap?: boolean;
}

export interface ConnectorDiscoveryHistoryRecord {
  connectorId: string;
  discoveredAt: string;
  discoveryMode: 'registered' | 'remote';
  sessionState: 'stateless' | 'disconnected' | 'connected' | 'error';
  discoveredCapabilities: string[];
  error?: string;
}
