import {
  ChatCompletionResponseSchema,
  ChatCompletionStreamChunkSchema,
  KeyStatusResponseSchema,
  ModelListResponseSchema
} from '../../src/contracts';

export const E2E_API_KEY_SECRET = 'llm-gateway-e2e-api-key-secret';
export const E2E_OWNER_PASSWORD = 'correct-e2e-owner-password';
export const E2E_ADMIN_JWT_SECRET = 'llm-gateway-e2e-admin-jwt-secret';

export const E2E_KEYS = {
  validFull: 'sk-llmgw_e2e_valid_full_000000000000',
  modelLimited: 'sk-llmgw_e2e_model_limited_000000',
  budgetLow: 'sk-llmgw_e2e_budget_low_0000000000',
  disabled: 'sk-llmgw_e2e_disabled_000000000000'
} as const;

export function gatewayBaseUrl(): string {
  return process.env.LLM_GATEWAY_E2E_BASE_URL ?? 'http://localhost:3100';
}

export function authHeaders(key: string): HeadersInit {
  return { authorization: `Bearer ${key}` };
}

export async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

export function parseModels(body: unknown) {
  return ModelListResponseSchema.parse(body);
}

export function parseKeyStatus(body: unknown) {
  return KeyStatusResponseSchema.parse(body);
}

export function parseChatCompletion(body: unknown) {
  return ChatCompletionResponseSchema.parse(body);
}

export function parseSseChunks(text: string): string[] {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('data: '));

  return lines.map(line => line.slice('data: '.length));
}

export function parseStreamChunk(payload: string) {
  return ChatCompletionStreamChunkSchema.parse(JSON.parse(payload));
}
