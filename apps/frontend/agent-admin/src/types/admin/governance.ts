export interface ConnectorCapabilityRecord {
  id: string;
  displayName: string;
  toolName: string;
  category: string;
  riskLevel: string;
  requiresApproval: boolean;
  effectiveApprovalMode?: 'allow' | 'deny' | 'require-approval' | 'observe' | 'default';
  policyReason?: string;
  trustClass?: string;
  approvalPolicy?: string;
  healthState?: string;
  isPrimaryForTool?: boolean;
  fallbackAvailable?: boolean;
  dataScope?: string;
  writeScope?: string;
  usageCount?: number;
  recentTaskGoals?: string[];
  recentTasks?: Array<{
    taskId: string;
    goal: string;
    status: string;
    approvalCount: number;
    latestTraceSummary?: string;
  }>;
}

export interface ConnectorHealthRecord {
  connectorId: string;
  healthState: 'healthy' | 'degraded' | 'error' | 'unknown' | 'disabled';
  reason?: string;
  checkedAt: string;
  transport?: string;
  implementedCapabilityCount?: number;
  discoveredCapabilityCount?: number;
}

export interface ApprovalPolicyRecord {
  id: string;
  scope: 'connector' | 'worker' | 'skill-source' | 'capability';
  targetId: string;
  mode: string;
  reason: string;
  effect?: 'allow' | 'deny' | 'require-approval' | 'observe';
  connectorId?: string;
  workerId?: string;
  sourceId?: string;
  capabilityId?: string;
  matchedCount?: number;
}

export interface ApprovalScopePolicyRecord {
  id: string;
  scope: 'session' | 'always';
  status: 'active' | 'revoked';
  matchKey: string;
  actor?: string;
  sourceDomain?: string;
  intent?: string;
  toolName?: string;
  riskCode?: string;
  requestedBy?: string;
  commandPreview?: string;
  approvalScope?: 'once' | 'session' | 'always';
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
  revokedBy?: string;
  lastMatchedAt?: string;
  matchCount?: number;
}

export interface ProfilePolicyHintRecord {
  enabledByProfile: boolean;
  recommendedForProfiles: Array<'platform' | 'company' | 'personal' | 'cli'>;
  reason: string;
}

export interface ConnectorRecord {
  id: string;
  displayName: string;
  transport: string;
  enabled: boolean;
  source?: string;
  trustClass?: string;
  authMode?: string;
  dataScope?: string;
  writeScope?: string;
  installationMode?: 'builtin' | 'configured' | 'marketplace-managed';
  allowedProfiles?: Array<'platform' | 'company' | 'personal' | 'cli'>;
  endpoint?: string;
  command?: string;
  args?: string[];
  configuredAt?: string;
  configurationTemplateId?: 'github-mcp-template' | 'browser-mcp-template' | 'lark-mcp-template';
  healthState: string;
  healthReason?: string;
  capabilityCount: number;
  implementedCapabilityCount?: number;
  discoveredCapabilityCount?: number;
  discoveredCapabilities?: string[];
  discoveryMode?: 'registered' | 'remote';
  sessionState?: 'stateless' | 'disconnected' | 'connected' | 'error';
  sessionCreatedAt?: string;
  sessionLastActivityAt?: string;
  sessionRequestCount?: number;
  sessionIdleMs?: number;
  lastDiscoveredAt?: string;
  lastDiscoveryError?: string;
  discoveryHistory?: Array<{
    connectorId: string;
    discoveredAt: string;
    discoveryMode: 'registered' | 'remote';
    sessionState: 'stateless' | 'disconnected' | 'connected' | 'error';
    discoveredCapabilities: string[];
    error?: string;
  }>;
  approvalRequiredCount: number;
  highRiskCount: number;
  activeTaskCount?: number;
  totalTaskCount?: number;
  successRate?: number;
  recentTaskGoals?: string[];
  firstUsedAt?: string;
  lastUsedAt?: string;
  recentFailureReason?: string;
  recentGovernanceAudits?: Array<{
    id: string;
    at: string;
    actor: string;
    action: string;
    scope:
      | 'skill-source'
      | 'company-worker'
      | 'skill-install'
      | 'connector'
      | 'counselor-selector'
      | 'learning-conflict';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }>;
  knowledgeIngestion?: {
    sourceCount: number;
    searchableDocumentCount: number;
    blockedDocumentCount: number;
    latestReceiptIds: string[];
  };
  profilePolicy?: ProfilePolicyHintRecord;
  capabilities: ConnectorCapabilityRecord[];
  healthChecks?: ConnectorHealthRecord[];
  approvalPolicies?: ApprovalPolicyRecord[];
}

export interface SkillSourceRecord {
  id: string;
  name: string;
  kind: string;
  baseUrl: string;
  discoveryMode?: 'local-dir' | 'remote-index' | 'git-registry' | 'http-manifest';
  indexUrl?: string;
  packageBaseUrl?: string;
  authRef?: string;
  syncStrategy?: 'manual' | 'scheduled' | 'on-demand';
  allowedProfiles?: Array<'platform' | 'company' | 'personal' | 'cli'>;
  trustClass: string;
  priority: string;
  enabled: boolean;
  authMode?: string;
  lastSyncedAt?: string;
  healthState?: string;
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
  approvalPolicy: string;
  riskLevel: string;
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
  metadata?: Record<string, string>;
  safety?: {
    verdict: 'allow' | 'needs-approval' | 'blocked';
    trustScore: number;
    sourceTrustClass?: string;
    profileCompatible?: boolean;
    maxRiskLevel: string;
    reasons: string[];
    riskyTools: string[];
    missingDeclarations: string[];
  };
}

import type {
  CompanyAgentRecord as SharedCompanyAgentRecord,
  InstalledSkillRecord as SharedInstalledSkillRecord,
  SkillInstallReceipt as SharedSkillInstallReceipt
} from '@agent/shared';

export type InstalledSkillRecord = SharedInstalledSkillRecord & {
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
};

export type SkillInstallReceipt = SharedSkillInstallReceipt & {
  status: string;
  result?: string;
};

export type CompanyAgentRecord = SharedCompanyAgentRecord & {
  activeTaskCount?: number;
  totalTaskCount?: number;
  successRate?: number;
  promotionState?: string;
  sourceRuns?: string[];
  recentTaskGoals?: string[];
  governanceStatus?: string;
};

export interface SessionRecord {
  id: string;
  title: string;
  status: string;
  currentTaskId?: string;
  updatedAt: string;
}
