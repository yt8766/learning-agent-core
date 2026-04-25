import type { GatewayModelRecord, GatewayRepository, GatewayKeyRecord } from './gateway-service';
import type { GatewayStreamAttempt, GatewayStreamUsageSummary } from './streaming-runtime';
import type { GatewayChatMessage } from '../providers/provider-adapter';
import { buildInvocationLog } from '../usage/invocation-log';
import { calculateUsageCost, estimateStreamUsage, resolveFinalUsage } from '../usage/usage-accounting';

export function createGatewayStreamAttemptCallbacks(input: {
  repository: GatewayRepository;
  key: GatewayKeyRecord;
  requestedModel: GatewayModelRecord;
  messages: GatewayChatMessage[];
  startedAt: number;
}): {
  onComplete(attempt: GatewayStreamAttempt<GatewayModelRecord>, usage: GatewayStreamUsageSummary): Promise<void>;
  onPostChunkError(
    attempt: GatewayStreamAttempt<GatewayModelRecord>,
    usage: GatewayStreamUsageSummary,
    error: unknown
  ): Promise<void>;
} {
  return {
    async onComplete(attempt, usageSummary) {
      const candidate = attempt.context;
      const resolvedUsage = resolveGatewayStreamUsage(input.messages, usageSummary);
      const estimatedCost = calculateUsageCost({
        usage: resolvedUsage.usage,
        inputPricePer1mTokens: candidate.inputPricePer1mTokens,
        outputPricePer1mTokens: candidate.outputPricePer1mTokens
      });

      await input.repository.recordUsage?.({
        keyId: input.key.id,
        model: candidate.alias,
        requestedModel: input.requestedModel.alias,
        promptTokens: resolvedUsage.usage.prompt_tokens,
        completionTokens: resolvedUsage.usage.completion_tokens,
        totalTokens: resolvedUsage.usage.total_tokens,
        estimatedCost,
        usageSource: resolvedUsage.source
      });

      await input.repository.writeRequestLog?.(
        buildInvocationLog({
          keyId: input.key.id,
          model: candidate.alias,
          requestedModel: input.requestedModel.alias,
          providerModel: candidate.providerModel,
          provider: candidate.provider,
          status: 'success',
          usage: resolvedUsage.usage,
          estimatedCost,
          usageSource: resolvedUsage.source,
          latencyMs: Date.now() - input.startedAt,
          stream: true,
          fallbackAttemptCount: attempt.attemptIndex
        })
      );
    },
    async onPostChunkError(attempt, usageSummary, error) {
      const candidate = attempt.context;
      const resolvedUsage = resolveGatewayStreamUsage(input.messages, usageSummary);
      const estimatedCost = calculateUsageCost({
        usage: resolvedUsage.usage,
        inputPricePer1mTokens: candidate.inputPricePer1mTokens,
        outputPricePer1mTokens: candidate.outputPricePer1mTokens
      });
      const errorMetadata = getErrorMetadata(error);

      await input.repository.writeRequestLog?.(
        buildInvocationLog({
          keyId: input.key.id,
          model: candidate.alias,
          requestedModel: input.requestedModel.alias,
          providerModel: candidate.providerModel,
          provider: candidate.provider,
          status: 'error',
          usage: resolvedUsage.usage,
          estimatedCost,
          usageSource: resolvedUsage.source,
          latencyMs: Date.now() - input.startedAt,
          stream: true,
          fallbackAttemptCount: attempt.attemptIndex,
          errorCode: errorMetadata.code,
          errorMessage: errorMetadata.message
        })
      );
    }
  };
}

function resolveGatewayStreamUsage(messages: GatewayChatMessage[], usageSummary: GatewayStreamUsageSummary) {
  return resolveFinalUsage({
    providerUsage: usageSummary.providerFinalUsage,
    streamAccumulatedUsage: usageSummary.streamAccumulatedUsage,
    gatewayEstimatedUsage: estimateStreamUsage({
      messages,
      streamedContent: usageSummary.streamedContent
    })
  });
}

function getErrorMetadata(error: unknown): { code?: string; message?: string } {
  const code = isRecord(error) && typeof error.code === 'string' ? error.code : undefined;
  const message = error instanceof Error ? redactSecretLikeText(error.message) : undefined;

  return { code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function redactSecretLikeText(value: string): string {
  if (/(sk-|secret|api[_-]?key|token)/i.test(value)) {
    return '[redacted]';
  }

  return value;
}
