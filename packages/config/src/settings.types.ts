export interface ProviderSettingsRecord {
  id: string;
  type: 'zhipu' | 'openai' | 'openai-compatible' | 'ollama' | 'anthropic';
  displayName?: string;
  apiKey?: string;
  baseUrl?: string;
  models: string[];
  roleModels?: Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', string>>;
}

export interface RoutingPolicyRecord {
  primary: string;
  fallback?: string[];
}

export type RuntimeProfile = 'platform' | 'company' | 'personal' | 'cli';

export interface BudgetPolicy {
  stepBudget: number;
  retryBudget: number;
  sourceBudget: number;
  maxCostPerTaskUsd: number;
  fallbackModelId: string;
}

export interface MemoryPolicy {
  localFirst: boolean;
}

export interface LearningPolicy {
  autoLearnPreferences: boolean;
  autoLearnHeuristics: boolean;
  autoLearnTaskExperience: boolean;
  requireConfirmationOnConflict: boolean;
}

export interface ApprovalPolicyConfig {
  safeWriteAutoApprove: boolean;
  destructiveActionRequireApproval: boolean;
}

export interface SuggestionPolicy {
  expertAdviceDefault: boolean;
  autoSearchSkillsOnGap: boolean;
}

export interface PolicyConfig {
  approvalMode: 'strict' | 'balanced' | 'auto';
  skillInstallMode: 'manual' | 'low-risk-auto';
  learningMode: 'controlled' | 'aggressive';
  sourcePolicyMode: 'internal-only' | 'controlled-first' | 'open-web-allowed';
  budget: BudgetPolicy;
  memoryPolicy: MemoryPolicy;
  learningPolicy: LearningPolicy;
  approvalPolicy: ApprovalPolicyConfig;
  suggestionPolicy: SuggestionPolicy;
}

export interface ContextStrategy {
  maxTokens: number;
  recentTurns: number;
  summaryInterval: number;
  ragTopK: number;
  compressionModel: string;
}

export interface RuntimeBackgroundConfig {
  enabled: boolean;
  workerPoolSize: number;
  leaseTtlMs: number;
  heartbeatMs: number;
  pollMs: number;
  runnerIdPrefix: string;
}

export interface RuntimeSettingsOverrides {
  profile?: RuntimeProfile;
  workspaceRoot?: string;
  memoryFilePath?: string;
  rulesFilePath?: string;
  tasksStateFilePath?: string;
  semanticCacheFilePath?: string;
  skillsRoot?: string;
  pluginsLabRoot?: string;
  skillSourcesRoot?: string;
  skillPackagesRoot?: string;
  skillReceiptsRoot?: string;
  skillInternalRoot?: string;
  registryFilePath?: string;
  knowledgeRoot?: string;
  port?: number;
  llmProvider?: 'zhipu';
  zhipuApiKey?: string;
  zhipuApiBaseUrl?: string;
  zhipuModels?: RuntimeSettings['zhipuModels'];
  zhipuThinking?: RuntimeSettings['zhipuThinking'];
  providers?: ProviderSettingsRecord[];
  routing?: Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', RoutingPolicyRecord>>;
  policy?: Partial<PolicyConfig>;
  contextStrategy?: Partial<ContextStrategy>;
  runtimeBackground?: Partial<RuntimeBackgroundConfig>;
}

export interface LoadSettingsOptions {
  env?: NodeJS.ProcessEnv;
  workspaceRoot?: string;
  profile?: RuntimeProfile;
  overrides?: RuntimeSettingsOverrides;
}

export interface RuntimeSettings {
  profile: RuntimeProfile;
  workspaceRoot: string;
  memoryFilePath: string;
  rulesFilePath: string;
  tasksStateFilePath: string;
  semanticCacheFilePath: string;
  skillsRoot: string;
  pluginsLabRoot: string;
  skillSourcesRoot: string;
  skillPackagesRoot: string;
  skillReceiptsRoot: string;
  skillInternalRoot: string;
  registryFilePath: string;
  knowledgeRoot: string;
  port: number;
  llmProvider: 'zhipu';
  zhipuApiKey: string;
  zhipuApiBaseUrl: string;
  zhipuModels: {
    manager: string;
    research: string;
    executor: string;
    reviewer: string;
  };
  zhipuThinking: {
    manager: boolean;
    research: boolean;
    executor: boolean;
    reviewer: boolean;
  };
  providers: ProviderSettingsRecord[];
  routing: Partial<Record<'manager' | 'research' | 'executor' | 'reviewer', RoutingPolicyRecord>>;
  policy: PolicyConfig;
  contextStrategy: ContextStrategy;
  runtimeBackground: RuntimeBackgroundConfig;
  embeddings: {
    provider: 'glm';
    model: 'Embedding-3';
    dimensions: number;
    endpoint: string;
  };
  mcp: {
    bigmodelApiKey: string;
    webSearchEndpoint: string;
    webReaderEndpoint: string;
    zreadEndpoint: string;
    researchHttpEndpoint: string;
    researchHttpApiKey: string;
    visionMode: 'ZHIPU' | 'ZAI';
    stdioSessionIdleTtlMs: number;
    stdioSessionMaxCount: number;
  };
  providerAudit: {
    primaryProvider: string;
    adapters: Array<{
      provider: string;
      endpoint: string;
      apiKey: string;
      source: string;
    }>;
  };
}
