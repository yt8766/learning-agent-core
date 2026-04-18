import { createHash } from 'node:crypto';
import type { ZodType } from 'zod/v4';

import {
  ChatMessage,
  createModelCapabilities,
  GenerateTextOptions,
  LlmProvider,
  ModelInfo,
  MODEL_CAPABILITIES
} from '../base/llm-provider.types';
import { ModelRouter } from './model-router';
import { ProviderRegistry } from './provider-registry';
import { SemanticCacheRepository } from './semantic-cache';
import { withLlmRetry } from '../../../retry';

function buildSemanticCacheKey(messages: ChatMessage[], options: GenerateTextOptions, resolvedModelId: string): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        role: options.role,
        modelId: resolvedModelId,
        temperature: options.temperature ?? 0.2,
        thinking: options.thinking ?? false,
        messages
      })
    )
    .digest('hex');
}

function ensureBaselineTextCapability(options: GenerateTextOptions): GenerateTextOptions['requiredCapabilities'] {
  const current = options.requiredCapabilities ?? [];
  if (current.includes(MODEL_CAPABILITIES.TEXT)) {
    return current;
  }
  return createModelCapabilities(MODEL_CAPABILITIES.TEXT, ...current);
}

export class RoutedLlmProvider implements LlmProvider {
  readonly providerId = 'router';
  readonly displayName = 'Model Router';

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly router: ModelRouter,
    private readonly semanticCache?: SemanticCacheRepository
  ) {}

  supportedModels(): ModelInfo[] {
    return this.registry.getAll().flatMap(provider => provider.supportedModels());
  }

  isConfigured(): boolean {
    return this.registry.getConfiguredProviders().length > 0;
  }

  async generateText(messages: ChatMessage[], options: GenerateTextOptions): Promise<string> {
    const resolved = this.router.resolve({
      role: options.role,
      preferredModelId: options.modelId,
      requiredCapabilities: ensureBaselineTextCapability(options),
      fallbackModelId: options.budgetState?.fallbackModelId,
      overBudget:
        options.budgetState?.overBudget === true ||
        (options.budgetState?.costConsumedUsd ?? 0) >= (options.budgetState?.costBudgetUsd ?? Number.POSITIVE_INFINITY)
    });
    const cacheKey = this.semanticCache ? buildSemanticCacheKey(messages, options, resolved.modelId) : undefined;
    if (cacheKey && this.semanticCache) {
      const cached = await this.semanticCache.get(cacheKey);
      if (cached) {
        return cached.responseText;
      }
    }
    const responseText = await resolved.provider.generateText(messages, {
      ...options,
      modelId: resolved.modelId
    });
    if (cacheKey && this.semanticCache) {
      const now = new Date().toISOString();
      await this.semanticCache.set({
        id: `semantic_cache_${cacheKey.slice(0, 12)}`,
        key: cacheKey,
        role: options.role,
        modelId: resolved.modelId,
        responseText,
        promptFingerprint: cacheKey,
        createdAt: now,
        updatedAt: now,
        hitCount: 0
      });
    }
    return responseText;
  }

  async streamText(
    messages: ChatMessage[],
    options: GenerateTextOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string> {
    const resolved = this.router.resolve({
      role: options.role,
      preferredModelId: options.modelId,
      requiredCapabilities: ensureBaselineTextCapability(options),
      fallbackModelId: options.budgetState?.fallbackModelId,
      overBudget:
        options.budgetState?.overBudget === true ||
        (options.budgetState?.costConsumedUsd ?? 0) >= (options.budgetState?.costBudgetUsd ?? Number.POSITIVE_INFINITY)
    });
    const cacheKey = this.semanticCache ? buildSemanticCacheKey(messages, options, resolved.modelId) : undefined;
    if (cacheKey && this.semanticCache) {
      const cached = await this.semanticCache.get(cacheKey);
      if (cached) {
        onToken(cached.responseText, { model: resolved.modelId });
        return cached.responseText;
      }
    }
    const responseText = await resolved.provider.streamText(
      messages,
      {
        ...options,
        modelId: resolved.modelId
      },
      onToken
    );
    if (cacheKey && this.semanticCache) {
      const now = new Date().toISOString();
      await this.semanticCache.set({
        id: `semantic_cache_${cacheKey.slice(0, 12)}`,
        key: cacheKey,
        role: options.role,
        modelId: resolved.modelId,
        responseText,
        promptFingerprint: cacheKey,
        createdAt: now,
        updatedAt: now,
        hitCount: 0
      });
    }
    return responseText;
  }

  async generateObject<T>(messages: ChatMessage[], schema: ZodType<T>, options: GenerateTextOptions): Promise<T> {
    const resolved = this.router.resolve({
      role: options.role,
      preferredModelId: options.modelId,
      requiredCapabilities: ensureBaselineTextCapability(options),
      fallbackModelId: options.budgetState?.fallbackModelId,
      overBudget:
        options.budgetState?.overBudget === true ||
        (options.budgetState?.costConsumedUsd ?? 0) >= (options.budgetState?.costBudgetUsd ?? Number.POSITIVE_INFINITY)
    });
    const invoke = (retryMessages: ChatMessage[]) =>
      resolved.provider.generateObject(retryMessages, schema, {
        ...options,
        modelId: resolved.modelId
      });

    if (options.disableRetry) {
      return invoke(messages);
    }

    return withLlmRetry(invoke, messages);
  }
}
