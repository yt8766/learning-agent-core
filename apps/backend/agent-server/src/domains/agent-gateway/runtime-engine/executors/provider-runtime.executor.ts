import type { GatewayRuntimeInvocation, GatewayRuntimeProviderKind, GatewayRuntimeStreamEvent } from '@agent/core';

import { GatewayRuntimeExecutorError } from './gateway-runtime-executor.error';
import {
  FetchGatewayRuntimeExecutorHttpClient,
  type GatewayRuntimeExecutorHttpClient
} from './gateway-runtime-executor-http-client';
import { projectProviderStreamChunk } from './provider-runtime-stream-events';
import type {
  GatewayRuntimeDiscoveredModel,
  GatewayRuntimeExecutor,
  RuntimeEngineExecutionContext,
  RuntimeEngineInvokeResult
} from '../types/runtime-engine.types';

type RuntimeExecutorProviderKind = GatewayRuntimeProviderKind | 'kimi';

export interface RuntimeModelAlias {
  source: string;
  target: string;
}

export interface ProviderRuntimeExecutorOptions {
  providerKind: RuntimeExecutorProviderKind;
  baseUrl: string;
  apiKeySecretRef: string;
  credentialId?: string;
  authIndex?: string;
  modelAliases?: RuntimeModelAlias[];
  timeoutMs?: number;
  httpClient?: GatewayRuntimeExecutorHttpClient;
  resolveSecret?: (secretRef: string) => Promise<string>;
  now?: () => string;
}

export class ProviderRuntimeExecutor implements GatewayRuntimeExecutor {
  readonly providerKind: GatewayRuntimeProviderKind;
  protected readonly options: Required<Pick<ProviderRuntimeExecutorOptions, 'baseUrl' | 'apiKeySecretRef'>>;
  protected readonly credentialId: string;
  protected readonly authIndex?: string;
  protected readonly aliases: RuntimeModelAlias[];
  protected readonly timeoutMs?: number;
  protected readonly httpClient: GatewayRuntimeExecutorHttpClient;
  protected readonly resolveSecret: (secretRef: string) => Promise<string>;
  protected readonly now: () => string;
  protected activeRequests = 0;

  constructor(options: ProviderRuntimeExecutorOptions) {
    this.providerKind = options.providerKind as GatewayRuntimeProviderKind;
    this.options = {
      baseUrl: trimTrailingSlash(options.baseUrl),
      apiKeySecretRef: options.apiKeySecretRef
    };
    this.credentialId = options.credentialId ?? options.apiKeySecretRef;
    this.authIndex = options.authIndex;
    this.aliases = options.modelAliases ?? [];
    this.timeoutMs = options.timeoutMs;
    this.httpClient = options.httpClient ?? new FetchGatewayRuntimeExecutorHttpClient();
    this.resolveSecret = options.resolveSecret ?? defaultSecretResolver;
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
    const response = await this.requestJson('GET', 'models');
    this.throwIfProviderError(response);
    return applyModelAliases(parseModelList(response.body), this.aliases, this.providerKind);
  }

  canHandle(invocation: GatewayRuntimeInvocation, context: RuntimeEngineExecutionContext = {}): boolean {
    if (context.providerKind && context.providerKind !== this.providerKind) return false;
    const providerKind = (invocation as GatewayRuntimeInvocation & { providerKind?: RuntimeExecutorProviderKind })
      .providerKind;
    if (providerKind && providerKind !== this.providerKind) return false;
    if (this.aliases.some(alias => alias.source === invocation.model || alias.target === invocation.model)) return true;
    return invocation.model.length > 0;
  }

  async invoke(invocation: GatewayRuntimeInvocation): Promise<RuntimeEngineInvokeResult> {
    this.activeRequests += 1;
    try {
      const providerModel = this.mapModel(invocation.model);
      const response = await this.requestJson('POST', 'invoke', this.buildGenericBody(invocation, providerModel));
      this.throwIfProviderError(response);
      return this.projectInvokeResult(invocation, providerModel, response.body);
    } finally {
      this.activeRequests -= 1;
    }
  }

  async *stream(
    invocation: GatewayRuntimeInvocation,
    context: RuntimeEngineExecutionContext = {}
  ): AsyncIterable<GatewayRuntimeStreamEvent> {
    this.activeRequests += 1;
    try {
      const providerModel = this.mapModel(invocation.model);
      const response = await this.requestJson(
        'POST',
        'stream',
        this.buildGenericBody(invocation, providerModel, true),
        true,
        context.signal
      );
      this.throwIfProviderError(response);
      let sequence = 0;
      let sawDone = false;
      for await (const chunk of response.stream ?? asyncIterable([response.body])) {
        if (context.signal?.aborted) return;
        const event = projectProviderStreamChunk(invocation.id, chunk, sequence, this.now());
        if (!event) continue;
        sequence += 1;
        if (event.type === 'done') sawDone = true;
        yield event;
        if (sawDone) return;
      }
      if (!context.signal?.aborted && !sawDone) {
        yield { invocationId: invocation.id, type: 'done', sequence, createdAt: this.now() };
      }
    } finally {
      this.activeRequests -= 1;
    }
  }

  protected buildGenericBody(
    invocation: GatewayRuntimeInvocation,
    providerModel: string,
    stream = invocation.stream
  ): Record<string, unknown> {
    return {
      model: providerModel,
      messages: invocation.messages.map(message => ({
        role: message.role,
        content: message.content.map(part => (part.type === 'text' ? part.text : part.imageUrl)).join('')
      })),
      stream
    };
  }

  protected projectInvokeResult(
    invocation: GatewayRuntimeInvocation,
    providerModel: string,
    body: unknown
  ): RuntimeEngineInvokeResult {
    return {
      invocationId: invocation.id,
      model: invocation.model,
      text: extractText(body),
      route: {
        invocationId: invocation.id,
        providerKind: this.providerKind,
        credentialId: this.credentialId,
        authIndex: this.authIndex,
        model: providerModel,
        strategy: 'fill-first',
        reason: `${this.providerKind} runtime executor`,
        decidedAt: this.now()
      },
      usage: normalizeUsage(body)
    };
  }

  protected async requestJson(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    stream = false,
    signal?: AbortSignal
  ): Promise<{ status: number; body: unknown; stream?: AsyncIterable<unknown> }> {
    const secret = await this.resolveSecret(this.options.apiKeySecretRef);
    return this.httpClient.request({
      method,
      url: joinUrl(this.options.baseUrl, path),
      headers: { authorization: `Bearer ${secret}` },
      body,
      stream,
      timeoutMs: this.timeoutMs,
      signal
    });
  }

  protected throwIfProviderError(response: { status: number; body: unknown }): void {
    if (response.status < 400) return;
    throw normalizeProviderHttpError(response.status);
  }

  protected mapModel(model: string): string {
    return this.aliases.find(alias => alias.source === model)?.target ?? model;
  }
}

export class OpenAICompatibleRuntimeExecutor extends ProviderRuntimeExecutor {
  constructor(
    options: Omit<ProviderRuntimeExecutorOptions, 'providerKind'> & { providerKind?: RuntimeExecutorProviderKind }
  ) {
    super({ ...options, providerKind: options.providerKind ?? 'openaiCompatible' });
  }

  override async invoke(invocation: GatewayRuntimeInvocation): Promise<RuntimeEngineInvokeResult> {
    this.activeRequests += 1;
    try {
      const providerModel = this.mapModel(invocation.model);
      const response = await this.requestJson(
        'POST',
        invocation.protocol === 'openai.responses' ? 'responses' : 'chat/completions',
        invocation.protocol === 'openai.responses'
          ? buildOpenAIResponsesBody(invocation, providerModel)
          : buildOpenAIChatBody(invocation, providerModel)
      );
      this.throwIfProviderError(response);
      return this.projectInvokeResult(invocation, providerModel, response.body);
    } finally {
      this.activeRequests -= 1;
    }
  }

  override async *stream(
    invocation: GatewayRuntimeInvocation,
    context: RuntimeEngineExecutionContext = {}
  ): AsyncIterable<GatewayRuntimeStreamEvent> {
    this.activeRequests += 1;
    try {
      const providerModel = this.mapModel(invocation.model);
      const response = await this.requestJson(
        'POST',
        invocation.protocol === 'openai.responses' ? 'responses' : 'chat/completions',
        invocation.protocol === 'openai.responses'
          ? buildOpenAIResponsesBody({ ...invocation, stream: true }, providerModel)
          : buildOpenAIChatBody({ ...invocation, stream: true }, providerModel),
        true,
        context.signal
      );
      this.throwIfProviderError(response);
      let sequence = 0;
      let sawDone = false;
      for await (const chunk of response.stream ?? asyncIterable([response.body])) {
        if (context.signal?.aborted) return;
        const event = projectProviderStreamChunk(invocation.id, chunk, sequence, this.now());
        if (!event) continue;
        sequence += 1;
        if (event.type === 'done') sawDone = true;
        yield event;
        if (sawDone) return;
      }
      if (!context.signal?.aborted && !sawDone) {
        yield { invocationId: invocation.id, type: 'done', sequence, createdAt: this.now() };
      }
    } finally {
      this.activeRequests -= 1;
    }
  }
}

function buildOpenAIChatBody(invocation: GatewayRuntimeInvocation, model: string): Record<string, unknown> {
  return {
    model,
    messages: invocation.messages.map(message => ({
      role: message.role,
      content: message.content.map(part => (part.type === 'text' ? part.text : part.imageUrl)).join('')
    })),
    stream: invocation.stream
  };
}

function buildOpenAIResponsesBody(invocation: GatewayRuntimeInvocation, model: string): Record<string, unknown> {
  return {
    model,
    input: invocation.messages.map(message => ({
      role: message.role,
      content: message.content.map(part => ({
        type: part.type === 'text' ? 'input_text' : 'input_image',
        [part.type === 'text' ? 'text' : 'image_url']: part.type === 'text' ? part.text : part.imageUrl
      }))
    })),
    stream: invocation.stream
  };
}

function normalizeProviderHttpError(status: number): GatewayRuntimeExecutorError {
  if (status === 401 || status === 403) {
    return new GatewayRuntimeExecutorError({
      code: 'provider_auth_failed',
      type: 'authentication_error',
      message: 'Provider credential rejected',
      statusCode: status,
      retryable: false
    });
  }
  if (status === 429) {
    return new GatewayRuntimeExecutorError({
      code: 'provider_rate_limited',
      type: 'rate_limit_error',
      message: 'Provider rate limit exceeded',
      statusCode: status,
      retryable: true
    });
  }
  return new GatewayRuntimeExecutorError({
    code: 'provider_request_failed',
    type: 'api_error',
    message: 'Provider request failed',
    statusCode: status,
    retryable: status >= 500
  });
}

function parseModelList(body: unknown): GatewayRuntimeDiscoveredModel[] {
  const data = objectRecord(body).data;
  if (!Array.isArray(data)) return [];
  return data.map(item => {
    const record = objectRecord(item);
    return {
      id: stringField(record.id, 'unknown-model'),
      ownedBy: stringField(record.owned_by, stringField(record.ownedBy, 'provider')),
      created: numberField(record.created, 0)
    };
  });
}

function applyModelAliases(
  models: GatewayRuntimeDiscoveredModel[],
  aliases: RuntimeModelAlias[],
  ownedBy: string
): GatewayRuntimeDiscoveredModel[] {
  const aliasModels = aliases.map(alias => {
    const target = models.find(model => model.id === alias.target);
    return { id: alias.source, ownedBy: target?.ownedBy ?? ownedBy, created: target?.created ?? 0 };
  });
  return [...models, ...aliasModels];
}

function extractText(body: unknown): string {
  const record = objectRecord(body);
  const choice = Array.isArray(record.choices) ? objectRecord(record.choices[0]) : {};
  const message = objectRecord(choice.message);
  return stringField(message.content, stringField(record.output_text, stringField(record.text)));
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

async function* asyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item;
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

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl}/${path.replace(/^\/+/, '')}`;
}

async function defaultSecretResolver(): Promise<string> {
  throw new GatewayRuntimeExecutorError({
    code: 'provider_secret_unavailable',
    type: 'api_error',
    message: 'Provider secret resolver is not configured',
    statusCode: 500,
    retryable: false
  });
}
