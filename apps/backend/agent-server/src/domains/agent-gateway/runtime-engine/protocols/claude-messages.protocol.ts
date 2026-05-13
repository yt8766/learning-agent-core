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

interface NormalizeClaudeMessagesRequestInput {
  requestId: string;
  client: RuntimeProtocolClient;
  body: unknown;
}

export function normalizeClaudeMessagesRequest(
  input: NormalizeClaudeMessagesRequestInput
): ProviderPinnedRuntimeInvocation {
  const body = objectRecord(input.body);
  const messages = normalizeMessages(body.messages);
  const system = stringField(body, 'system');
  return createBaseInvocation({
    requestId: input.requestId,
    protocol: 'claude.messages',
    providerKind: 'claude',
    model: stringField(body, 'model', 'claude-sonnet-4.5'),
    stream: booleanField(body, 'stream'),
    client: input.client,
    messages: system ? [textMessage('system', system), ...messages] : messages
  });
}

function normalizeMessages(messages: unknown): ProviderPinnedRuntimeInvocation['messages'] {
  if (!Array.isArray(messages)) return [];
  return messages.map(message => {
    const record = objectRecord(message);
    const content = record.content;
    if (typeof content === 'string') return textMessage(normalizeRuntimeRole(record.role), content);
    if (!Array.isArray(content)) return textMessage(normalizeRuntimeRole(record.role), '');
    return {
      role: normalizeRuntimeRole(record.role),
      content: content.map(part => ({ type: 'text' as const, text: normalizeTextPart(part) }))
    };
  });
}

function normalizeTextPart(part: unknown): string {
  if (typeof part === 'string') return part;
  const record = objectRecord(part);
  return stringField(record, 'text');
}
