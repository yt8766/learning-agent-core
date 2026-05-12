import {
  GatewayRuntimeInvocationSchema,
  type GatewayRuntimeInvocation,
  type GatewayRuntimeProviderKind
} from '@agent/core';

export type ProviderPinnedRuntimeInvocation = GatewayRuntimeInvocation;

const providerPinnedRuntimeContexts = new WeakMap<
  GatewayRuntimeInvocation,
  { providerKind: GatewayRuntimeProviderKind }
>();

export interface RuntimeProtocolClient {
  clientId: string;
  apiKeyId: string;
  scopes: string[];
}

export function createBaseInvocation(input: {
  requestId: string;
  protocol: GatewayRuntimeInvocation['protocol'];
  providerKind: GatewayRuntimeProviderKind;
  model: string;
  stream: boolean;
  client: RuntimeProtocolClient;
  messages: GatewayRuntimeInvocation['messages'];
}): ProviderPinnedRuntimeInvocation {
  const invocation = GatewayRuntimeInvocationSchema.parse({
    id: input.requestId,
    protocol: input.protocol,
    model: input.model,
    stream: input.stream,
    messages: input.messages,
    requestedAt: new Date().toISOString(),
    client: input.client,
    metadata: {}
  });
  providerPinnedRuntimeContexts.set(invocation, { providerKind: input.providerKind });
  return invocation;
}

export function getProviderPinnedRuntimeContext(
  invocation: GatewayRuntimeInvocation
): { providerKind: GatewayRuntimeProviderKind } | undefined {
  return providerPinnedRuntimeContexts.get(invocation);
}

export function textMessage(
  role: GatewayRuntimeInvocation['messages'][number]['role'],
  text: string
): GatewayRuntimeInvocation['messages'][number] {
  return {
    role,
    content: [{ type: 'text', text }]
  };
}

export function normalizeRuntimeRole(role: unknown): GatewayRuntimeInvocation['messages'][number]['role'] {
  if (role === 'system' || role === 'assistant' || role === 'tool') return role;
  return 'user';
}

export function stringField(record: Record<string, unknown>, field: string, fallback = ''): string {
  const value = record[field];
  return typeof value === 'string' && value ? value : fallback;
}

export function booleanField(record: Record<string, unknown>, field: string): boolean {
  return record[field] === true;
}

export function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
