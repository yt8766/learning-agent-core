import { GatewayError } from './errors';
import {
  createGatewayService,
  type GatewayModelRecord,
  type GatewayRepository,
  type GatewayService
} from './gateway-service';
import { createOpenAiProviderAdapter } from '../providers/openai-provider-adapter';
import { createMockProviderAdapter } from '../providers/mock-provider-adapter';
import { createMiniMaxProviderAdapter } from '../providers/minimax-provider-adapter';
import { createMiMoProviderAdapter } from '../providers/mimo-provider-adapter';
import type { ProviderAdapter } from '../providers/provider-adapter';
import { createProviderAdapterRegistry } from '../providers/provider-adapter-registry';
import { createMemoryRateLimiter } from '../rate-limit/memory-rate-limiter';
import type { RateLimiter } from '../rate-limit/rate-limiter';
import { createUpstashRateLimiter, type UpstashFetch } from '../rate-limit/upstash-rate-limiter';
import {
  createPostgresGatewayRepository,
  type PostgresGatewayRepository,
  type PostgresGatewayRepositoryOptions
} from '../repositories/postgres-gateway-repository';
import { ProviderSecretVault } from '../secrets/provider-secret-vault';

let gatewayService: GatewayService | null = null;

export interface RuntimeRateLimiters {
  rpmLimiter: RateLimiter;
  tpmLimiter: RateLimiter;
}

interface RuntimeLimiterFactoryOptions {
  fetch?: UpstashFetch;
}

interface RuntimeGatewayFactoryOptions {
  createPostgresRepository?: (
    connectionString: string,
    keyHashSecret: string,
    options: PostgresGatewayRepositoryOptions
  ) => PostgresGatewayRepository;
  createBootstrapGatewayService?: () => GatewayService;
  fetch?: UpstashFetch;
}

export async function setGatewayServiceForRoutes(service: GatewayService | null): Promise<void> {
  const previousService = gatewayService;
  gatewayService = service;

  if (previousService && previousService !== service) {
    await previousService.dispose?.();
  }
}

export function getGatewayServiceForRoutes(): GatewayService {
  if (!gatewayService) {
    gatewayService = createGatewayServiceForRuntime();
  }

  return gatewayService;
}

export function createGatewayServiceForRuntime(
  env: Record<string, string | undefined> = process.env,
  nodeEnv = process.env.NODE_ENV,
  options: RuntimeGatewayFactoryOptions = {}
): GatewayService {
  if (env.DATABASE_URL) {
    try {
      const keyHashSecret = env.LLM_GATEWAY_KEY_HASH_SECRET;

      if (!keyHashSecret) {
        throw new GatewayError(
          'UPSTREAM_UNAVAILABLE',
          'Postgres gateway runtime requires LLM_GATEWAY_KEY_HASH_SECRET.',
          503
        );
      }

      const repositoryOptions = createPostgresRepositoryOptions(env, keyHashSecret);
      const repository = options.createPostgresRepository
        ? options.createPostgresRepository(env.DATABASE_URL, keyHashSecret, repositoryOptions)
        : createPostgresGatewayRepository(env.DATABASE_URL, repositoryOptions);

      return createPostgresBackedGatewayService(repository, env, nodeEnv, options);
    } catch (error) {
      if (isProviderCredentialRuntimeError(error)) {
        throw error;
      }
      if (nodeEnv === 'production') {
        throw error;
      }
    }
  }

  return (options.createBootstrapGatewayService ?? (() => createBootstrapGatewayService(env, nodeEnv, options)))();
}

function createPostgresRepositoryOptions(
  env: Record<string, string | undefined>,
  keyHashSecret: string
): PostgresGatewayRepositoryOptions {
  const providerSecretKey = env.LLM_GATEWAY_PROVIDER_SECRET_KEY;

  if (!providerSecretKey) {
    throw new GatewayError(
      'UPSTREAM_UNAVAILABLE',
      'Postgres gateway runtime requires LLM_GATEWAY_PROVIDER_SECRET_KEY to decrypt provider credentials.',
      503
    );
  }

  try {
    return {
      keyHashSecret,
      providerSecretVault: new ProviderSecretVault({
        key: providerSecretKey,
        keyVersion: env.LLM_GATEWAY_PROVIDER_SECRET_KEY_VERSION ?? 'env-v1'
      })
    };
  } catch {
    throw new GatewayError(
      'UPSTREAM_UNAVAILABLE',
      'Postgres gateway runtime provider secret vault configuration is invalid.',
      503
    );
  }
}

function isProviderCredentialRuntimeError(error: unknown): boolean {
  if (!(error instanceof GatewayError)) {
    return false;
  }

  return error.message.includes('provider credential') || error.message.includes('LLM_GATEWAY_PROVIDER_SECRET_KEY');
}

export function createRateLimitersForRuntime(
  env: Record<string, string | undefined> = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  options: RuntimeLimiterFactoryOptions = {}
): RuntimeRateLimiters {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    const limiter = createUpstashRateLimiter({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
      fetch: options.fetch
    });

    return {
      rpmLimiter: limiter,
      tpmLimiter: limiter
    };
  }

  if (nodeEnv === 'production') {
    throw new GatewayError(
      'RATE_LIMITER_UNAVAILABLE',
      'Redis rate limiter is required in production. Configure Upstash Redis for llm-gateway.',
      503
    );
  }

  return {
    rpmLimiter: createMemoryRateLimiter(),
    tpmLimiter: createMemoryRateLimiter()
  };
}

function createPostgresBackedGatewayService(
  repository: PostgresGatewayRepository,
  env: Record<string, string | undefined>,
  nodeEnv: string | undefined,
  options: RuntimeGatewayFactoryOptions
): GatewayService {
  async function createDelegate(): Promise<GatewayService> {
    const [models, providers] = await Promise.all([repository.list(), createProvidersForPostgresRuntime(repository)]);
    const { rpmLimiter, tpmLimiter } = createRateLimitersForRuntime(env, nodeEnv, options);

    return createGatewayService({
      repository,
      modelRegistry: createModelRegistrySnapshot(models),
      providers,
      rpmLimiter,
      tpmLimiter
    });
  }

  return {
    async dispose() {
      await repository.dispose?.();
    },
    async complete(input) {
      return (await createDelegate()).complete(input);
    },
    async stream(input) {
      return (await createDelegate()).stream(input);
    },
    async listModels(input) {
      return (await createDelegate()).listModels(input);
    },
    async getKey(input) {
      return (await createDelegate()).getKey(input);
    }
  };
}

async function createProvidersForPostgresRuntime(
  repository: PostgresGatewayRepository
): Promise<Record<string, ProviderAdapter>> {
  const configs = await repository.listProviderRuntimeConfigs();
  const registry = createProviderAdapterRegistry({
    openai: createOpenAiProviderAdapter,
    'openai-compatible': createOpenAiProviderAdapter,
    minimax: createMiniMaxProviderAdapter,
    mimo: createMiMoProviderAdapter,
    mock: () => createMockProviderAdapter({ content: 'llm-gateway postgres mock response' })
  });
  const providers: Record<string, ProviderAdapter> = {
    mock: createMockProviderAdapter({ content: 'llm-gateway postgres mock response' })
  };

  for (const config of configs) {
    providers[config.providerId] = registry.create(config.providerKind, config);
  }

  return providers;
}

function createModelRegistrySnapshot(models: GatewayModelRecord[]) {
  return {
    resolve(alias: string) {
      return models.find(model => model.alias === alias);
    },
    list() {
      return models;
    }
  };
}

function createBootstrapGatewayService(
  env: Record<string, string | undefined> = process.env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
  options: RuntimeLimiterFactoryOptions = {}
): GatewayService {
  const bootstrapKey = env.LLM_GATEWAY_BOOTSTRAP_API_KEY;

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

  const { rpmLimiter, tpmLimiter } = createRateLimitersForRuntime(env, nodeEnv, options);

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
    rpmLimiter,
    tpmLimiter
  });
}
