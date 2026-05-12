import type { GatewayRuntimeInvocation, GatewayRuntimeProviderKind, GatewayRuntimeStreamEvent } from '@agent/core';

import type {
  GatewayRuntimeDiscoveredModel,
  GatewayRuntimeExecutor,
  RuntimeEngineExecutionContext,
  RuntimeEngineInvokeResult
} from '../types/runtime-engine.types';

interface DeterministicOpenAICompatibleExecutorOptions {
  modelIds?: string[];
  providerKind?: GatewayRuntimeProviderKind;
  responseText?: string;
  now?: () => string;
}

const DEFAULT_MODEL_IDS = ['gpt-5.4'];
const DEFAULT_CREATED = 1_778_367_600;

export class DeterministicOpenAICompatibleExecutor implements GatewayRuntimeExecutor {
  readonly providerKind: GatewayRuntimeProviderKind;
  private readonly modelIds: string[];
  private readonly responseText: string;
  private readonly now: () => string;
  private activeRequests = 0;

  constructor(options: DeterministicOpenAICompatibleExecutorOptions = {}) {
    this.providerKind = options.providerKind ?? 'codex';
    this.modelIds = options.modelIds ?? DEFAULT_MODEL_IDS;
    this.responseText = options.responseText ?? 'deterministic executor response';
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async health() {
    return {
      providerKind: this.providerKind,
      status: 'ready' as const,
      checkedAt: this.now(),
      activeRequests: this.activeRequests,
      supportsStreaming: true
    };
  }

  async discoverModels(): Promise<GatewayRuntimeDiscoveredModel[]> {
    return this.modelIds.map(id => ({
      id,
      ownedBy: this.providerKind,
      created: DEFAULT_CREATED
    }));
  }

  canHandle(invocation: GatewayRuntimeInvocation, context: RuntimeEngineExecutionContext = {}): boolean {
    if (context.providerKind && context.providerKind !== this.providerKind) return false;
    return this.modelIds.includes(invocation.model);
  }

  async invoke(invocation: GatewayRuntimeInvocation): Promise<RuntimeEngineInvokeResult> {
    this.activeRequests += 1;
    try {
      const usage = estimateUsage(invocation, this.responseText);
      return {
        invocationId: invocation.id,
        model: invocation.model,
        text: this.responseText,
        route: {
          invocationId: invocation.id,
          providerKind: this.providerKind,
          credentialId: `${this.providerKind}-deterministic-credential`,
          authIndex: `${this.providerKind}-deterministic-auth-file`,
          model: invocation.model,
          strategy: 'fill-first',
          reason: 'deterministic OpenAI-compatible executor fixture',
          decidedAt: this.now()
        },
        usage
      };
    } finally {
      this.activeRequests -= 1;
    }
  }

  async *stream(
    invocation: GatewayRuntimeInvocation,
    context: RuntimeEngineExecutionContext = {}
  ): AsyncIterable<GatewayRuntimeStreamEvent> {
    const result = await this.invoke(invocation);
    if (context.signal?.aborted) return;
    yield {
      invocationId: invocation.id,
      type: 'delta',
      sequence: 0,
      createdAt: this.now(),
      delta: { text: result.text }
    };
    if (context.signal?.aborted) return;
    yield {
      invocationId: invocation.id,
      type: 'usage',
      sequence: 1,
      createdAt: this.now(),
      usage: result.usage
    };
    if (context.signal?.aborted) return;
    yield {
      invocationId: invocation.id,
      type: 'done',
      sequence: 2,
      createdAt: this.now()
    };
  }
}

function estimateUsage(invocation: GatewayRuntimeInvocation, responseText: string) {
  const inputCharacters = invocation.messages.reduce(
    (sum, message) =>
      sum +
      message.content.reduce((contentSum, part) => {
        if (part.type === 'text') return contentSum + part.text.length;
        return contentSum + part.imageUrl.length;
      }, 0),
    0
  );
  const inputTokens = Math.max(1, Math.ceil(inputCharacters / 4));
  const outputTokens = Math.max(1, Math.ceil(responseText.length / 4));
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens
  };
}
