import { GatewayError } from './errors';
import { createGatewayService, type GatewayRepository, type GatewayService } from './gateway-service';
import { createMockProviderAdapter } from '../providers/mock-provider-adapter';
import { createMemoryRateLimiter } from '../rate-limit/memory-rate-limiter';
import { createPostgresGatewayRepository } from '../repositories/postgres-gateway';

let gatewayService: GatewayService | null = null;

export async function setGatewayServiceForRoutes(service: GatewayService | null): Promise<void> {
  const previousService = gatewayService;
  gatewayService = service;

  if (previousService && previousService !== service) {
    await previousService.dispose?.();
  }
}

export function getGatewayServiceForRoutes(): GatewayService {
  if (!gatewayService) {
    gatewayService =
      process.env.LLM_GATEWAY_RUNTIME === 'postgres' ? createPostgresGatewayService() : createBootstrapGatewayService();
  }

  return gatewayService;
}

function createPostgresGatewayService(): GatewayService {
  const databaseUrl = process.env.DATABASE_URL;
  const apiKeySecret = process.env.LLM_GATEWAY_API_KEY_SECRET;

  if (!databaseUrl || !apiKeySecret) {
    throw new GatewayError(
      'UPSTREAM_UNAVAILABLE',
      'Gateway postgres runtime is not configured. Set DATABASE_URL and LLM_GATEWAY_API_KEY_SECRET.',
      503
    );
  }

  const repository = createPostgresGatewayRepository(databaseUrl, { apiKeySecret });
  const providerMode = process.env.LLM_GATEWAY_PROVIDER_MODE ?? 'mock';

  if (providerMode !== 'mock') {
    throw new GatewayError(
      'UPSTREAM_UNAVAILABLE',
      'Only mock provider mode is enabled for the current postgres runtime.',
      503
    );
  }

  return createGatewayService({
    repository,
    modelRegistry: {
      async resolve(alias) {
        return repository.findModelByAlias(alias);
      },
      async list() {
        return repository.listModels();
      }
    },
    providers: {
      mock: createMockProviderAdapter({ content: 'llm-gateway e2e response' })
    },
    rpmLimiter: createMemoryRateLimiter(),
    tpmLimiter: createMemoryRateLimiter()
  });
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
