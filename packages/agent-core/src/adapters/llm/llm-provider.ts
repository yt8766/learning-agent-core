import { z, ZodType } from 'zod/v4';

export type ChatRole = 'system' | 'user' | 'assistant';
export type AgentModelRole = 'manager' | 'research' | 'executor' | 'reviewer';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateTextOptions {
  role: AgentModelRole;
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
}

export interface LlmProvider {
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
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error('No JSON object found in model response.');
}

export function jsonObjectInstruction(schema: ZodType<unknown>): string {
  const jsonSchema = z.toJSONSchema(schema);
  return [
    'Return only a single JSON object and do not include markdown code fences.',
    'The JSON must satisfy this schema summary:',
    JSON.stringify(jsonSchema)
  ].join('\n');
}
