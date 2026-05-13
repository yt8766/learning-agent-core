import { HttpException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import type { GatewayRuntimeInvocation, GatewayRuntimeStreamEvent } from '@agent/core';

import { RuntimeQuotaService } from '../../src/domains/agent-gateway/runtime-engine/accounting/runtime-quota.service';
import { RuntimeUsageQueueService } from '../../src/domains/agent-gateway/runtime-engine/accounting/runtime-usage-queue.service';
import {
  DeterministicOpenAICompatibleExecutor,
  GATEWAY_RUNTIME_EXECUTORS,
  GatewayRuntimeExecutorError,
  ProcessProviderRuntimeExecutor
} from '../../src/domains/agent-gateway/runtime-engine/executors';
import { RuntimeEngineFacade } from '../../src/domains/agent-gateway/runtime-engine/runtime-engine.facade';
import { RuntimeEngineModule } from '../../src/domains/agent-gateway/runtime-engine/runtime-engine.module';
import type {
  GatewayRuntimeExecutor,
  ProcessProviderRuntimeCommandPlan,
  ProcessProviderRuntimeCommandResult,
  RuntimeEngineInvokeResult
} from '../../src/domains/agent-gateway/runtime-engine/types/runtime-engine.types';

describe('RuntimeEngineFacade real executor boundary', () => {
  it('lists registered executors in health', async () => {
    const facade = new RuntimeEngineFacade(
      new RuntimeQuotaService(),
      new RuntimeUsageQueueService(),
      [new DeterministicOpenAICompatibleExecutor({ modelIds: ['gpt-5.4'] })],
      fixedNow
    );

    await expect(facade.health()).resolves.toMatchObject({
      status: 'ready',
      executors: [
        {
          providerKind: 'codex',
          status: 'ready',
          supportsStreaming: true,
          activeRequests: 0
        }
      ]
    });
  });

  it('discovers OpenAI-compatible models from executors', async () => {
    const facade = new RuntimeEngineFacade(
      new RuntimeQuotaService(),
      new RuntimeUsageQueueService(),
      [new DeterministicOpenAICompatibleExecutor({ modelIds: ['gpt-5.4', 'gpt-5-codex'] })],
      fixedNow
    );

    await expect(facade.listModels()).resolves.toEqual({
      object: 'list',
      data: [
        { id: 'gpt-5.4', object: 'model', created: 1_778_367_600, owned_by: 'codex' },
        { id: 'gpt-5-codex', object: 'model', created: 1_778_367_600, owned_by: 'codex' }
      ]
    });
  });

  it('delegates chat completions to the selected executor and records route usage', async () => {
    const quota = new RuntimeQuotaService();
    const queue = new RuntimeUsageQueueService();
    const executor = new RecordingExecutor({
      text: 'executor fixture response',
      providerKind: 'claude',
      modelIds: ['claude-sonnet-4.5']
    });
    const facade = new RuntimeEngineFacade(quota, queue, [executor], fixedNow);

    const result = await facade.invoke(createInvocation({ model: 'claude-sonnet-4.5' }));

    expect(executor.invocations).toHaveLength(1);
    expect(result.text).toBe('executor fixture response');
    expect(result.text).not.toBe('pong');
    expect(result.route).toMatchObject({
      providerKind: 'claude',
      credentialId: 'fixture-credential',
      model: 'claude-sonnet-4.5',
      strategy: 'fill-first'
    });
    expect(queue.pop(1)).toMatchObject([
      {
        recordKind: 'runtime-audit',
        requestId: 'inv_1',
        providerKind: 'claude',
        model: 'claude-sonnet-4.5',
        clientId: 'client_1',
        failed: false,
        tokens: { inputTokens: 7, outputTokens: 11, totalTokens: 18 }
      }
    ]);
  });

  it('normalizes provider failures without leaking secret material', async () => {
    const facade = new RuntimeEngineFacade(
      new RuntimeQuotaService(),
      new RuntimeUsageQueueService(),
      [new ThrowingExecutor()],
      fixedNow
    );

    await expect(facade.invoke(createInvocation({ model: 'kimi-k2' }))).rejects.toMatchObject({
      status: 401,
      response: {
        error: {
          code: 'provider_auth_failed',
          message: 'Provider credential rejected',
          type: 'authentication_error'
        }
      }
    });

    try {
      await facade.invoke(createInvocation({ model: 'kimi-k2' }));
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect(JSON.stringify((error as HttpException).getResponse())).not.toContain('sk-live-secret');
    }
  });

  it('registers the deterministic executor through RuntimeEngineModule', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [RuntimeEngineModule] }).compile();
    const executors = moduleRef.get<GatewayRuntimeExecutor[]>(GATEWAY_RUNTIME_EXECUTORS);
    const facade = moduleRef.get(RuntimeEngineFacade);

    expect(executors).toHaveLength(1);
    await expect(facade.health()).resolves.toMatchObject({
      status: 'ready',
      executors: [{ providerKind: 'codex', status: 'ready' }]
    });
  });

  it('executes provider process adapters through a deterministic runner boundary', async () => {
    const runner = new RecordingProcessRunner([
      {
        exitCode: 0,
        stdout: JSON.stringify({
          text: 'process provider response',
          usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 },
          rawProviderPayload: { token: 'do-not-project' }
        }),
        stderr: 'debug line with sk-live-secret'
      }
    ]);
    const executor = new ProcessProviderRuntimeExecutor({
      providerKind: 'claude',
      commandProfile: 'claude-cli-fixture',
      modelIds: ['claude-sonnet-4.5'],
      credentialId: 'claude-process-credential',
      authIndex: 'auth-file-1',
      runCommand: runner.run,
      now: fixedNow
    });

    const result = await executor.invoke(createInvocation({ model: 'claude-sonnet-4.5' }));

    expect(runner.plans).toHaveLength(1);
    expect(runner.plans[0]).toMatchObject({
      commandProfile: 'claude-cli-fixture',
      invocation: {
        id: 'inv_1',
        model: 'claude-sonnet-4.5',
        protocol: 'openai.chat.completions'
      }
    });
    expect(result).toMatchObject({
      invocationId: 'inv_1',
      model: 'claude-sonnet-4.5',
      text: 'process provider response',
      route: {
        providerKind: 'claude',
        credentialId: 'claude-process-credential',
        authIndex: 'auth-file-1',
        strategy: 'fill-first'
      },
      usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 },
      diagnostic: 'debug line with [REDACTED]'
    });
    expect(JSON.stringify(result)).not.toContain('rawProviderPayload');
    expect(JSON.stringify(result)).not.toContain('do-not-project');
    expect(JSON.stringify(result)).not.toContain('sk-live-secret');
  });

  it('maps non-zero process exits to sanitized executor errors', async () => {
    const executor = new ProcessProviderRuntimeExecutor({
      providerKind: 'gemini',
      commandProfile: 'gemini-cli-fixture',
      modelIds: ['gemini-2.5-pro'],
      runCommand: async () => ({
        exitCode: 2,
        stdout: '{"error":"raw stdout should not leak"}',
        stderr: 'fatal upstream error with Bearer sk-live-secret'
      }),
      now: fixedNow
    });

    await expect(executor.invoke(createInvocation({ model: 'gemini-2.5-pro' }))).rejects.toMatchObject({
      code: 'provider_process_failed',
      type: 'api_error',
      statusCode: 502,
      retryable: true,
      message: 'Provider process adapter failed'
    });

    try {
      await executor.invoke(createInvocation({ model: 'gemini-2.5-pro' }));
    } catch (error) {
      expect(error).toBeInstanceOf(GatewayRuntimeExecutorError);
      expect(JSON.stringify(error)).not.toContain('sk-live-secret');
      expect(JSON.stringify(error)).not.toContain('raw stdout should not leak');
    }
  });
});

class RecordingProcessRunner {
  readonly plans: ProcessProviderRuntimeCommandPlan[] = [];
  private responseIndex = 0;

  constructor(private readonly responses: ProcessProviderRuntimeCommandResult[]) {}

  run = async (plan: ProcessProviderRuntimeCommandPlan): Promise<ProcessProviderRuntimeCommandResult> => {
    this.plans.push(plan);
    const response = this.responses[this.responseIndex];
    this.responseIndex += 1;
    if (!response) throw new Error('Unexpected process runner invocation');
    return response;
  };
}

class RecordingExecutor implements GatewayRuntimeExecutor {
  readonly providerKind;
  readonly invocations: GatewayRuntimeInvocation[] = [];

  constructor(private readonly fixture: { text: string; providerKind: 'claude'; modelIds: string[] }) {
    this.providerKind = fixture.providerKind;
  }

  async health() {
    return {
      providerKind: this.providerKind,
      status: 'ready' as const,
      checkedAt: fixedNow(),
      activeRequests: 0,
      supportsStreaming: true
    };
  }

  async discoverModels() {
    return this.fixture.modelIds.map(id => ({ id, ownedBy: this.providerKind, created: 1_778_367_600 }));
  }

  canHandle(invocation: GatewayRuntimeInvocation): boolean {
    return this.fixture.modelIds.includes(invocation.model);
  }

  async invoke(invocation: GatewayRuntimeInvocation): Promise<RuntimeEngineInvokeResult> {
    this.invocations.push(invocation);
    return {
      invocationId: invocation.id,
      model: invocation.model,
      text: this.fixture.text,
      route: {
        invocationId: invocation.id,
        providerKind: this.providerKind,
        credentialId: 'fixture-credential',
        authIndex: 'fixture-auth-file',
        model: invocation.model,
        strategy: 'fill-first',
        reason: 'recording executor fixture',
        decidedAt: fixedNow()
      },
      usage: { inputTokens: 7, outputTokens: 11, totalTokens: 18 }
    };
  }

  async *stream(invocation: GatewayRuntimeInvocation): AsyncIterable<GatewayRuntimeStreamEvent> {
    yield {
      invocationId: invocation.id,
      type: 'done',
      sequence: 0,
      createdAt: fixedNow()
    };
  }
}

class ThrowingExecutor implements GatewayRuntimeExecutor {
  readonly providerKind = 'kimi' as const;

  async health() {
    return {
      providerKind: this.providerKind,
      status: 'ready' as const,
      checkedAt: fixedNow(),
      activeRequests: 0,
      supportsStreaming: false
    };
  }

  async discoverModels() {
    return [{ id: 'kimi-k2', ownedBy: this.providerKind, created: 1_778_367_600 }];
  }

  canHandle(invocation: GatewayRuntimeInvocation): boolean {
    return invocation.model === 'kimi-k2';
  }

  async invoke(): Promise<RuntimeEngineInvokeResult> {
    throw new GatewayRuntimeExecutorError({
      code: 'provider_auth_failed',
      type: 'authentication_error',
      message: 'Provider credential rejected',
      statusCode: 401,
      retryable: false,
      cause: new Error('vendor payload included sk-live-secret')
    });
  }

  async *stream(invocation: GatewayRuntimeInvocation): AsyncIterable<GatewayRuntimeStreamEvent> {
    yield {
      invocationId: invocation.id,
      type: 'done',
      sequence: 0,
      createdAt: fixedNow()
    };
  }
}

function createInvocation(options: { model: string }): GatewayRuntimeInvocation {
  return {
    id: 'inv_1',
    protocol: 'openai.chat.completions',
    model: options.model,
    stream: false,
    messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
    requestedAt: '2026-05-10T00:00:00.000Z',
    client: { clientId: 'client_1', apiKeyId: 'key_1', scopes: ['chat.completions'] },
    metadata: {}
  };
}

function fixedNow(): string {
  return '2026-05-11T00:00:00.000Z';
}
