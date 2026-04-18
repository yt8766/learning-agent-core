import { z, ZodType } from 'zod/v4';

import type {
  ILLMProvider,
  LlmProviderAgentRole,
  LlmProviderCapability,
  LlmProviderMessage,
  LlmProviderModelInfo,
  LlmProviderOptions
} from '@agent/core';

export type ChatRole = LlmProviderMessage['role'];
export type AgentModelRole = LlmProviderAgentRole;
export type ModelCapability = LlmProviderCapability;
export type ChatMessage = LlmProviderMessage;
export type ModelInfo = LlmProviderModelInfo;
export type GenerateTextOptions = LlmProviderOptions;

export const MODEL_CAPABILITIES = {
  TEXT: 'text',
  TOOL_CALL: 'tool-call',
  EMBEDDING: 'embedding',
  THINKING: 'thinking'
} as const satisfies Record<string, ModelCapability>;

export function createModelCapabilities(...capabilities: ModelCapability[]): ModelCapability[] {
  return [...new Set(capabilities)];
}

export function modelSupportsCapabilities(
  model: Pick<ModelInfo, 'capabilities'>,
  requiredCapabilities?: ModelCapability[]
): boolean {
  return (requiredCapabilities ?? []).every(capability => model.capabilities.includes(capability));
}

export interface LlmUsageMetadata {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model?: string;
  estimated?: boolean;
  costUsd?: number;
  costCny?: number;
}

export interface LlmProvider extends ILLMProvider {
  generateObject<T>(messages: ChatMessage[], schema: ZodType<T>, options: GenerateTextOptions): Promise<T>;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    return JSON.parse(trimmed);
  }

  const firstObjectIndex = trimmed.indexOf('{');
  const firstArrayIndex = trimmed.indexOf('[');
  const firstJsonIndex =
    firstObjectIndex === -1
      ? firstArrayIndex
      : firstArrayIndex === -1
        ? firstObjectIndex
        : Math.min(firstObjectIndex, firstArrayIndex);

  if (firstJsonIndex >= 0) {
    const openingToken = trimmed[firstJsonIndex];
    const closingToken = openingToken === '[' ? ']' : '}';
    const lastJsonIndex = trimmed.lastIndexOf(closingToken);
    if (lastJsonIndex > firstJsonIndex) {
      return JSON.parse(trimmed.slice(firstJsonIndex, lastJsonIndex + 1));
    }
  }

  throw new Error('No JSON object found in model response.');
}

export function jsonObjectInstruction(schema: ZodType<unknown>): string {
  const jsonSchema = z.toJSONSchema(schema);
  const rootType = jsonSchema.type === 'array' ? 'JSON array' : 'JSON object';

  return [
    `Return only a single ${rootType} and do not include markdown code fences.`,
    'Do not add explanations, prefixes, suffixes, or extra prose.',
    'The JSON must satisfy this schema summary:',
    JSON.stringify(jsonSchema)
  ].join('\n');
}
