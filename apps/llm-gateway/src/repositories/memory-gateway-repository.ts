import { createVirtualApiKey } from '../keys/api-key';
import { cloneModelConfig, type GatewayModelConfig } from '../models/model-registry';
import type { ApiKeyRecord, GatewayRepository } from './gateway-repository';

export interface SeededMemoryGatewayRepository {
  repository: GatewayRepository;
  seedKeyPlaintext: string;
}

export function createMemoryGatewayRepository(seed?: {
  apiKeys?: ApiKeyRecord[];
  models?: GatewayModelConfig[];
}): GatewayRepository {
  const apiKeysByPrefix = new Map((seed?.apiKeys ?? []).map(record => [record.keyPrefix, cloneApiKeyRecord(record)]));
  const modelsByAlias = new Map((seed?.models ?? []).map(record => [record.alias, cloneModelConfig(record)]));

  return {
    async findApiKeyByPrefix(prefix) {
      const record = apiKeysByPrefix.get(prefix);
      return record ? cloneApiKeyRecord(record) : undefined;
    },
    async saveApiKey(record) {
      apiKeysByPrefix.set(record.keyPrefix, cloneApiKeyRecord(record));
    },
    async listModels() {
      return Array.from(modelsByAlias.values()).map(cloneModelConfig);
    },
    async findModelByAlias(alias) {
      const record = modelsByAlias.get(alias);
      return record ? cloneModelConfig(record) : undefined;
    },
    async saveModel(record) {
      modelsByAlias.set(record.alias, cloneModelConfig(record));
    }
  };
}

export async function seeded(secret = 'local-secret'): Promise<SeededMemoryGatewayRepository> {
  const created = await createVirtualApiKey(secret);
  const now = new Date().toISOString();
  const repository = createMemoryGatewayRepository({
    apiKeys: [
      {
        id: 'key_seed',
        name: 'Seed key',
        keyPrefix: created.prefix,
        keyHash: created.hash,
        status: 'active',
        models: ['gpt-main'],
        rpmLimit: 60,
        tpmLimit: 100000,
        dailyTokenLimit: 500000,
        dailyCostLimit: 10,
        usedTokensToday: 0,
        usedCostToday: 0,
        expiresAt: null,
        lastUsedAt: null,
        createdAt: now,
        revokedAt: null
      }
    ],
    models: [
      {
        alias: 'gpt-main',
        provider: 'mock',
        providerModel: 'mock-gpt-main',
        enabled: true,
        contextWindow: 128000,
        fallbackAliases: [],
        adminOnly: false
      }
    ]
  });

  return {
    repository,
    seedKeyPlaintext: created.plaintext
  };
}

function cloneApiKeyRecord(record: ApiKeyRecord): ApiKeyRecord {
  return {
    ...record,
    models: [...record.models]
  };
}
