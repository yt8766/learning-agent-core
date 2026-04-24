import { GatewayError } from './errors';
import { createGatewayService, type GatewayRepository, type GatewayService } from './gateway-service';
import { createMockProviderAdapter } from '../providers/mock-provider-adapter';
import { createMemoryRateLimiter } from '../rate-limit/memory-rate-limiter';

let gatewayService: GatewayService | null = null;

export function setGatewayServiceForRoutes(service: GatewayService | null): void {
  gatewayService = service;
}

export function getGatewayServiceForRoutes(): GatewayService {
  if (!gatewayService) {
    gatewayService = createBootstrapGatewayService();
  }

  return gatewayService;
}

function createBootstrapGatewayService(): GatewayService {
  const bootstrapKey = process.env.LLM_GATEWAY_BOOTSTRAP_API_KEY;

  if (!bootstrapKey) {
    throw new GatewayError(
      'UPSTREAM_UNAVAILABLE',
      'Gateway dependencies are not configured. Set LLM_GATEWAY_BOOTSTRAP_API_KEY for the private bootstrap runtime.',
      503
    );
  }

  const repository: GatewayRepository = {
    async verifyApiKey(plaintext) {
      if (plaintext !== bootstrapKey) {
        return null;
      }

      return {
        id: 'key_bootstrap',
        name: 'Bootstrap key',
        status: 'active',
        models: ['gpt-main'],
        rpmLimit: 60,
        tpmLimit: 100000,
        dailyTokenLimit: 500000,
        dailyCostLimit: 10,
        usedTokensToday: 0,
        usedCostToday: 0,
        expiresAt: null
      };
    },
    async getUsageForToday() {
      return {
        usedTokensToday: 0,
        usedCostToday: 0
      };
    }
  };

  const model = {
    alias: 'gpt-main',
    provider: 'mock',
    providerModel: 'mock-gpt-main',
    enabled: true,
    contextWindow: 128000,
    inputPricePer1mTokens: 0,
    outputPricePer1mTokens: 0,
    fallbackAliases: [],
    adminOnly: false
  };

  return createGatewayService({
    repository,
    modelRegistry: {
      resolve(alias) {
        return alias === model.alias ? model : undefined;
      },
      list() {
        return [model];
      }
    },
    providers: {
      mock: createMockProviderAdapter({ content: 'llm-gateway bootstrap response' })
    },
    rpmLimiter: createMemoryRateLimiter(),
    tpmLimiter: createMemoryRateLimiter()
  });
}
