export type KnownProviderType = 'zhipu' | 'openai' | 'openai-compatible' | 'ollama' | 'anthropic' | 'minimax' | 'kimi';
export type ProviderType = KnownProviderType | (string & {});

export interface ProviderSettingsRecord {
  id: string;
  type: ProviderType;
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
  compressionEnabled: boolean;
  compressionMessageThreshold: number;
  compressionKeepRecentMessages: number;
  compressionKeepLeadingMessages: number;
  compressionMaxSummaryChars: number;
}

export interface RuntimeBackgroundConfig {
  enabled: boolean;
  workerPoolSize: number;
  leaseTtlMs: number;
  heartbeatMs: number;
  pollMs: number;
  runnerIdPrefix: string;
}

export interface LangGraphCheckpointerConfig {
  provider: 'memory' | 'postgres';
  postgres?: {
    connectionString?: string;
    schema: string;
    setupOnInitialize: boolean;
  };
}

export interface LangGraphStoreConfig {
  provider: 'memory' | 'postgres';
  postgres?: {
    connectionString?: string;
    schema: string;
    setupOnInitialize: boolean;
  };
  semanticSearch: {
    enabled: boolean;
    fields: string[];
    distanceMetric?: 'cosine' | 'l2' | 'inner_product';
  };
}

export interface DailyTechBriefingConfig {
  enabled: boolean;
  schedule: string;
  sendEmptyDigest: boolean;
  maxItemsPerCategory: number;
  duplicateWindowDays: number;
  maxNonCriticalItemsPerCategory: number;
  maxCriticalItemsPerCategory: number;
  maxTotalItemsPerCategory: number;
  sendOnlyDelta: boolean;
  resendOnlyOnMaterialChange: boolean;
  larkDigestMode: 'markdown-summary' | 'interactive-card' | 'dual';
  larkDetailMode?: 'summary' | 'detailed';
  sourcePolicy: 'tiered-authority' | 'official-only';
  webhookEnvVar: string;
  webhookUrl?: string;
  translationEnabled: boolean;
  translationModel: string;
  aiLookbackDays: number;
  frontendLookbackDays: number;
  securityLookbackDays: number;
  categories: {
    frontendSecurity: DailyTechBriefingCategoryConfig;
    generalSecurity: DailyTechBriefingCategoryConfig;
    devtoolSecurity: DailyTechBriefingCategoryConfig;
    aiTech: DailyTechBriefingCategoryConfig;
    frontendTech: DailyTechBriefingCategoryConfig;
    backendTech: DailyTechBriefingCategoryConfig;
    cloudInfraTech: DailyTechBriefingCategoryConfig;
  };
}

export interface DailyTechBriefingCategoryConfig {
  enabled: boolean;
  baseIntervalHours: number;
  lookbackDays: number;
  adaptivePolicy: {
    hotThresholdRuns: number;
    cooldownEmptyRuns: number;
    allowedIntervalHours: number[];
  };
}

export interface RuntimeSettingsOverrides {
  profile?: RuntimeProfile;
  workspaceRoot?: string;
  memoryFilePath?: string;
  rulesFilePath?: string;
  vectorIndexFilePath?: string;
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
  policy?: Partial<Omit<PolicyConfig, 'budget'>> & { budget?: Partial<BudgetPolicy> };
  contextStrategy?: Partial<ContextStrategy>;
  runtimeBackground?: Partial<RuntimeBackgroundConfig>;
  langGraphCheckpointer?: Partial<LangGraphCheckpointerConfig> & {
    postgres?: Partial<NonNullable<LangGraphCheckpointerConfig['postgres']>>;
  };
  langGraphStore?: Partial<LangGraphStoreConfig> & {
    postgres?: Partial<NonNullable<LangGraphStoreConfig['postgres']>>;
    semanticSearch?: Partial<LangGraphStoreConfig['semanticSearch']>;
  };
  dailyTechBriefing?: Partial<DailyTechBriefingConfig>;
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
  vectorIndexFilePath: string;
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
  langGraphCheckpointer: LangGraphCheckpointerConfig;
  langGraphStore: LangGraphStoreConfig;
  dailyTechBriefing: DailyTechBriefingConfig;
  embeddings: {
    provider: string;
    model: string;
    dimensions: number;
    endpoint: string;
    apiKey: string;
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
