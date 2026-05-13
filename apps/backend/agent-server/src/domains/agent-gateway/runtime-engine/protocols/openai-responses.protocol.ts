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

interface NormalizeOpenAIResponsesRequestInput {
  requestId: string;
  client: RuntimeProtocolClient;
  body: unknown;
}

export function normalizeOpenAIResponsesRequest(
  input: NormalizeOpenAIResponsesRequestInput
): ProviderPinnedRuntimeInvocation {
  const body = objectRecord(input.body);
  return createBaseInvocation({
    requestId: input.requestId,
    protocol: 'openai.responses',
    providerKind: 'openaiCompatible',
    model: stringField(body, 'model', 'gpt-5.4'),
    stream: booleanField(body, 'stream'),
    client: input.client,
    messages: normalizeInput(body.input)
  });
}

function normalizeInput(input: unknown): ProviderPinnedRuntimeInvocation['messages'] {
  if (typeof input === 'string') return [textMessage('user', input)];
  if (!Array.isArray(input)) return [];

  return input.map(item => {
    const record = objectRecord(item);
    const role = normalizeRuntimeRole(record.role);
    const content = record.content;
    if (typeof content === 'string') return textMessage(role, content);
    if (Array.isArray(content)) {
      return {
        role,
        content: content.map(part => ({ type: 'text' as const, text: normalizeTextPart(part) }))
      };
    }
    return textMessage(role, stringField(record, 'text'));
  });
}

function normalizeTextPart(part: unknown): string {
  if (typeof part === 'string') return part;
  const record = objectRecord(part);
  return stringField(record, 'text');
}
