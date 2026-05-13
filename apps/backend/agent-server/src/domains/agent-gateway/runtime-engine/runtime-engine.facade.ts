import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import type { GatewayOpenAIModelsResponse, GatewayRuntimeInvocation, GatewayRuntimeStreamEvent } from '@agent/core';
import { openAIError } from '../runtime/agent-gateway-openai-error';
import { RuntimeQuotaExceededError, RuntimeQuotaService } from './accounting/runtime-quota.service';
import { RuntimeUsageQueueService } from './accounting/runtime-usage-queue.service';
import {
  DeterministicOpenAICompatibleExecutor,
  GATEWAY_RUNTIME_CLOCK,
  GATEWAY_RUNTIME_EXECUTORS,
  GatewayRuntimeExecutorError
} from './executors';
import type {
  GatewayRuntimeExecutor,
  RuntimeEngineExecutionContext,
  RuntimeEngineHealth,
  RuntimeEngineInvokeResult,
  RuntimeEnginePort
} from './types/runtime-engine.types';

function nowIso(): string {
  return new Date().toISOString();
}

@Injectable()
export class RuntimeEngineFacade implements RuntimeEnginePort {
  private activeRequests = 0;
  private activeStreams = 0;

  constructor(
    private readonly quota: RuntimeQuotaService = new RuntimeQuotaService(),
    private readonly usageQueue: RuntimeUsageQueueService = new RuntimeUsageQueueService(),
    @Optional()
    @Inject(GATEWAY_RUNTIME_EXECUTORS)
    private readonly executors: GatewayRuntimeExecutor[] = [new DeterministicOpenAICompatibleExecutor()],
    @Optional()
    @Inject(GATEWAY_RUNTIME_CLOCK)
    private readonly now: () => string = nowIso
  ) {}

  async health(): Promise<RuntimeEngineHealth> {
    const executors = await Promise.all(this.executors.map(executor => executor.health()));
    const hasError = executors.some(executor => executor.status === 'error');
    const hasDegraded = executors.some(executor => executor.status === 'degraded' || executor.status === 'disabled');
    return {
      status: hasError ? 'error' : hasDegraded ? 'degraded' : 'ready',
      checkedAt: this.now(),
      executors,
      activeRequests: this.activeRequests + executors.reduce((total, executor) => total + executor.activeRequests, 0),
      activeStreams: this.activeStreams,
      usageQueue: this.usageQueue.snapshot(),
      cooldowns: this.quota.snapshotCooldowns()
    };
  }

  async listModels(): Promise<GatewayOpenAIModelsResponse> {
    const models = (await Promise.all(this.executors.map(executor => executor.discoverModels()))).flat().map(model => ({
      id: model.id,
      object: 'model' as const,
      created: model.created,
      owned_by: model.ownedBy
    }));
    return {
      object: 'list',
      data: models
    };
  }

  async invoke(
    invocation: GatewayRuntimeInvocation,
    context: RuntimeEngineExecutionContext = {}
  ): Promise<RuntimeEngineInvokeResult> {
    this.precheckClientQuota(invocation);

    const executor = this.selectExecutor(invocation, context);
    this.activeRequests += 1;
    try {
      const result = await executor.invoke(invocation, context);
      this.recordRuntimeUsageAudit(invocation, result.route.providerKind, false, result.usage);
      return result;
    } catch (error) {
      this.recordRuntimeUsageAudit(invocation, executor.providerKind, true, {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      });
      throw normalizeExecutorError(error);
    } finally {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
    }
  }

  async *stream(
    invocation: GatewayRuntimeInvocation,
    context: RuntimeEngineExecutionContext = {}
  ): AsyncIterable<GatewayRuntimeStreamEvent> {
    this.precheckClientQuota(invocation);
    const executor = this.selectExecutor(invocation, context);

    this.activeStreams += 1;
    try {
      for await (const event of executor.stream(invocation, context)) {
        if (context.signal?.aborted) return;
        if (event.type === 'usage') {
          this.recordRuntimeUsageAudit(invocation, executor.providerKind, false, event.usage);
        }
        yield event;
      }
    } catch (error) {
      this.recordRuntimeUsageAudit(invocation, executor.providerKind, true, {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0
      });
      throw normalizeExecutorError(error);
    } finally {
      this.activeStreams = Math.max(0, this.activeStreams - 1);
    }
  }

  private selectExecutor(
    invocation: GatewayRuntimeInvocation,
    context: RuntimeEngineExecutionContext
  ): GatewayRuntimeExecutor {
    const executor = this.executors.find(candidate => candidate.canHandle(invocation, context));
    if (executor) return executor;

    throw new HttpException(
      openAIError(
        'provider_not_found',
        `No runtime executor can serve model ${invocation.model}`,
        'invalid_request_error'
      ),
      HttpStatus.BAD_REQUEST
    );
  }

  private precheckClientQuota(invocation: GatewayRuntimeInvocation): void {
    try {
      this.quota.precheck({
        subjectType: 'client',
        subjectId: invocation.client.clientId,
        estimatedTokens: 1,
        estimatedRequests: 1
      });
    } catch (error) {
      if (error instanceof RuntimeQuotaExceededError) {
        throw new HttpException(openAIError(error.code, error.message, error.type), HttpStatus.TOO_MANY_REQUESTS);
      }
      throw error;
    }
  }

  private recordRuntimeUsageAudit(
    invocation: GatewayRuntimeInvocation,
    providerKind: string,
    failed: boolean,
    tokens: { inputTokens: number; outputTokens: number; totalTokens: number }
  ): void {
    this.quota.consume({
      subjectType: 'client',
      subjectId: invocation.client.clientId,
      tokens: tokens.totalTokens,
      requests: 1
    });
    this.usageQueue.append({
      recordKind: 'runtime-audit',
      requestId: invocation.id,
      timestamp: this.now(),
      providerKind,
      model: invocation.model,
      clientId: invocation.client.clientId,
      failed,
      tokens
    });
  }
}

function normalizeExecutorError(error: unknown): Error {
  if (error instanceof HttpException) return error;
  if (error instanceof GatewayRuntimeExecutorError) {
    return new HttpException(openAIError(error.code, error.message, error.type), error.statusCode);
  }
  throw error;
}
