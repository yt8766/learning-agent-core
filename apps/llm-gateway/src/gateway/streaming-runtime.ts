import { isFallbackEligible } from './fallback-policy';
import type { GatewayChatStreamChunk, GatewayUsage } from '../providers/provider-adapter';

export interface GatewayStreamAttempt<TContext = unknown> {
  attemptIndex: number;
  context: TContext;
  createStream(): AsyncIterable<GatewayChatStreamChunk>;
}

export interface GatewayStreamUsageSummary {
  streamedContent: string;
  providerFinalUsage?: GatewayUsage;
  streamAccumulatedUsage?: GatewayUsage;
}

export async function* streamWithFallbackAttempts<TContext>(
  attempts: Array<GatewayStreamAttempt<TContext>>,
  callbacks: {
    onComplete(attempt: GatewayStreamAttempt<TContext>, usage: GatewayStreamUsageSummary): Promise<void>;
    onPostChunkError(
      attempt: GatewayStreamAttempt<TContext>,
      usage: GatewayStreamUsageSummary,
      error: unknown
    ): Promise<void>;
  }
): AsyncIterable<GatewayChatStreamChunk> {
  let lastError: unknown;

  for (const [index, attempt] of attempts.entries()) {
    const usage = createEmptyUsageSummary();
    let hasEmittedChunk = false;

    try {
      for await (const chunk of attempt.createStream()) {
        hasEmittedChunk = true;
        accumulateStreamChunkUsage(usage, chunk);
        yield chunk;
      }

      await callbacks.onComplete(attempt, usage);
      return;
    } catch (error) {
      lastError = error;

      if (hasEmittedChunk) {
        await callbacks.onPostChunkError(attempt, usage, error);
        throw error;
      }

      if (!isFallbackEligible(error) || index === attempts.length - 1) {
        throw error;
      }
    }
  }

  throw lastError;
}

function createEmptyUsageSummary(): GatewayStreamUsageSummary {
  return {
    streamedContent: ''
  };
}

function accumulateStreamChunkUsage(summary: GatewayStreamUsageSummary, chunk: GatewayChatStreamChunk): void {
  summary.streamedContent += chunk.choices.map(choice => choice.delta.content ?? '').join('');

  if (!chunk.usage) {
    return;
  }

  if (isProviderFinalUsageChunk(chunk)) {
    summary.providerFinalUsage = chunk.usage;
    return;
  }

  summary.streamAccumulatedUsage = chunk.usage;
}

function isProviderFinalUsageChunk(chunk: GatewayChatStreamChunk): boolean {
  return (
    chunk.choices.length === 0 ||
    chunk.choices.every(choice => choice.finish_reason !== null && choice.delta.content === undefined)
  );
}
