import { GatewayError } from './errors';
import { ChatCompletionRequestSchema } from '../contracts';
import type { RateLimiter } from '../rate-limit/rate-limiter';
import type {
  GatewayChatMessage,
  GatewayChatResponse,
  GatewayChatStreamChunk,
  ProviderAdapter
} from '../providers/provider-adapter';
import {
  estimateCompletionCost,
  estimateRequestTokens,
  estimateUsageCost,
  isDailyBudgetAvailable
} from '../usage/usage-meter';

type KeyStatus = 'active' | 'disabled' | 'revoked';

export interface GatewayKeyRecord {
  id: string;
  name?: string;
  status: KeyStatus;
  models: string[];
  rpmLimit?: number | null;
  tpmLimit?: number | null;
  dailyTokenLimit?: number | null;
  dailyCostLimit?: number | null;
  usedTokensToday?: number;
  usedCostToday?: number;
  expiresAt?: string | Date | null;
}

export interface GatewayModelRecord {
  alias: string;
  provider: string;
  providerModel: string;
  enabled: boolean;
  contextWindow?: number;
  inputPricePer1mTokens?: number | null;
  outputPricePer1mTokens?: number | null;
  fallbackAliases?: string[];
  adminOnly?: boolean;
}

export interface GatewayRepository {
  verifyApiKey(plaintext: string): Promise<GatewayKeyRecord | null>;
  getUsageForToday?(keyId: string): Promise<{ usedTokensToday?: number; usedCostToday?: number }>;
  writeRequestLog?(log: unknown): Promise<void>;
  recordUsage?(usage: unknown): Promise<void>;
}

export interface GatewayModelRegistry {
  resolve(alias: string): GatewayModelRecord | undefined;
  list(): GatewayModelRecord[];
}

export interface GatewayChatBody {
  model: string;
  messages: GatewayChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface GatewayService {
  complete(input: { authorization?: string | null; body: GatewayChatBody }): Promise<GatewayChatResponse>;
  stream(input: {
    authorization?: string | null;
    body: GatewayChatBody;
  }): Promise<AsyncIterable<GatewayChatStreamChunk>>;
  listModels(input: { authorization?: string | null }): Promise<{
    object: 'list';
    data: Array<{ id: string; object: 'model'; owned_by: 'llm-gateway' }>;
  }>;
  getKey(input: { authorization?: string | null }): Promise<Record<string, unknown>>;
}

export interface GatewayServiceOptions {
  repository: GatewayRepository;
  modelRegistry: GatewayModelRegistry;
  providers: Record<string, ProviderAdapter>;
  rpmLimiter?: RateLimiter;
  tpmLimiter?: RateLimiter;
}

interface PreparedRequest {
  key: GatewayKeyRecord;
  model: GatewayModelRecord;
  estimatedPromptTokens: number;
}

function parseBearerToken(authorization?: string | null): string {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    throw new GatewayError('AUTH_ERROR', 'Missing bearer token', 401);
  }

  return match[1];
}

function isModelAllowed(models: string[], alias: string): boolean {
  return models.includes('*') || models.includes(alias);
}

function isExpired(expiresAt?: string | Date | null): boolean {
  return expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
}

function normalizeBody(body: GatewayChatBody): GatewayChatBody {
  const parsed = ChatCompletionRequestSchema.safeParse(body);

  if (!parsed.success) {
    throw new GatewayError('UPSTREAM_BAD_RESPONSE', 'Chat completion request does not match the gateway contract', 400);
  }

  return {
    model: parsed.data.model,
    messages: parsed.data.messages.map(message => ({
      role: message.role,
      content: message.content ?? ''
    })),
    stream: parsed.data.stream,
    temperature: parsed.data.temperature,
    max_tokens: parsed.data.max_tokens
  };
}

export function createGatewayService(options: GatewayServiceOptions): GatewayService {
  async function authenticate(authorization?: string | null): Promise<GatewayKeyRecord> {
    const token = parseBearerToken(authorization);
    const key = await options.repository.verifyApiKey(token);

    if (!key) {
      throw new GatewayError('AUTH_ERROR', 'Invalid API key', 401);
    }

    if (key.status !== 'active') {
      throw new GatewayError('KEY_DISABLED', 'API key is not active', 403);
    }

    if (isExpired(key.expiresAt)) {
      throw new GatewayError('KEY_EXPIRED', 'API key has expired', 403);
    }

    return key;
  }

  async function prepare(authorization: string | null | undefined, body: GatewayChatBody): Promise<PreparedRequest> {
    const parsedBody = normalizeBody(body);
    const key = await authenticate(authorization);
    const model = options.modelRegistry.resolve(parsedBody.model);

    if (!model || !model.enabled) {
      throw new GatewayError('MODEL_NOT_FOUND', 'Model alias is not available', 404);
    }

    if (!isModelAllowed(key.models, model.alias)) {
      throw new GatewayError('MODEL_NOT_ALLOWED', 'API key cannot use this model', 403);
    }

    const usage = await options.repository.getUsageForToday?.(key.id);
    const usedTokensToday = usage?.usedTokensToday ?? key.usedTokensToday ?? 0;
    const usedCostToday = usage?.usedCostToday ?? key.usedCostToday ?? 0;
    const estimatedPromptTokens = estimateRequestTokens(parsedBody.messages);

    if (
      !isDailyBudgetAvailable({ used: usedTokensToday, limit: key.dailyTokenLimit, estimated: estimatedPromptTokens })
    ) {
      throw new GatewayError('BUDGET_EXCEEDED', 'Daily token budget exceeded', 429);
    }

    const estimatedCost = estimateCompletionCost({
      promptTokens: estimatedPromptTokens,
      completionTokens: parsedBody.max_tokens ?? 0,
      inputPricePer1mTokens: model.inputPricePer1mTokens,
      outputPricePer1mTokens: model.outputPricePer1mTokens
    });

    if (!isDailyBudgetAvailable({ used: usedCostToday, limit: key.dailyCostLimit, estimated: estimatedCost })) {
      throw new GatewayError('BUDGET_EXCEEDED', 'Daily cost budget exceeded', 429);
    }

    const rpm = await options.rpmLimiter?.consume({ key: `rpm:${key.id}`, limit: key.rpmLimit, windowMs: 60_000 });
    if (rpm && !rpm.allowed) {
      throw new GatewayError('RATE_LIMITED', 'RPM limit exceeded', 429);
    }

    const tpm = await options.tpmLimiter?.consume({
      key: `tpm:${key.id}`,
      limit: key.tpmLimit,
      windowMs: 60_000,
      cost: estimatedPromptTokens
    });
    if (tpm && !tpm.allowed) {
      throw new GatewayError('RATE_LIMITED', 'TPM limit exceeded', 429);
    }

    return { key, model, estimatedPromptTokens };
  }

  async function writeSuccessLog(
    key: GatewayKeyRecord,
    model: GatewayModelRecord,
    response: GatewayChatResponse,
    startedAt: number
  ) {
    const estimatedCost = estimateUsageCost(response.usage, model);

    await options.repository.recordUsage?.({
      keyId: key.id,
      model: model.alias,
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
      estimatedCost
    });

    await options.repository.writeRequestLog?.({
      keyId: key.id,
      model: model.alias,
      provider: model.provider,
      status: 'success',
      totalTokens: response.usage.total_tokens,
      estimatedCost,
      latencyMs: Date.now() - startedAt
    });
  }

  return {
    async complete(input) {
      const body = normalizeBody(input.body);
      const startedAt = Date.now();
      const prepared = await prepare(input.authorization, body);
      const provider = options.providers[prepared.model.provider];

      if (!provider) {
        throw new GatewayError('UPSTREAM_UNAVAILABLE', 'Provider adapter is unavailable', 503);
      }

      const response = await provider.complete({
        id: `${prepared.key.id}-${startedAt}`,
        model: prepared.model.alias,
        providerModel: prepared.model.providerModel,
        messages: body.messages,
        stream: false,
        temperature: body.temperature,
        maxTokens: body.max_tokens
      });

      await writeSuccessLog(prepared.key, prepared.model, response, startedAt);

      return response;
    },
    async stream(input) {
      const body = normalizeBody(input.body);
      const startedAt = Date.now();
      const prepared = await prepare(input.authorization, body);
      const provider = options.providers[prepared.model.provider];

      if (!provider) {
        throw new GatewayError('UPSTREAM_UNAVAILABLE', 'Provider adapter is unavailable', 503);
      }

      const stream = provider.stream({
        id: `${prepared.key.id}-${Date.now()}`,
        model: prepared.model.alias,
        providerModel: prepared.model.providerModel,
        messages: body.messages,
        stream: true,
        temperature: body.temperature,
        maxTokens: body.max_tokens
      });

      return trackStreamUsage(stream, async () => {
        await options.repository.writeRequestLog?.({
          keyId: prepared.key.id,
          model: prepared.model.alias,
          provider: prepared.model.provider,
          status: 'success',
          totalTokens: prepared.estimatedPromptTokens,
          estimatedCost: estimateCompletionCost({
            promptTokens: prepared.estimatedPromptTokens,
            completionTokens: 0,
            inputPricePer1mTokens: prepared.model.inputPricePer1mTokens,
            outputPricePer1mTokens: prepared.model.outputPricePer1mTokens
          }),
          latencyMs: Date.now() - startedAt,
          stream: true
        });
      });
    },
    async listModels(input) {
      const key = await authenticate(input.authorization);
      const models = options.modelRegistry
        .list()
        .filter(model => model.enabled && isModelAllowed(key.models, model.alias))
        .map(model => ({
          id: model.alias,
          object: 'model' as const,
          owned_by: 'llm-gateway' as const
        }));

      return { object: 'list', data: models };
    },
    async getKey(input) {
      const key = await authenticate(input.authorization);
      const usage = await options.repository.getUsageForToday?.(key.id);

      return {
        id: key.id,
        name: key.name,
        status: key.status,
        models: key.models,
        rpm_limit: key.rpmLimit,
        tpm_limit: key.tpmLimit,
        daily_token_limit: key.dailyTokenLimit,
        daily_cost_limit: key.dailyCostLimit,
        used_tokens_today: usage?.usedTokensToday ?? key.usedTokensToday ?? 0,
        used_cost_today: usage?.usedCostToday ?? key.usedCostToday ?? 0,
        expires_at: key.expiresAt ?? null
      };
    }
  };
}

async function* trackStreamUsage(
  stream: AsyncIterable<GatewayChatStreamChunk>,
  onComplete: () => Promise<void>
): AsyncIterable<GatewayChatStreamChunk> {
  for await (const chunk of stream) {
    yield chunk;
  }

  await onComplete();
}
