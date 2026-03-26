export type DashboardPageKey =
  | 'runtime'
  | 'approvals'
  | 'learning'
  | 'evals'
  | 'archives'
  | 'skills'
  | 'evidence'
  | 'connectors'
  | 'skillSources'
  | 'companyAgents';

export interface ApprovalDecisionRecord {
  intent: string;
  decision: string;
  reason?: string;
}

export interface TaskRecord {
  id: string;
  goal: string;
  status: string;
  sessionId?: string;
  runId?: string;
  resolvedWorkflow?: {
    id: string;
    displayName: string;
    version?: string;
  };
  subgraphTrail?: Array<'research' | 'execution' | 'review' | 'skill-install' | 'background-runner'>;
  currentNode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  queueState?: {
    mode: 'foreground' | 'background';
    backgroundRun: boolean;
    status: 'queued' | 'running' | 'waiting_approval' | 'blocked' | 'completed' | 'failed' | 'cancelled';
    enqueuedAt: string;
    startedAt?: string;
    finishedAt?: string;
    lastTransitionAt: string;
    attempt: number;
    leaseOwner?: string;
    leaseExpiresAt?: string;
    lastHeartbeatAt?: string;
  };
  currentStep?: string;
  retryCount?: number;
  maxRetries?: number;
  budgetState?: {
    stepBudget: number;
    stepsConsumed: number;
    retryBudget: number;
    retriesConsumed: number;
    sourceBudget: number;
    sourcesConsumed: number;
  };
  connectorRefs?: string[];
  usedInstalledSkills?: string[];
  usedCompanyWorkers?: string[];
  result?: string;
  approvals: ApprovalDecisionRecord[];
  updatedAt: string;
  createdAt: string;
}

export interface TaskPlan {
  id: string;
  summary: string;
  steps: string[];
  subTasks: Array<{ id: string; title: string; description: string; assignedTo: string; status: string }>;
}

export interface AgentStateRecord {
  agentId: string;
  role: string;
  goal: string;
  subTask?: string;
  plan: string[];
  toolCalls: string[];
  observations: string[];
  shortTermMemory: string[];
  status: string;
  finalOutput?: string;
}

export interface AgentMessageRecord {
  id: string;
  from: string;
  to: string;
  type: string;
  content: string;
  createdAt: string;
}

export interface ReviewRecord {
  taskId: string;
  decision: string;
  notes: string[];
}

export interface TraceRecord {
  node: string;
  at: string;
  summary: string;
}

export interface TaskBundle {
  task: TaskRecord;
  plan?: TaskPlan;
  agents: AgentStateRecord[];
  messages: AgentMessageRecord[];
  review?: ReviewRecord;
  traces: TraceRecord[];
  audit?: {
    taskId: string;
    entries: Array<{
      id: string;
      at: string;
      type: 'trace' | 'approval' | 'governance' | 'usage';
      title: string;
      summary: string;
      detail?: unknown;
      outcome?: string;
    }>;
    browserReplays: Array<{
      sessionId?: string;
      url?: string;
      artifactRef?: string;
      snapshotRef?: string;
      screenshotRef?: string;
      stepCount: number;
    }>;
  };
}

export interface RuleRecord {
  id: string;
  name: string;
  summary: string;
  action: string;
  status?: string;
  invalidationReason?: string;
  supersededById?: string;
  restoredAt?: string;
  createdAt?: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  status: string;
  description: string;
  sourceId?: string;
  installReceiptId?: string;
  requiredCapabilities?: string[];
  requiredConnectors?: string[];
  version?: string;
  successRate?: number;
  promotionState?: string;
  governanceRecommendation?: string;
  sourceRuns?: string[];
  allowedTools?: string[];
  compatibility?: string;
  disabledReason?: string;
  restoredAt?: string;
  updatedAt?: string;
}

export interface ApprovalCenterItem {
  taskId: string;
  goal: string;
  status: string;
  sessionId?: string;
  currentMinistry?: string;
  currentWorker?: string;
  intent: string;
  reason?: string;
}

export interface EvidenceRecord {
  id: string;
  taskId: string;
  taskGoal: string;
  sourceId?: string;
  sourceType: string;
  sourceUrl?: string;
  trustClass: string;
  summary: string;
  detail?: Record<string, unknown>;
  linkedRunId?: string;
  createdAt: string;
  fetchedAt?: string;
  replay?: {
    sessionId?: string;
    url?: string;
    snapshotSummary?: string;
    screenshotRef?: string;
    artifactRef?: string;
    snapshotRef?: string;
    stepTrace?: string[];
    steps?: Array<{
      id: string;
      title: string;
      status: 'completed' | 'failed' | 'running';
      at: string;
      summary?: string;
      artifactRef?: string;
    }>;
  };
}

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
  configurationTemplateId?: 'github-mcp-template' | 'browser-mcp-template';
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
    scope: 'skill-source' | 'company-worker' | 'skill-install' | 'connector';
    targetId: string;
    outcome: 'success' | 'rejected' | 'pending';
    reason?: string;
  }>;
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

export interface ProfilePolicyHintRecord {
  enabledByProfile: boolean;
  recommendedForProfiles: Array<'platform' | 'company' | 'personal' | 'cli'>;
  reason: string;
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

export interface InstalledSkillRecord {
  skillId: string;
  version: string;
  sourceId: string;
  installLocation: string;
  installedAt: string;
  status: string;
  receiptId: string;
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
  phase?: 'requested' | 'approved' | 'downloading' | 'verifying' | 'installing' | 'installed' | 'failed';
  integrity?: string;
  approvedBy?: string;
  rejectedBy?: string;
  reason?: string;
  downloadRef?: string;
  failureCode?: string;
  failureDetail?: string;
  installedAt?: string;
  status: string;
  result?: string;
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

export interface SessionRecord {
  id: string;
  title: string;
  status: string;
  currentTaskId?: string;
  updatedAt: string;
}
