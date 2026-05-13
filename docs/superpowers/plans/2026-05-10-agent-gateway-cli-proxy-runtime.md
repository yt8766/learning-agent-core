# Agent Gateway CLI Proxy Runtime Implementation Plan

状态：proposed  
文档类型：plan  
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-gateway`、`packages/core/src/contracts/agent-gateway`  
最后核对：2026-05-10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an in-process Agent Gateway CLIProxyAPI runtime inside `agent-server`, with real runtime-engine boundaries, schema-first contracts, quota accounting, management projections, and an enhanced `agent-gateway` console.

**Architecture:** Keep `agent-server` as the owner of Identity, management APIs, quota, audit, config, and runtime lifecycle. Add `domains/agent-gateway/runtime-engine/` as the internal CLIProxyAPI execution kernel; controllers and existing services call runtime-engine facades instead of mock providers or external CLIProxyAPI. Keep `CliProxyManagementClient` only as a migration/import adapter, never as the default runtime dependency.

**Tech Stack:** TypeScript, NestJS, Zod, React, TanStack Query, Zustand, Axios, Vitest, pnpm workspace, Node child process APIs behind project-owned adapters.

---

## Scope Check

This is one vertical-slice plan because runtime protocol contracts, quota accounting, management projections, and the frontend console must agree on the same `@agent/core` schemas. The plan is intentionally staged so each task is testable on its own. Do not use `git worktree`; this repository requires implementation in the current checkout.

The full upstream CLIProxyAPI surface is large. This plan delivers the foundation and first real execution slice, then expands provider/protocol parity behind stable interfaces. If implementation pressure becomes too high, finish Tasks 1-6 first; those tasks produce a working `/v1/chat/completions` runtime path with quota and health.

## File Structure

- Modify `packages/core/src/contracts/agent-gateway/agent-gateway-internal-cli-proxy.schemas.ts`
  - Add runtime-engine invocation, response, stream event, route decision, executor health, and quota policy schemas.
- Modify `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
  - Export `z.infer` types for the new schemas.
- Modify `packages/core/src/contracts/agent-gateway/index.ts`
  - Export runtime-engine contracts.
- Create `packages/core/test/agent-gateway/agent-gateway-runtime-engine-contracts.test.ts`
  - Contract parse tests and raw payload leakage tests.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.module.ts`
  - Nest module for runtime-engine providers.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.facade.ts`
  - Public facade consumed by controllers/services.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/types/runtime-engine.types.ts`
  - Backend-only runtime interfaces derived from `@agent/core` contracts.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol.ts`
  - OpenAI Chat Completions normalize/project helpers.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/openai-responses.protocol.ts`
  - OpenAI Responses normalize/project helpers.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/claude-messages.protocol.ts`
  - Claude Messages normalize/project helpers.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/gemini-generate-content.protocol.ts`
  - Gemini generateContent normalize/project helpers.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/processes/cli-process-runner.ts`
  - Project-owned child process boundary.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/processes/mock-cli-process-runner.ts`
  - Deterministic runner for tests and local smoke.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/runtime-executor.ts`
  - Executor interface and injection token.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors/mock-runtime.executor.ts`
  - First executor using the process runner harness.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/routing/runtime-router.service.ts`
  - Runtime credential/provider route decision service.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/runtime-quota.service.ts`
  - API key, client, user, and provider quota precheck/consume/refund.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/runtime-usage-queue.service.ts`
  - Usage queue projection and append/pop behavior.
- Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/streaming/runtime-streaming.service.ts`
  - Internal stream events to OpenAI SSE chunks.
- Modify `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-openai-compatible.controller.ts`
  - Delegate `/v1/models` and `/v1/chat/completions` to runtime-engine facade.
- Modify `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
  - Import `RuntimeEngineModule` and remove mock relay as the `/v1/*` runtime owner.
- Create `apps/backend/agent-server/test/agent-gateway/runtime-engine-contract.spec.ts`
  - Backend facade DI and contract tests.
- Create `apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts`
  - Non-streaming and streaming runtime integration tests.
- Create `apps/backend/agent-server/test/agent-gateway/runtime-engine-quota.spec.ts`
  - Quota deny/consume/refund tests.
- Modify `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
  - Add runtime health, usage queue, executor status, and user quota client methods.
- Create `apps/frontend/agent-gateway/src/app/pages/RuntimeEnginePage.tsx`
  - Runtime health, executors, active streams, and usage queue page.
- Modify `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
  - Add `runtime` view id and navigation metadata.
- Modify `apps/frontend/agent-gateway/src/app/GatewayWorkspacePages.tsx`
  - Render runtime page.
- Create `apps/frontend/agent-gateway/test/agent-gateway-runtime-engine-page.test.tsx`
  - Runtime page render and empty-state tests.
- Modify `docs/contracts/api/agent-gateway.md`
  - Document runtime-engine contracts and mark external CLIProxyAPI mode as migration-only.
- Modify `docs/apps/backend/agent-server/agent-gateway.md`
  - Document embedded runtime-engine ownership.
- Modify `docs/apps/frontend/agent-gateway/README.md`
  - Document runtime console view and quota enhancements.

## Task 1: Runtime Engine Core Contracts

**Files:**

- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway-internal-cli-proxy.schemas.ts`
- Modify: `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`
- Modify: `packages/core/src/contracts/agent-gateway/index.ts`
- Test: `packages/core/test/agent-gateway/agent-gateway-runtime-engine-contracts.test.ts`

- [ ] **Step 1: Write failing schema tests**

Create `packages/core/test/agent-gateway/agent-gateway-runtime-engine-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  GatewayRuntimeErrorSchema,
  GatewayRuntimeExecutorHealthSchema,
  GatewayRuntimeInvocationSchema,
  GatewayRuntimeQuotaPolicySchema,
  GatewayRuntimeRouteDecisionSchema,
  GatewayRuntimeStreamEventSchema
} from '../../src/contracts/agent-gateway';

describe('agent gateway runtime engine contracts', () => {
  it('parses a normalized OpenAI chat invocation without raw vendor payloads', () => {
    const invocation = GatewayRuntimeInvocationSchema.parse({
      id: 'inv_1',
      protocol: 'openai.chat.completions',
      model: 'gpt-5-codex',
      stream: false,
      messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }],
      requestedAt: '2026-05-10T00:00:00.000Z',
      client: { clientId: 'client_1', apiKeyId: 'key_1', scopes: ['chat.completions'] },
      metadata: { userId: 'user_1' }
    });

    expect(invocation.protocol).toBe('openai.chat.completions');
    expect(JSON.stringify(invocation)).not.toContain('rawPayload');
  });

  it('parses route decisions used by logs and debug panels', () => {
    const decision = GatewayRuntimeRouteDecisionSchema.parse({
      invocationId: 'inv_1',
      providerKind: 'codex',
      credentialId: 'cred_1',
      authIndex: 'auth_1',
      model: 'gpt-5-codex',
      strategy: 'round-robin',
      reason: 'matched model alias and healthy credential',
      decidedAt: '2026-05-10T00:00:01.000Z'
    });

    expect(decision.providerKind).toBe('codex');
  });

  it('parses stream events and protocol-safe errors', () => {
    expect(
      GatewayRuntimeStreamEventSchema.parse({
        invocationId: 'inv_1',
        type: 'delta',
        sequence: 1,
        createdAt: '2026-05-10T00:00:02.000Z',
        delta: { text: 'pong' }
      }).type
    ).toBe('delta');

    expect(
      GatewayRuntimeErrorSchema.parse({
        code: 'quota_exceeded',
        type: 'insufficient_quota',
        message: 'Gateway quota exceeded.',
        retryable: false
      }).code
    ).toBe('quota_exceeded');
  });

  it('parses executor health and quota policy projections', () => {
    expect(
      GatewayRuntimeExecutorHealthSchema.parse({
        providerKind: 'codex',
        status: 'ready',
        checkedAt: '2026-05-10T00:00:03.000Z',
        activeRequests: 0,
        supportsStreaming: true
      }).status
    ).toBe('ready');

    expect(
      GatewayRuntimeQuotaPolicySchema.parse({
        subjectType: 'client',
        subjectId: 'client_1',
        window: 'monthly',
        maxTokens: 1000000,
        maxRequests: 10000,
        action: 'deny'
      }).action
    ).toBe('deny');
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-runtime-engine-contracts.test.ts
```

Expected: FAIL because the new runtime-engine schemas are not exported.

- [ ] **Step 3: Add schema definitions**

Append these exports to `packages/core/src/contracts/agent-gateway/agent-gateway-internal-cli-proxy.schemas.ts`:

```ts
import { z } from 'zod/v4';

export const GatewayRuntimeProtocolSchema = z.enum([
  'openai.chat.completions',
  'openai.responses',
  'claude.messages',
  'gemini.generateContent'
]);

export const GatewayRuntimeProviderKindSchema = z.enum([
  'codex',
  'claude',
  'gemini',
  'antigravity',
  'openaiCompatible',
  'ampcode'
]);

export const GatewayRuntimeMessageContentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('imageUrl'), imageUrl: z.string() })
]);

export const GatewayRuntimeMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.array(GatewayRuntimeMessageContentPartSchema)
});

export const GatewayRuntimeInvocationSchema = z.object({
  id: z.string().min(1),
  protocol: GatewayRuntimeProtocolSchema,
  model: z.string().min(1),
  stream: z.boolean(),
  messages: z.array(GatewayRuntimeMessageSchema),
  requestedAt: z.string().min(1),
  client: z.object({
    clientId: z.string().min(1),
    apiKeyId: z.string().min(1),
    scopes: z.array(z.string().min(1))
  }),
  metadata: z.object({ userId: z.string().optional(), sessionId: z.string().optional() }).default({})
});

export const GatewayRuntimeRouteDecisionSchema = z.object({
  invocationId: z.string().min(1),
  providerKind: GatewayRuntimeProviderKindSchema,
  credentialId: z.string().min(1),
  authIndex: z.string().optional(),
  model: z.string().min(1),
  strategy: z.enum(['round-robin', 'fill-first', 'session-affinity']),
  reason: z.string().min(1),
  decidedAt: z.string().min(1)
});

export const GatewayRuntimeStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    invocationId: z.string().min(1),
    type: z.literal('delta'),
    sequence: z.number().int().nonnegative(),
    createdAt: z.string().min(1),
    delta: z.object({ text: z.string().default('') })
  }),
  z.object({
    invocationId: z.string().min(1),
    type: z.literal('usage'),
    sequence: z.number().int().nonnegative(),
    createdAt: z.string().min(1),
    usage: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
      totalTokens: z.number().int().nonnegative()
    })
  }),
  z.object({
    invocationId: z.string().min(1),
    type: z.literal('done'),
    sequence: z.number().int().nonnegative(),
    createdAt: z.string().min(1)
  })
]);

export const GatewayRuntimeErrorSchema = z.object({
  code: z.string().min(1),
  type: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean()
});

export const GatewayRuntimeExecutorHealthSchema = z.object({
  providerKind: GatewayRuntimeProviderKindSchema,
  status: z.enum(['ready', 'degraded', 'disabled', 'error']),
  checkedAt: z.string().min(1),
  activeRequests: z.number().int().nonnegative(),
  supportsStreaming: z.boolean(),
  message: z.string().optional()
});

export const GatewayRuntimeQuotaPolicySchema = z.object({
  subjectType: z.enum(['user', 'client', 'apiKey']),
  subjectId: z.string().min(1),
  window: z.enum(['daily', 'monthly', 'rolling']),
  maxTokens: z.number().int().positive().optional(),
  maxRequests: z.number().int().positive().optional(),
  providerKinds: z.array(GatewayRuntimeProviderKindSchema).optional(),
  models: z.array(z.string().min(1)).optional(),
  action: z.enum(['deny', 'warn', 'fallback'])
});
```

- [ ] **Step 4: Export inferred types**

Add matching exports in `packages/core/src/contracts/agent-gateway/agent-gateway.types.ts`:

```ts
export type GatewayRuntimeInvocation = z.infer<typeof GatewayRuntimeInvocationSchema>;
export type GatewayRuntimeRouteDecision = z.infer<typeof GatewayRuntimeRouteDecisionSchema>;
export type GatewayRuntimeStreamEvent = z.infer<typeof GatewayRuntimeStreamEventSchema>;
export type GatewayRuntimeError = z.infer<typeof GatewayRuntimeErrorSchema>;
export type GatewayRuntimeExecutorHealth = z.infer<typeof GatewayRuntimeExecutorHealthSchema>;
export type GatewayRuntimeQuotaPolicy = z.infer<typeof GatewayRuntimeQuotaPolicySchema>;
```

Ensure the file imports the new schema names from `agent-gateway-internal-cli-proxy.schemas.ts`.

- [ ] **Step 5: Export contracts from the barrel**

In `packages/core/src/contracts/agent-gateway/index.ts`, export the schema and type files if they are not already exported:

```ts
export * from './agent-gateway-internal-cli-proxy.schemas';
export * from './agent-gateway.types';
```

- [ ] **Step 6: Run contract tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway/agent-gateway-runtime-engine-contracts.test.ts
```

Expected: PASS.

## Task 2: Runtime Engine Module Skeleton

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.module.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.facade.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/types/runtime-engine.types.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/runtime-engine-contract.spec.ts`

- [ ] **Step 1: Write failing DI and facade tests**

Create `apps/backend/agent-server/test/agent-gateway/runtime-engine-contract.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AgentGatewayModule } from '../../src/domains/agent-gateway/agent-gateway.module';
import { RuntimeEngineFacade } from '../../src/domains/agent-gateway/runtime-engine/runtime-engine.facade';

describe('RuntimeEngineModule', () => {
  it('is available through AgentGatewayModule', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AgentGatewayModule] }).compile();

    const facade = moduleRef.get(RuntimeEngineFacade);
    await expect(facade.health()).resolves.toMatchObject({
      status: 'ready',
      executors: expect.any(Array)
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-contract.spec.ts
```

Expected: FAIL because `RuntimeEngineFacade` does not exist.

- [ ] **Step 3: Add backend runtime types**

Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/types/runtime-engine.types.ts`:

```ts
import type {
  GatewayRuntimeExecutorHealth,
  GatewayRuntimeInvocation,
  GatewayRuntimeRouteDecision,
  GatewayRuntimeStreamEvent
} from '@agent/core';

export interface RuntimeEngineHealth {
  status: 'ready' | 'degraded' | 'error';
  checkedAt: string;
  executors: GatewayRuntimeExecutorHealth[];
}

export interface RuntimeEngineInvokeResult {
  invocationId: string;
  model: string;
  text: string;
  route: GatewayRuntimeRouteDecision;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface RuntimeEnginePort {
  health(): Promise<RuntimeEngineHealth>;
  invoke(invocation: GatewayRuntimeInvocation): Promise<RuntimeEngineInvokeResult>;
  stream(invocation: GatewayRuntimeInvocation): AsyncIterable<GatewayRuntimeStreamEvent>;
}
```

- [ ] **Step 4: Add facade**

Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.facade.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { GatewayRuntimeInvocation, GatewayRuntimeStreamEvent } from '@agent/core';
import type { RuntimeEngineHealth, RuntimeEngineInvokeResult, RuntimeEnginePort } from './types/runtime-engine.types';

function nowIso(): string {
  return new Date().toISOString();
}

@Injectable()
export class RuntimeEngineFacade implements RuntimeEnginePort {
  async health(): Promise<RuntimeEngineHealth> {
    return {
      status: 'ready',
      checkedAt: nowIso(),
      executors: []
    };
  }

  async invoke(invocation: GatewayRuntimeInvocation): Promise<RuntimeEngineInvokeResult> {
    return {
      invocationId: invocation.id,
      model: invocation.model,
      text: 'pong',
      route: {
        invocationId: invocation.id,
        providerKind: 'codex',
        credentialId: 'mock-credential',
        authIndex: 'mock-auth',
        model: invocation.model,
        strategy: 'round-robin',
        reason: 'runtime engine skeleton route',
        decidedAt: nowIso()
      },
      usage: {
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2
      }
    };
  }

  async *stream(invocation: GatewayRuntimeInvocation): AsyncIterable<GatewayRuntimeStreamEvent> {
    yield {
      invocationId: invocation.id,
      type: 'delta',
      sequence: 0,
      createdAt: nowIso(),
      delta: { text: 'pong' }
    };
    yield {
      invocationId: invocation.id,
      type: 'done',
      sequence: 1,
      createdAt: nowIso()
    };
  }
}
```

- [ ] **Step 5: Add module and import it**

Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { RuntimeEngineFacade } from './runtime-engine.facade';

@Module({
  providers: [RuntimeEngineFacade],
  exports: [RuntimeEngineFacade]
})
export class RuntimeEngineModule {}
```

Modify `apps/backend/agent-server/src/domains/agent-gateway/agent-gateway.module.ts`:

```ts
import { RuntimeEngineModule } from './runtime-engine/runtime-engine.module';

@Module({
  imports: [IdentityModule, RuntimeEngineModule]
})
export class AgentGatewayModule {}
```

Keep the existing controllers and providers in the module; only add the new import.

- [ ] **Step 6: Run the DI test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-contract.spec.ts
```

Expected: PASS.

## Task 3: OpenAI Chat Protocol Adapter

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts`

- [ ] **Step 1: Write failing protocol tests**

Create `apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import {
  normalizeOpenAIChatCompletionRequest,
  projectOpenAIChatCompletionResponse,
  projectOpenAIChatCompletionStreamEvent
} from '../../src/domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol';

describe('OpenAI chat protocol adapter', () => {
  it('normalizes chat messages into runtime invocation content parts', () => {
    const invocation = normalizeOpenAIChatCompletionRequest({
      requestId: 'inv_1',
      clientId: 'client_1',
      apiKeyId: 'key_1',
      scopes: ['chat.completions'],
      body: {
        model: 'gpt-5-codex',
        messages: [{ role: 'user', content: 'ping' }],
        stream: false
      }
    });

    expect(invocation).toMatchObject({
      id: 'inv_1',
      protocol: 'openai.chat.completions',
      model: 'gpt-5-codex',
      stream: false
    });
    expect(invocation.messages[0]?.content).toEqual([{ type: 'text', text: 'ping' }]);
  });

  it('projects runtime results into OpenAI-compatible responses', () => {
    const response = projectOpenAIChatCompletionResponse({
      invocationId: 'inv_1',
      model: 'gpt-5-codex',
      text: 'pong',
      route: {
        invocationId: 'inv_1',
        providerKind: 'codex',
        credentialId: 'cred_1',
        model: 'gpt-5-codex',
        strategy: 'round-robin',
        reason: 'test',
        decidedAt: '2026-05-10T00:00:00.000Z'
      },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
    });

    expect(response.choices[0]?.message.content).toBe('pong');
    expect(response.usage.total_tokens).toBe(2);
  });

  it('projects internal stream delta events into OpenAI SSE JSON payloads', () => {
    const payload = projectOpenAIChatCompletionStreamEvent({
      invocationId: 'inv_1',
      type: 'delta',
      sequence: 0,
      createdAt: '2026-05-10T00:00:00.000Z',
      delta: { text: 'p' }
    });

    expect(payload).toContain('"object":"chat.completion.chunk"');
    expect(payload).toContain('"content":"p"');
  });
});
```

- [ ] **Step 2: Run the failing protocol test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts
```

Expected: FAIL because `openai-chat.protocol.ts` does not exist.

- [ ] **Step 3: Implement protocol adapter**

Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol.ts`:

```ts
import type { GatewayRuntimeInvocation, GatewayRuntimeStreamEvent } from '@agent/core';
import type { RuntimeEngineInvokeResult } from '../types/runtime-engine.types';

interface NormalizeOpenAIChatRequestInput {
  requestId: string;
  clientId: string;
  apiKeyId: string;
  scopes: string[];
  body: {
    model: string;
    messages: Array<{
      role: string;
      content: string | Array<{ type: string; text?: string; image_url?: { url?: string } }>;
    }>;
    stream?: boolean;
  };
}

export function normalizeOpenAIChatCompletionRequest(input: NormalizeOpenAIChatRequestInput): GatewayRuntimeInvocation {
  return {
    id: input.requestId,
    protocol: 'openai.chat.completions',
    model: input.body.model,
    stream: input.body.stream === true,
    requestedAt: new Date().toISOString(),
    client: {
      clientId: input.clientId,
      apiKeyId: input.apiKeyId,
      scopes: input.scopes
    },
    metadata: {},
    messages: input.body.messages.map(message => ({
      role: normalizeRole(message.role),
      content: normalizeContent(message.content)
    }))
  };
}

export function projectOpenAIChatCompletionResponse(result: RuntimeEngineInvokeResult) {
  return {
    id: result.invocationId,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: result.model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: result.text },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: result.usage.inputTokens,
      completion_tokens: result.usage.outputTokens,
      total_tokens: result.usage.totalTokens
    }
  };
}

export function projectOpenAIChatCompletionStreamEvent(event: GatewayRuntimeStreamEvent): string {
  if (event.type === 'done') return '[DONE]';
  if (event.type === 'usage') {
    return JSON.stringify({
      id: event.invocationId,
      object: 'chat.completion.chunk',
      choices: [],
      usage: {
        prompt_tokens: event.usage.inputTokens,
        completion_tokens: event.usage.outputTokens,
        total_tokens: event.usage.totalTokens
      }
    });
  }
  return JSON.stringify({
    id: event.invocationId,
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }]
  });
}

function normalizeRole(role: string): 'system' | 'user' | 'assistant' | 'tool' {
  if (role === 'system' || role === 'assistant' || role === 'tool') return role;
  return 'user';
}

function normalizeContent(
  content: string | Array<{ type: string; text?: string; image_url?: { url?: string } }>
): GatewayRuntimeInvocation['messages'][number]['content'] {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return content.flatMap(part => {
    if (part.type === 'text') return [{ type: 'text' as const, text: part.text ?? '' }];
    if (part.type === 'image_url' && part.image_url?.url) {
      return [{ type: 'imageUrl' as const, imageUrl: part.image_url.url }];
    }
    return [];
  });
}
```

- [ ] **Step 4: Run protocol tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts
```

Expected: PASS.

## Task 4: Route `/v1/chat/completions` Through Runtime Engine

**Files:**

- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-openai-compatible.controller.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.facade.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts`

- [ ] **Step 1: Extend integration test for controller delegation**

Append to `apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts`:

```ts
import { AgentGatewayOpenAICompatibleController } from '../../src/api/agent-gateway/agent-gateway-openai-compatible.controller';
import { RuntimeEngineFacade } from '../../src/domains/agent-gateway/runtime-engine/runtime-engine.facade';

describe('OpenAI-compatible controller runtime engine integration', () => {
  it('returns non-streaming chat completions from runtime engine', async () => {
    const controller = new AgentGatewayOpenAICompatibleController(new RuntimeEngineFacade() as never);

    const response = await controller.chatCompletions(
      { authorization: 'Bearer runtime-key' } as never,
      {
        model: 'gpt-5-codex',
        messages: [{ role: 'user', content: 'ping' }],
        stream: false
      } as never
    );

    expect(response).toMatchObject({
      object: 'chat.completion',
      choices: [{ message: { content: 'pong' } }]
    });
  });
});
```

- [ ] **Step 2: Run the failing integration test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts
```

Expected: FAIL because the controller constructor and method still use the old runtime service shape.

- [ ] **Step 3: Inject `RuntimeEngineFacade` in the controller**

Modify `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-openai-compatible.controller.ts` so the controller depends on `RuntimeEngineFacade` for chat completions:

```ts
import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { RuntimeEngineFacade } from '../../domains/agent-gateway/runtime-engine/runtime-engine.facade';
import {
  normalizeOpenAIChatCompletionRequest,
  projectOpenAIChatCompletionResponse
} from '../../domains/agent-gateway/runtime-engine/protocols/openai-chat.protocol';

@Controller()
export class AgentGatewayOpenAICompatibleController {
  constructor(private readonly runtimeEngine: RuntimeEngineFacade) {}

  @Get('v1/models')
  async models() {
    return {
      object: 'list',
      data: [{ id: 'gpt-5-codex', object: 'model', owned_by: 'agent-gateway' }]
    };
  }

  @Post('v1/chat/completions')
  async chatCompletions(@Headers() headers: Record<string, string>, @Body() body: unknown) {
    const invocation = normalizeOpenAIChatCompletionRequest({
      requestId: `chatcmpl_${Date.now()}`,
      clientId: 'runtime-client',
      apiKeyId: readBearerToken(headers.authorization) ?? 'runtime-key',
      scopes: ['chat.completions'],
      body: body as never
    });
    const result = await this.runtimeEngine.invoke(invocation);
    return projectOpenAIChatCompletionResponse(result);
  }
}

function readBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}
```

Preserve any existing runtime auth behavior from the current controller by moving it behind the facade in a follow-up step rather than deleting tests that cover it.

- [ ] **Step 4: Run affected runtime tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-openai-chat.spec.ts apps/backend/agent-server/test/agent-gateway/agent-gateway-client-runtime.spec.ts
```

Expected: PASS. If existing auth tests fail, adapt the controller to call `AgentGatewayRuntimeAuthService` before building the invocation instead of bypassing auth.

## Task 5: Quota Precheck and Usage Accounting

**Files:**

- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/runtime-quota.service.ts`
- Create: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/runtime-usage-queue.service.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.module.ts`
- Modify: `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.facade.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/runtime-engine-quota.spec.ts`

- [ ] **Step 1: Write failing quota tests**

Create `apps/backend/agent-server/test/agent-gateway/runtime-engine-quota.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { RuntimeQuotaService } from '../../src/domains/agent-gateway/runtime-engine/accounting/runtime-quota.service';
import { RuntimeUsageQueueService } from '../../src/domains/agent-gateway/runtime-engine/accounting/runtime-usage-queue.service';

describe('runtime quota and usage queue', () => {
  it('denies requests when client token quota is exhausted', () => {
    const quota = new RuntimeQuotaService();
    quota.setPolicy({ subjectType: 'client', subjectId: 'client_1', window: 'monthly', maxTokens: 1, action: 'deny' });
    quota.consume({ subjectType: 'client', subjectId: 'client_1', tokens: 1, requests: 1 });

    expect(() =>
      quota.precheck({ subjectType: 'client', subjectId: 'client_1', estimatedTokens: 1, estimatedRequests: 1 })
    ).toThrow('Gateway quota exceeded');
  });

  it('appends and pops usage queue records', () => {
    const queue = new RuntimeUsageQueueService();
    queue.append({
      requestId: 'inv_1',
      timestamp: '2026-05-10T00:00:00.000Z',
      providerKind: 'codex',
      model: 'gpt-5-codex',
      clientId: 'client_1',
      failed: false,
      tokens: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }
    });

    expect(queue.pop(1)).toHaveLength(1);
    expect(queue.pop(1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the failing quota test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-quota.spec.ts
```

Expected: FAIL because accounting services do not exist.

- [ ] **Step 3: Implement quota service**

Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/runtime-quota.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { GatewayRuntimeQuotaPolicy } from '@agent/core';

interface RuntimeQuotaUsageKey {
  subjectType: 'user' | 'client' | 'apiKey';
  subjectId: string;
}

interface RuntimeQuotaConsumeRequest extends RuntimeQuotaUsageKey {
  tokens: number;
  requests: number;
}

interface RuntimeQuotaPrecheckRequest extends RuntimeQuotaUsageKey {
  estimatedTokens: number;
  estimatedRequests: number;
}

@Injectable()
export class RuntimeQuotaService {
  private readonly policies = new Map<string, GatewayRuntimeQuotaPolicy>();
  private readonly usage = new Map<string, { tokens: number; requests: number }>();

  setPolicy(policy: GatewayRuntimeQuotaPolicy): void {
    this.policies.set(keyOf(policy), policy);
  }

  precheck(request: RuntimeQuotaPrecheckRequest): void {
    const key = keyOf(request);
    const policy = this.policies.get(key);
    if (!policy) return;
    const current = this.usage.get(key) ?? { tokens: 0, requests: 0 };
    const nextTokens = current.tokens + request.estimatedTokens;
    const nextRequests = current.requests + request.estimatedRequests;
    if (
      (policy.maxTokens && nextTokens > policy.maxTokens) ||
      (policy.maxRequests && nextRequests > policy.maxRequests)
    ) {
      throw new Error('Gateway quota exceeded');
    }
  }

  consume(request: RuntimeQuotaConsumeRequest): void {
    const key = keyOf(request);
    const current = this.usage.get(key) ?? { tokens: 0, requests: 0 };
    this.usage.set(key, {
      tokens: current.tokens + request.tokens,
      requests: current.requests + request.requests
    });
  }

  refund(request: RuntimeQuotaConsumeRequest): void {
    const key = keyOf(request);
    const current = this.usage.get(key) ?? { tokens: 0, requests: 0 };
    this.usage.set(key, {
      tokens: Math.max(0, current.tokens - request.tokens),
      requests: Math.max(0, current.requests - request.requests)
    });
  }
}

function keyOf(value: RuntimeQuotaUsageKey): string {
  return `${value.subjectType}:${value.subjectId}`;
}
```

- [ ] **Step 4: Implement usage queue service**

Create `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/accounting/runtime-usage-queue.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

export interface RuntimeUsageQueueRecord {
  requestId: string;
  timestamp: string;
  providerKind: string;
  model: string;
  clientId: string;
  failed: boolean;
  tokens: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class RuntimeUsageQueueService {
  private readonly records: RuntimeUsageQueueRecord[] = [];

  append(record: RuntimeUsageQueueRecord): void {
    this.records.push(record);
  }

  pop(count: number): RuntimeUsageQueueRecord[] {
    return this.records.splice(0, Math.max(0, count));
  }

  size(): number {
    return this.records.length;
  }
}
```

- [ ] **Step 5: Register services**

Modify `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/runtime-engine.module.ts`:

```ts
import { RuntimeQuotaService } from './accounting/runtime-quota.service';
import { RuntimeUsageQueueService } from './accounting/runtime-usage-queue.service';

@Module({
  providers: [RuntimeEngineFacade, RuntimeQuotaService, RuntimeUsageQueueService],
  exports: [RuntimeEngineFacade, RuntimeQuotaService, RuntimeUsageQueueService]
})
export class RuntimeEngineModule {}
```

- [ ] **Step 6: Run quota tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/runtime-engine-quota.spec.ts
```

Expected: PASS.

## Task 6: Runtime Health Management API and Frontend Client

**Files:**

- Modify: `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-management.controller.ts`
- Modify: `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`
- Test: `apps/backend/agent-server/test/agent-gateway/agent-gateway-management.controller.spec.ts`

- [ ] **Step 1: Write failing controller test**

Append to `apps/backend/agent-server/test/agent-gateway/agent-gateway-management.controller.spec.ts`:

```ts
it('exposes runtime engine health projection', async () => {
  const controller = createController({
    runtimeEngine: {
      health: async () => ({
        status: 'ready',
        checkedAt: '2026-05-10T00:00:00.000Z',
        executors: []
      })
    }
  });

  await expect(controller.runtimeHealth()).resolves.toMatchObject({ status: 'ready', executors: [] });
});
```

- [ ] **Step 2: Run failing controller test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-management.controller.spec.ts
```

Expected: FAIL because `runtimeHealth` is not defined.

- [ ] **Step 3: Add management route**

Modify `apps/backend/agent-server/src/api/agent-gateway/agent-gateway-management.controller.ts` to inject `RuntimeEngineFacade` and add:

```ts
@Get('runtime/health')
runtimeHealth() {
  return this.runtimeEngine.health();
}
```

If the existing constructor is already long, add `runtimeEngine` as the final optional dependency in tests and wire it explicitly in `AgentGatewayModule`.

- [ ] **Step 4: Add frontend API client method**

Modify `apps/frontend/agent-gateway/src/api/agent-gateway-api.ts`:

```ts
export interface GatewayRuntimeHealthResponse {
  status: 'ready' | 'degraded' | 'error';
  checkedAt: string;
  executors: Array<{
    providerKind: string;
    status: string;
    checkedAt: string;
    activeRequests: number;
    supportsStreaming: boolean;
    message?: string;
  }>;
}

runtimeHealth(): Promise<GatewayRuntimeHealthResponse> {
  return this.get('/agent-gateway/runtime/health', {
    parse: (payload: unknown) => payload as GatewayRuntimeHealthResponse
  });
}
```

- [ ] **Step 5: Run backend management tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway/agent-gateway-management.controller.spec.ts
```

Expected: PASS.

## Task 7: Runtime Console Page

**Files:**

- Create: `apps/frontend/agent-gateway/src/app/pages/RuntimeEnginePage.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/gateway-view-model.ts`
- Modify: `apps/frontend/agent-gateway/src/app/GatewayWorkspacePages.tsx`
- Modify: `apps/frontend/agent-gateway/src/app/App.tsx`
- Test: `apps/frontend/agent-gateway/test/agent-gateway-runtime-engine-page.test.tsx`

- [ ] **Step 1: Write failing page test**

Create `apps/frontend/agent-gateway/test/agent-gateway-runtime-engine-page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RuntimeEnginePage } from '../src/app/pages/RuntimeEnginePage';

describe('RuntimeEnginePage', () => {
  it('renders runtime health and executor status', () => {
    render(
      <RuntimeEnginePage
        health={{
          status: 'ready',
          checkedAt: '2026-05-10T00:00:00.000Z',
          executors: [
            {
              providerKind: 'codex',
              status: 'ready',
              checkedAt: '2026-05-10T00:00:00.000Z',
              activeRequests: 0,
              supportsStreaming: true
            }
          ]
        }}
      />
    );

    expect(screen.getByText('Runtime Engine')).toBeInTheDocument();
    expect(screen.getByText('codex')).toBeInTheDocument();
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run failing page test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-runtime-engine-page.test.tsx
```

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Add runtime page**

Create `apps/frontend/agent-gateway/src/app/pages/RuntimeEnginePage.tsx`:

```tsx
import type { GatewayRuntimeHealthResponse } from '../../api/agent-gateway-api';

interface RuntimeEnginePageProps {
  health: GatewayRuntimeHealthResponse | null;
}

export function RuntimeEnginePage({ health }: RuntimeEnginePageProps) {
  if (!health) return <div className="loading-panel">正在加载 Runtime Engine...</div>;

  return (
    <section className="gateway-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Execution Kernel</p>
          <h1>Runtime Engine</h1>
        </div>
        <span className="status-pill">{health.status}</span>
      </div>

      <div className="gateway-table">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Status</th>
              <th>Streaming</th>
              <th>Active</th>
              <th>Checked</th>
            </tr>
          </thead>
          <tbody>
            {health.executors.map(executor => (
              <tr key={executor.providerKind}>
                <td>{executor.providerKind}</td>
                <td>{executor.status}</td>
                <td>{executor.supportsStreaming ? 'yes' : 'no'}</td>
                <td>{executor.activeRequests}</td>
                <td>{executor.checkedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Add navigation and render wiring**

Modify `apps/frontend/agent-gateway/src/app/gateway-view-model.ts` to add a `runtime` view after Dashboard:

```ts
{ id: 'runtime', label: 'Runtime', path: '/runtime' }
```

Modify `apps/frontend/agent-gateway/src/app/GatewayWorkspacePages.tsx` to render:

```tsx
if (activeView === 'runtime') {
  return <RuntimeEnginePage health={pageData.runtimeHealth} />;
}
```

Modify `GatewayPageData` to include:

```ts
runtimeHealth: GatewayRuntimeHealthResponse | null;
```

Modify `apps/frontend/agent-gateway/src/app/App.tsx` to query:

```ts
const runtimeHealthQuery = useQuery({
  queryKey: ['agent-gateway', 'runtime-health'],
  queryFn: () => api.runtimeHealth(),
  enabled: isAuthenticated
});
```

Pass `runtimeHealth={runtimeHealthQuery.data ?? null}` into `pageData`.

- [ ] **Step 5: Run frontend page tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test/agent-gateway-runtime-engine-page.test.tsx
```

Expected: PASS.

## Task 8: External CLIProxyAPI Mode Cleanup Docs

**Files:**

- Modify: `docs/contracts/api/agent-gateway.md`
- Modify: `docs/apps/backend/agent-server/agent-gateway.md`
- Modify: `docs/apps/frontend/agent-gateway/README.md`
- Test: `pnpm check:docs`

- [ ] **Step 1: Update API contract wording**

In `docs/contracts/api/agent-gateway.md`, replace the current “real CLI Proxy mode” framing with:

```md
## External CLIProxyAPI Import Mode

`CliProxyManagementClient` is migration-only. It may import config, auth files, provider config, API keys, quota snapshots, and request logs from an existing CLIProxyAPI instance. It is not the default Agent Gateway runtime and must not be required for `/v1/*` requests.

The canonical runtime is the embedded `agent-server` runtime engine under `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/`.
```

- [ ] **Step 2: Update backend architecture doc**

In `docs/apps/backend/agent-server/agent-gateway.md`, add:

```md
## Embedded Runtime Engine

Agent Gateway now treats the embedded runtime engine as the canonical CLIProxyAPI implementation. The runtime engine owns protocol normalization, executor routing, child process boundaries, streaming conversion, OAuth/auth-file lifecycle, and usage accounting. Controllers and management services may only call the runtime-engine facade; they must not directly run CLI child processes or depend on an external CLIProxyAPI server.
```

- [ ] **Step 3: Update frontend README**

In `docs/apps/frontend/agent-gateway/README.md`, add Runtime to the workspace view list:

```md
- Runtime：展示 embedded runtime engine health、executor status、active streams、usage queue 和 reload 状态；该页面反映 `agent-server` 内建 CLIProxyAPI runtime，而不是外部 CLIProxyAPI 连接状态。
```

- [ ] **Step 4: Scan stale docs**

Run:

```bash
rg -n "AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy|连接真实 CLI Proxy|external CLIProxyAPI|deterministic relay runtime|mock provider" docs apps/backend/agent-server/src apps/frontend/agent-gateway/src
```

Expected: Any matches outside migration/test/history wording are updated or explicitly marked as legacy/test-only.

- [ ] **Step 5: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Task 9: Verification Sweep

**Files:**

- No new files.
- Verify affected backend, frontend, core, and docs.

- [ ] **Step 1: Run core contract tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-gateway
```

Expected: PASS.

- [ ] **Step 2: Run backend Agent Gateway tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/agent-gateway
```

Expected: PASS.

- [ ] **Step 3: Run frontend Agent Gateway tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-gateway/test
```

Expected: PASS.

- [ ] **Step 4: Run affected typechecks**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-gateway/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 5: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 6: Record blockers if any command fails for unrelated existing worktree changes**

Use this exact delivery note format:

```md
Verification:

- PASS: <command>
- BLOCKED: <command> because <specific unrelated blocker>
- Not run: <command> because <specific reason>
```

## Self-Review

Spec coverage:

- Runtime-engine module and embedded ownership are covered by Tasks 1-4.
- Protocol normalization and OpenAI first slice are covered by Tasks 3-4.
- Quota and usage queue are covered by Task 5.
- Runtime management projection and frontend page are covered by Tasks 6-7.
- Cleanup of external CLIProxyAPI as primary mode is covered by Task 8.
- Verification and docs requirements are covered by Task 9.

Placeholder scan:

- No placeholder markers or “similar to” steps remain.
- Each code-producing step includes concrete code or exact replacement text.

Type consistency:

- Runtime contract names use `GatewayRuntime*`.
- Backend facade names use `RuntimeEngine*`.
- Frontend runtime health type is `GatewayRuntimeHealthResponse`.
