import type { GatewayRuntimeStreamEvent } from '@agent/core';

export function projectProviderStreamChunk(
  invocationId: string,
  chunk: unknown,
  sequence: number,
  createdAt: string
): GatewayRuntimeStreamEvent | null {
  const normalizedChunk = normalizeOpenAIStreamDataChunk(chunk);
  if (normalizedChunk === '[DONE]') return { invocationId, type: 'done', sequence, createdAt };
  const record =
    typeof normalizedChunk === 'string' ? objectRecord(parseMaybeJson(normalizedChunk)) : objectRecord(normalizedChunk);
  const usage = normalizeUsage({ usage: record.usage });
  if (usage.totalTokens > 0) return { invocationId, type: 'usage', sequence, createdAt, usage };
  const choice = Array.isArray(record.choices) ? objectRecord(record.choices[0]) : {};
  const delta = objectRecord(choice.delta);
  const text = stringField(delta.content, stringField(objectRecord(record.delta).text, stringField(record.text)));
  return text ? { invocationId, type: 'delta', sequence, createdAt, delta: { text } } : null;
}

function normalizeOpenAIStreamDataChunk(chunk: unknown): unknown {
  if (typeof chunk !== 'string') return chunk;
  const lines = chunk
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const dataLines = lines.filter(line => line.startsWith('data:')).map(line => line.slice('data:'.length).trim());
  if (dataLines.length === 0) return chunk;
  if (dataLines.some(line => line === '[DONE]')) return '[DONE]';
  return dataLines.join('\n');
}

function parseMaybeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { text: value };
  }
}

function normalizeUsage(body: unknown) {
  const usage = objectRecord(objectRecord(body).usage);
  const inputTokens = numberField(usage.prompt_tokens, numberField(usage.input_tokens, 0));
  const outputTokens = numberField(usage.completion_tokens, numberField(usage.output_tokens, 0));
  return {
    inputTokens,
    outputTokens,
    totalTokens: numberField(usage.total_tokens, inputTokens + outputTokens)
  };
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringField(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberField(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
