import {
  createGatewayService,
  type GatewayKeyRecord,
  type GatewayModelRecord
} from '../../src/gateway/gateway-service.js';
import { setGatewayServiceForRoutes } from '../../src/gateway/route-runtime.js';
import { createMockProviderAdapter } from '../../src/providers/mock-provider-adapter.js';

const VALID_TEST_TOKEN = 'sk-llmgw_test';

interface SeedGatewayServiceOptions {
  key?: Partial<GatewayKeyRecord>;
  models?: string[];
  providerContent?: string;
}

interface RouteTestRuntime {
  readonly authorization: string;
  seedGatewayService(options?: SeedGatewayServiceOptions): void;
  reset(): void;
}

export function createRouteTestRuntime(options: SeedGatewayServiceOptions = {}): RouteTestRuntime {
  const runtime: RouteTestRuntime = {
    authorization: `Bearer ${VALID_TEST_TOKEN}`,
    seedGatewayService(seedOptions = {}) {
      setGatewayServiceForRoutes(createSeededGatewayService({ ...options, ...seedOptions }));
    },
    reset() {
      setGatewayServiceForRoutes(null);
    }
  };

  runtime.seedGatewayService(options);

  return runtime;
}

export function resetRouteTestRuntime(): void {
  setGatewayServiceForRoutes(null);
}

function createSeededGatewayService(options: SeedGatewayServiceOptions) {
  const modelAliases = options.models ?? ['gpt-main'];
  const key: GatewayKeyRecord = {
    id: options.key?.id ?? 'key_test',
    name: options.key?.name ?? 'Route test key',
    status: options.key?.status ?? 'active',
    models: options.key?.models ?? modelAliases,
    rpmLimit: options.key?.rpmLimit ?? 60,
    tpmLimit: options.key?.tpmLimit ?? 100_000,
    dailyTokenLimit: options.key?.dailyTokenLimit ?? 500_000,
    dailyCostLimit: options.key?.dailyCostLimit ?? 10,
    usedTokensToday: options.key?.usedTokensToday ?? 0,
    usedCostToday: options.key?.usedCostToday ?? 0,
    expiresAt: options.key?.expiresAt ?? null
  };
  const models = modelAliases.map(createModelRecord);

  return createGatewayService({
    repository: {
      async verifyApiKey(plaintext) {
        return plaintext === VALID_TEST_TOKEN ? key : null;
      },
      async getUsageForToday() {
        return {
          usedTokensToday: key.usedTokensToday,
          usedCostToday: key.usedCostToday
        };
      },
      async writeRequestLog() {},
      async recordUsage() {}
    },
    modelRegistry: {
      resolve(alias) {
        return models.find(model => model.alias === alias);
      },
      list() {
        return models;
      }
    },
    providers: {
      mock: createMockProviderAdapter({ content: options.providerContent })
    }
  });
}

function createModelRecord(alias: string): GatewayModelRecord {
  return {
    alias,
    provider: 'mock',
    providerModel: `mock-${alias}`,
    enabled: true,
    contextWindow: 4096,
    inputPricePer1mTokens: 0,
    outputPricePer1mTokens: 0,
    fallbackAliases: [],
    adminOnly: false
  };
}
