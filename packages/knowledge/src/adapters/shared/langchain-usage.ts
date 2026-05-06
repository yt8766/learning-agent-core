import type { KnowledgeTokenUsage } from '../../core';

export function extractLangChainUsage(result: unknown): KnowledgeTokenUsage | undefined {
  if (!isRecord(result)) {
    return undefined;
  }

  const metadata = isRecord(result.response_metadata) ? result.response_metadata : {};
  const usage = firstRecord(
    metadata.tokenUsage,
    metadata.usage,
    metadata.usage_metadata,
    result.usage_metadata,
    result.usage
  );

  if (!usage) {
    return undefined;
  }

  const inputTokens = readNumber(usage.input_tokens, usage.promptTokens, usage.prompt_tokens);
  const outputTokens = readNumber(usage.output_tokens, usage.completionTokens, usage.completion_tokens);
  const totalTokens = readNumber(usage.total_tokens, usage.totalTokens);

  const projected: KnowledgeTokenUsage = {};
  if (inputTokens !== undefined) {
    projected.inputTokens = inputTokens;
  }
  if (outputTokens !== undefined) {
    projected.outputTokens = outputTokens;
  }
  if (totalTokens !== undefined) {
    projected.totalTokens = totalTokens;
  }

  return Object.keys(projected).length > 0 ? projected : undefined;
}

function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

function readNumber(...values: unknown[]): number | undefined {
  const value = values.find(item => typeof item === 'number' && Number.isFinite(item));
  return typeof value === 'number' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
