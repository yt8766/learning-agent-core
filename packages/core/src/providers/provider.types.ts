export interface ProviderBudgetState {
  costConsumedUsd?: number;
  costBudgetUsd?: number;
  fallbackModelId?: string;
  overBudget?: boolean;
}

export interface ProviderUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model?: string;
  estimated?: boolean;
  costUsd?: number;
  costCny?: number;
}

export interface ProviderHealthSnapshot {
  providerId: string;
  displayName: string;
  isConfigured: boolean;
}
