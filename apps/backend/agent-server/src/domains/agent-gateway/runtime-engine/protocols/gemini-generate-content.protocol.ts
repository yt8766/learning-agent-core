import {
  booleanField,
  createBaseInvocation,
  normalizeRuntimeRole,
  objectRecord,
  stringField,
  textMessage,
  type ProviderPinnedRuntimeInvocation,
  type RuntimeProtocolClient
} from './provider-pinned-runtime-invocation';

interface NormalizeGeminiGenerateContentRequestInput {
  requestId: string;
  client: RuntimeProtocolClient;
  body: unknown;
  model?: string;
}

export function normalizeGeminiGenerateContentRequest(
  input: NormalizeGeminiGenerateContentRequestInput
): ProviderPinnedRuntimeInvocation {
  const body = objectRecord(input.body);
  return createBaseInvocation({
    requestId: input.requestId,
    protocol: 'gemini.generateContent',
    providerKind: 'gemini',
    model: input.model ?? stringField(body, 'model', 'gemini-2.5-pro'),
    stream: booleanField(body, 'stream'),
    client: input.client,
    messages: normalizeContents(body.contents)
  });
}

function normalizeContents(contents: unknown): ProviderPinnedRuntimeInvocation['messages'] {
  if (typeof contents === 'string') return [textMessage('user', contents)];
  if (!Array.isArray(contents)) return [];

  return contents.map(content => {
    const record = objectRecord(content);
    const parts = Array.isArray(record.parts) ? record.parts : [];
    return {
      role: normalizeRuntimeRole(record.role),
      content: parts.map(part => ({ type: 'text' as const, text: normalizePart(part) }))
    };
  });
}

function normalizePart(part: unknown): string {
  if (typeof part === 'string') return part;
  const record = objectRecord(part);
  return stringField(record, 'text');
}
