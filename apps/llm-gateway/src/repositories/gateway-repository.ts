import type { KeyStatus } from '../contracts';
import type { GatewayModelConfig } from '../models/model-registry';

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  status: KeyStatus;
  models: string[];
  rpmLimit: number | null;
  tpmLimit: number | null;
  dailyTokenLimit: number | null;
  dailyCostLimit: number | null;
  usedTokensToday: number;
  usedCostToday: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface GatewayRepository {
  findApiKeyByPrefix(prefix: string): Promise<ApiKeyRecord | undefined>;
  saveApiKey(record: ApiKeyRecord): Promise<void>;
  listModels(): Promise<GatewayModelConfig[]>;
  findModelByAlias(alias: string): Promise<GatewayModelConfig | undefined>;
  saveModel(record: GatewayModelConfig): Promise<void>;
}
