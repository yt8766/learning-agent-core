import { z, ZodType } from 'zod/v4';

export type ChatRole = 'system' | 'user' | 'assistant';
export type AgentModelRole = 'manager' | 'research' | 'executor' | 'reviewer';
export type ModelCapability =
  | 'text'
  | 'vision'
  | 'audio'
  | 'image-gen'
  | 'video-gen'
  | 'tts'
  | 'asr'
  | 'realtime'
  | 'tool-call'
  | 'thinking';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  providerId: string;
  contextWindow: number;
  maxOutput: number;
  capabilities: ModelCapability[];
  pricing?: {
    inputPer1k: number;
    outputPer1k: number;
    currency: string;
  };
}

export interface GenerateTextOptions {
  role: AgentModelRole;
  modelId?: string;
  taskId?: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
  disableRetry?: boolean;
  budgetState?: {
    costConsumedUsd?: number;
    costBudgetUsd?: number;
    fallbackModelId?: string;
    overBudget?: boolean;
  };
  onUsage?: (usage: LlmUsageMetadata) => void;
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

export interface LlmProvider {
  readonly providerId: string;
  readonly displayName: string;
  supportedModels(): ModelInfo[];
  isConfigured(): boolean;
  generateText(messages: ChatMessage[], options: GenerateTextOptions): Promise<string>;
  streamText(
    messages: ChatMessage[],
    options: GenerateTextOptions,
    onToken: (token: string, metadata?: { model?: string }) => void
  ): Promise<string>;
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
