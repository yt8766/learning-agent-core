export interface RuntimeCenterUsageAnalyticsRecord {
  totalEstimatedPromptTokens: number;
  totalEstimatedCompletionTokens: number;
  totalEstimatedTokens: number;
  totalEstimatedCostUsd: number;
  totalEstimatedCostCny: number;
  providerMeasuredCostUsd: number;
  providerMeasuredCostCny: number;
  estimatedFallbackCostUsd: number;
  estimatedFallbackCostCny: number;
  measuredRunCount: number;
  estimatedRunCount: number;
  daily: Array<{
    day: string;
    tokens: number;
    costUsd: number;
    costCny: number;
    runs: number;
    overBudget?: boolean;
  }>;
  models: Array<{
    model: string;
    tokens: number;
    costUsd: number;
    costCny: number;
    runCount: number;
  }>;
  budgetPolicy: {
    dailyTokenWarning: number;
    dailyCostCnyWarning: number;
    totalCostCnyWarning: number;
  };
  historyDays?: number;
  historyRange?: {
    earliestDay?: string;
    latestDay?: string;
  };
  persistedDailyHistory?: Array<{
    day: string;
    tokens: number;
    costUsd: number;
    costCny: number;
    runs: number;
    overBudget?: boolean;
    measuredRunCount?: number;
    estimatedRunCount?: number;
    updatedAt: string;
  }>;
  providerBillingStatus?: {
    status: 'disabled' | 'configured' | 'synced' | 'error';
    provider: string;
    source: string;
    syncedAt?: string;
    message?: string;
  };
  providerBillingDailyHistory?: Array<{
    day: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    costCny: number;
    runs: number;
  }>;
  providerBillingTotals?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    costCny: number;
    runs: number;
  };
  recentUsageAudit?: Array<{
    taskId: string;
    day: string;
    totalTokens: number;
    totalCostUsd: number;
    totalCostCny: number;
    measuredCallCount: number;
    estimatedCallCount: number;
    updatedAt: string;
    modelBreakdown: Array<{
      model: string;
      totalTokens: number;
      costUsd: number;
      costCny: number;
      pricingSource?: 'provider' | 'estimated';
      callCount: number;
    }>;
  }>;
  alerts: Array<{
    level: 'info' | 'warning' | 'critical';
    title: string;
    description: string;
  }>;
}

export interface RuntimeCenterKnowledgeOverviewRecord {
  stores: Array<{
    id: string;
    store: 'wenyuan' | 'cangjing';
    displayName: string;
    summary: string;
    rootPath?: string;
    status: 'active' | 'degraded' | 'readonly';
    updatedAt: string;
  }>;
  searchableDocumentCount: number;
  blockedDocumentCount: number;
  sourceCount: number;
  chunkCount: number;
  embeddingCount: number;
  latestReceipts: Array<{
    id: string;
    sourceId: string;
    status: 'completed' | 'partial' | 'failed';
    chunkCount: number;
    embeddedChunkCount: number;
    updatedAt: string;
  }>;
}

export interface RuntimeCenterSubgraphRecord {
  id:
    | 'research'
    | 'execution'
    | 'review'
    | 'skill-install'
    | 'background-runner'
    | 'data-report-sandpack'
    | 'data-report-json'
    | string;
  displayName: string;
  description: string;
  owner: string;
  entryNodes: string[];
}

export interface RuntimeCenterWorkflowVersionRecord {
  workflowId: string;
  version: string;
  status: 'draft' | 'published' | 'active' | 'deprecated';
  updatedAt: string;
  changelog?: string[];
}
