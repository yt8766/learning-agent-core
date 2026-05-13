import type { GatewayRuntimeInvocation, GatewayRuntimeProviderKind, GatewayRuntimeStreamEvent } from '@agent/core';

import { GatewayRuntimeExecutorError } from './gateway-runtime-executor.error';
import type {
  GatewayRuntimeDiscoveredModel,
  GatewayRuntimeExecutor,
  ProcessProviderRuntimeCommandPlan,
  ProcessProviderRuntimeCommandResult,
  RuntimeEngineExecutionContext,
  RuntimeEngineInvokeResult
} from '../types/runtime-engine.types';

export interface ProcessProviderRuntimeExecutorOptions {
  providerKind: GatewayRuntimeProviderKind;
  commandProfile: string;
  modelIds: string[];
  credentialId?: string;
  authIndex?: string;
  timeoutMs?: number;
  runCommand: (plan: ProcessProviderRuntimeCommandPlan) => Promise<ProcessProviderRuntimeCommandResult>;
  now?: () => string;
}

export class ProcessProviderRuntimeExecutor implements GatewayRuntimeExecutor {
  readonly providerKind: GatewayRuntimeProviderKind;
  private activeRequests = 0;
  private readonly now: () => string;

  constructor(private readonly options: ProcessProviderRuntimeExecutorOptions) {
    this.providerKind = options.providerKind;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async health() {
    return {
      providerKind: this.providerKind,
      status: 'ready' as const,
      checkedAt: this.now(),
      activeRequests: this.activeRequests,
      supportsStreaming: false
    };
  }

  async discoverModels(): Promise<GatewayRuntimeDiscoveredModel[]> {
    return this.options.modelIds.map(id => ({
      id,
      ownedBy: this.providerKind,
      created: 0
    }));
  }

  canHandle(invocation: GatewayRuntimeInvocation, context: RuntimeEngineExecutionContext = {}): boolean {
    if (context.providerKind && context.providerKind !== this.providerKind) return false;
    return this.options.modelIds.includes(invocation.model);
  }

  async invoke(
    invocation: GatewayRuntimeInvocation,
    context: RuntimeEngineExecutionContext = {}
  ): Promise<RuntimeEngineInvokeResult> {
    this.activeRequests += 1;
    try {
      const result = await this.options.runCommand({
        commandProfile: this.options.commandProfile,
        invocation,
        timeoutMs: this.options.timeoutMs,
        signal: context.signal
      });
      if (result.exitCode !== 0) throw processExitError(result);
      return this.projectInvokeResult(invocation, result);
    } catch (error) {
      if (error instanceof GatewayRuntimeExecutorError) throw error;
      throw new GatewayRuntimeExecutorError({
        code: 'provider_process_failed',
        type: 'api_error',
        message: 'Provider process adapter failed',
        statusCode: 502,
        retryable: true,
        cause: sanitizeDiagnostic(error instanceof Error ? error.message : String(error))
      });
    } finally {
      this.activeRequests -= 1;
    }
  }

  async *stream(invocation: GatewayRuntimeInvocation): AsyncIterable<GatewayRuntimeStreamEvent> {
    const result = await this.invoke(invocation);
    yield {
      invocationId: invocation.id,
      type: 'delta',
      sequence: 0,
      createdAt: this.now(),
      delta: { text: result.text }
    };
    yield {
      invocationId: invocation.id,
      type: 'usage',
      sequence: 1,
      createdAt: this.now(),
      usage: result.usage
    };
    yield { invocationId: invocation.id, type: 'done', sequence: 2, createdAt: this.now() };
  }

  private projectInvokeResult(
    invocation: GatewayRuntimeInvocation,
    commandResult: ProcessProviderRuntimeCommandResult
  ): RuntimeEngineInvokeResult {
    const body = parseStdoutJson(commandResult.stdout);
    const usage = normalizeUsage(objectRecord(body).usage);
    const diagnostic = sanitizeDiagnostic(commandResult.stderr);
    return {
      invocationId: invocation.id,
      model: invocation.model,
      text: stringField(objectRecord(body).text),
      route: {
        invocationId: invocation.id,
        providerKind: this.providerKind,
        credentialId: this.options.credentialId ?? `${this.providerKind}-process`,
        authIndex: this.options.authIndex,
        model: invocation.model,
        strategy: 'fill-first',
        reason: `${this.providerKind} process runtime executor`,
        decidedAt: this.now()
      },
      usage,
      ...(diagnostic ? { diagnostic } : {})
    };
  }
}

function processExitError(result: ProcessProviderRuntimeCommandResult): GatewayRuntimeExecutorError {
  return new GatewayRuntimeExecutorError({
    code: 'provider_process_failed',
    type: 'api_error',
    message: 'Provider process adapter failed',
    statusCode: 502,
    retryable: true,
    cause: sanitizeDiagnostic(result.stderr)
  });
}

function parseStdoutJson(stdout: string): unknown {
  try {
    return JSON.parse(stdout);
  } catch {
    throw new GatewayRuntimeExecutorError({
      code: 'provider_process_invalid_result',
      type: 'api_error',
      message: 'Provider process adapter returned invalid JSON',
      statusCode: 502,
      retryable: false
    });
  }
}

function normalizeUsage(value: unknown) {
  const usage = objectRecord(value);
  const inputTokens = numberField(usage.inputTokens, numberField(usage.input_tokens, 0));
  const outputTokens = numberField(usage.outputTokens, numberField(usage.output_tokens, 0));
  return {
    inputTokens,
    outputTokens,
    totalTokens: numberField(usage.totalTokens, numberField(usage.total_tokens, inputTokens + outputTokens))
  };
}

function sanitizeDiagnostic(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]')
    .trim()
    .slice(0, 500);
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
