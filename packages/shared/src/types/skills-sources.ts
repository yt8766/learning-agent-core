import type {
  RuntimeProfile,
  SkillInstallPhase,
  SkillInstallStatus,
  SkillSourceDiscoveryMode,
  SkillSourceKind,
  SkillSourcePriority,
  SkillSourceSyncStrategy,
  SourcePolicyMode,
  TrustClass,
  WorkerDomain,
  WorkflowApprovalPolicy
} from './primitives';
import type {
  CapabilityOwnershipRecord,
  ProfilePolicyHintRecord,
  SkillSafetyEvaluationRecord,
  SkillTriggerReason
} from './skills-capabilities';

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
  riskLevel: import('./primitives').RiskLevel;
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
  recommendedSpecialists?: import('./primitives').SpecialistDomain[];
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
  governanceRecommendation?: string;
  allowedTools?: string[];
  compatibility?: string;
  activeTaskCount?: number;
  totalTaskCount?: number;
  recentTaskGoals?: string[];
  firstUsedAt?: string;
  lastUsedAt?: string;
  successRate?: number;
  lastOutcome?: 'success' | 'failure';
  recentFailureReason?: string;
  recentTasks?: Array<{
    taskId: string;
    goal: string;
    status: string;
    approvalCount: number;
    latestTraceSummary?: string;
  }>;
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

export interface CompanyAgentRecord {
  id: string;
  enabled?: boolean;
  ministry: string;
  kind?: string;
  displayName: string;
  defaultModel: string;
  supportedCapabilities: string[];
  reviewPolicy: string;
  sourceId?: string;
  owner?: string;
  tags?: string[];
  requiredConnectors?: string[];
  activeTaskCount?: number;
  totalTaskCount?: number;
  successRate?: number;
  promotionState?: string;
  sourceRuns?: string[];
  recentTaskGoals?: string[];
  governanceStatus?: string;
}

export interface SkillSourcesCenterRecord {
  sources: SkillSourceRecord[];
  manifests: SkillManifestRecord[];
  installed: InstalledSkillRecord[];
  receipts: SkillInstallReceipt[];
}
