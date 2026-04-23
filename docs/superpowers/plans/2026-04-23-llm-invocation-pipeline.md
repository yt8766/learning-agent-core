# LLM Invocation Pipeline Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/core`、`packages/runtime`、`apps/backend/agent-server`
最后核对：2026-04-23

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified model invocation pipeline for `packages/runtime` that serves both runtime-task and direct-reply flows with shared preprocess/postprocess governance, invocation-level usage accounting, and task-level aggregation.

**Architecture:** Add schema-first invocation contracts in `packages/core`, then implement a runtime-owned `ModelInvocationFacade` and `ModelInvocationPipeline` with fixed pre/post processor sequencing. Migrate `apps/backend/agent-server` direct-reply first, then bridge runtime task usage onto the new postprocess path while keeping compatible task/checkpoint projections.

**Tech Stack:** TypeScript, Zod, Vitest, NestJS, existing `@agent/runtime` / `@agent/core` / `@agent/adapters` packages

---

## File Map

### New files

- `packages/core/src/runtime-invocation/schemas/model-invocation.schema.ts`
  Stable request/decision/result schemas for the pipeline.
- `packages/core/src/runtime-invocation/types/model-invocation.types.ts`
  `z.infer`-based exported types for runtime invocation contracts.
- `packages/core/src/runtime-invocation/index.ts`
  Root exports for the new contract surface.
- `packages/core/test/runtime-invocation/model-invocation.schema.test.ts`
  Contract parse regression for request/decision/result payloads.
- `packages/runtime/src/runtime/model-invocation/model-invocation-facade.ts`
  Public runtime entrypoint used by direct-reply and runtime-task callers.
- `packages/runtime/src/runtime/model-invocation/model-invocation-pipeline.ts`
  Fixed `preprocess -> execute -> postprocess` orchestration.
- `packages/runtime/src/runtime/model-invocation/model-invocation.types.ts`
  Runtime-local aggregate types and dependency contracts.
- `packages/runtime/src/runtime/model-invocation/profiles/direct-reply-profile.ts`
  Lightweight policy profile for direct-reply.
- `packages/runtime/src/runtime/model-invocation/profiles/runtime-task-profile.ts`
  Full policy profile for runtime-task.
- `packages/runtime/src/runtime/model-invocation/preprocessors/input-normalize-preprocessor.ts`
  Normalize request payloads and message shape.
- `packages/runtime/src/runtime/model-invocation/preprocessors/budget-estimate-preprocessor.ts`
  Estimate tokens and choose/deny model execution based on budget.
- `packages/runtime/src/runtime/model-invocation/preprocessors/context-assemble-preprocessor.ts`
  Merge recent turns, summary, memory/evidence hints into resolved messages.
- `packages/runtime/src/runtime/model-invocation/preprocessors/capability-injection-preprocessor.ts`
  Conservative skill/tool/MCP selection planning.
- `packages/runtime/src/runtime/model-invocation/postprocessors/usage-billing-postprocessor.ts`
  Invocation ledger + task delta calculation.
- `packages/runtime/src/runtime/model-invocation/postprocessors/output-finalize-postprocessor.ts`
  Finalize text/object output and delivery metadata.
- `packages/runtime/src/runtime/model-invocation/postprocessors/trace-audit-postprocessor.ts`
  Trace/audit event emission.
- `packages/runtime/test/model-invocation/model-invocation-facade.test.ts`
  Unit tests for facade orchestration and profile selection.
- `packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts`
  Unit tests for invocation-level usage and task-level aggregation.
- `packages/runtime/test/model-invocation/capability-injection-preprocessor.test.ts`
  Unit tests for conservative injection rules.

### Existing files to modify

- `packages/core/src/index.ts`
  Export the new invocation contract entrypoint.
- `packages/runtime/src/runtime/index.ts`
  Export `ModelInvocationFacade` and related runtime API.
- `packages/runtime/src/index.ts`
  Re-export the runtime invocation facade from the package root.
- `packages/runtime/src/graphs/main/tasking/context/main-graph-task-context.ts`
  Route runtime task usage writes through the new facade/postprocess bridge instead of directly trusting scattered `onUsage` accumulation.
- `packages/runtime/src/graphs/main/tasking/context/main-graph-task-context-usage.ts`
  Reuse invocation usage deltas or compatibility adapters from postprocess results.
- `apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts`
  Replace direct `llm.streamText(...)` calls with `ModelInvocationFacade`.
- `apps/backend/agent-server/src/runtime/core/runtime.host.ts`
  Construct and expose a runtime invocation facade for application callers.
- `apps/backend/agent-server/test/chat/chat.service.test-helpers.ts`
  Add a mock invocation facade and stop asserting direct provider calls.
- `apps/backend/agent-server/test/chat/chat.service.test-helpers.ts`
  Add response fixtures for `ModelInvocationResult`.
- `apps/backend/agent-server/test/chat/chat.service.test.ts`
  Verify direct-reply now flows through the facade and produces compatible SSE output.
- `docs/runtime/README.md`
  Document the new runtime-owned invocation pipeline and entrypoint.
- `docs/integration/README.md`
  Link direct-reply and runtime-task to the shared invocation lifecycle.

### Existing tests to extend

- `apps/backend/agent-server/test/chat/chat.service.report-schema-llm.spec.ts`
  Ensure report-schema path still bypasses the new direct text pipeline where intended.
- `packages/runtime/test/affected-workspace.test.ts`
  Keep root exports and workspace smoke expectations aligned.

## Task 1: Add Schema-First Invocation Contracts In `packages/core`

**Files:**

- Create: `packages/core/src/runtime-invocation/schemas/model-invocation.schema.ts`
- Create: `packages/core/src/runtime-invocation/types/model-invocation.types.ts`
- Create: `packages/core/src/runtime-invocation/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/runtime-invocation/model-invocation.schema.test.ts`

- [ ] **Step 1: Write the failing contract parse test**

```ts
import { describe, expect, it } from 'vitest';
import {
  ModelInvocationRequestSchema,
  PreprocessDecisionSchema,
  ModelInvocationResultSchema
} from '../../src/runtime-invocation';

describe('model invocation schemas', () => {
  it('parses request, preprocess decision, and result payloads', () => {
    const request = ModelInvocationRequestSchema.parse({
      invocationId: 'inv_001',
      modeProfile: 'direct-reply',
      stage: 'direct_reply',
      messages: [{ role: 'user', content: 'hello runtime' }],
      contextHints: {},
      capabilityHints: {},
      budgetSnapshot: { costConsumedUsd: 0, costBudgetUsd: 2 },
      traceContext: { source: 'chat-direct-reply' }
    });

    const decision = PreprocessDecisionSchema.parse({
      allowExecution: true,
      resolvedModelId: 'openai/gpt-4.1-mini',
      resolvedMessages: request.messages,
      budgetDecision: { status: 'allow', estimatedInputTokens: 12 },
      capabilityInjectionPlan: {
        selectedSkills: [],
        selectedTools: [],
        selectedMcpCapabilities: [],
        rejectedCandidates: [],
        reasons: [],
        riskFlags: []
      },
      cacheDecision: { status: 'miss' },
      traceMeta: { profile: 'direct-reply' }
    });

    const result = ModelInvocationResultSchema.parse({
      finalOutput: { kind: 'text', text: 'hello runtime' },
      invocationRecordId: 'ledger_001',
      traceSummary: { profile: 'direct-reply', stage: 'direct_reply' },
      deliveryMeta: { deliveredBy: 'direct-reply' }
    });

    expect(request.stage).toBe('direct_reply');
    expect(decision.budgetDecision.status).toBe('allow');
    expect(result.finalOutput.text).toBe('hello runtime');
  });
});
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `pnpm exec vitest run packages/core/test/runtime-invocation/model-invocation.schema.test.ts`

Expected: FAIL with `Cannot find module '../../src/runtime-invocation'` or missing schema export errors.

- [ ] **Step 3: Add the new core schemas and exports**

```ts
// packages/core/src/runtime-invocation/schemas/model-invocation.schema.ts
import { z } from 'zod/v4';

const InvocationMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1)
});

export const CapabilityInjectionPlanSchema = z.object({
  selectedSkills: z.array(z.string()).default([]),
  selectedTools: z.array(z.string()).default([]),
  selectedMcpCapabilities: z.array(z.string()).default([]),
  rejectedCandidates: z.array(z.string()).default([]),
  reasons: z.array(z.string()).default([]),
  riskFlags: z.array(z.string()).default([])
});

export const ModelInvocationRequestSchema = z.object({
  invocationId: z.string().min(1),
  taskId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  modeProfile: z.enum(['direct-reply', 'runtime-task']),
  stage: z.string().min(1),
  messages: z.array(InvocationMessageSchema).min(1),
  requestedModelId: z.string().min(1).optional(),
  contextHints: z.record(z.string(), z.unknown()).default({}),
  capabilityHints: z.record(z.string(), z.unknown()).default({}),
  budgetSnapshot: z.object({
    costConsumedUsd: z.number().nonnegative().optional(),
    costBudgetUsd: z.number().nonnegative().optional(),
    tokenConsumed: z.number().int().nonnegative().optional(),
    tokenBudget: z.number().int().nonnegative().optional(),
    fallbackModelId: z.string().min(1).optional()
  }),
  traceContext: z.record(z.string(), z.unknown()).default({})
});

export const PreprocessDecisionSchema = z.object({
  allowExecution: z.boolean(),
  denyReason: z.string().min(1).optional(),
  resolvedModelId: z.string().min(1),
  resolvedMessages: z.array(InvocationMessageSchema),
  budgetDecision: z.object({
    status: z.enum(['allow', 'fallback', 'deny']),
    estimatedInputTokens: z.number().int().nonnegative(),
    fallbackModelId: z.string().min(1).optional()
  }),
  capabilityInjectionPlan: CapabilityInjectionPlanSchema,
  cacheDecision: z.object({
    status: z.enum(['hit', 'miss', 'bypass']),
    cacheKey: z.string().min(1).optional(),
    cachedText: z.string().optional()
  }),
  traceMeta: z.record(z.string(), z.unknown()).default({})
});

export const ModelInvocationResultSchema = z.object({
  finalOutput: z.object({
    kind: z.enum(['text', 'object']),
    text: z.string().optional(),
    object: z.record(z.string(), z.unknown()).optional()
  }),
  invocationRecordId: z.string().min(1),
  taskUsageSnapshot: z.record(z.string(), z.unknown()).optional(),
  traceSummary: z.record(z.string(), z.unknown()).default({}),
  deliveryMeta: z.record(z.string(), z.unknown()).default({})
});
```

```ts
// packages/core/src/runtime-invocation/index.ts
export {
  CapabilityInjectionPlanSchema,
  ModelInvocationRequestSchema,
  PreprocessDecisionSchema,
  ModelInvocationResultSchema
} from './schemas/model-invocation.schema';
export type {
  CapabilityInjectionPlan,
  ModelInvocationRequest,
  PreprocessDecision,
  ModelInvocationResult
} from './types/model-invocation.types';
```

```ts
// packages/core/src/index.ts
export * from './runtime-invocation';
```

- [ ] **Step 4: Run the contract test to verify it passes**

Run: `pnpm exec vitest run packages/core/test/runtime-invocation/model-invocation.schema.test.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/core/src/runtime-invocation packages/core/test/runtime-invocation/model-invocation.schema.test.ts
git commit -m "feat(core): add model invocation contracts"
```

## Task 2: Build The Runtime Invocation Facade And Fixed Pipeline

**Files:**

- Create: `packages/runtime/src/runtime/model-invocation/model-invocation.types.ts`
- Create: `packages/runtime/src/runtime/model-invocation/model-invocation-pipeline.ts`
- Create: `packages/runtime/src/runtime/model-invocation/model-invocation-facade.ts`
- Create: `packages/runtime/src/runtime/model-invocation/profiles/direct-reply-profile.ts`
- Create: `packages/runtime/src/runtime/model-invocation/profiles/runtime-task-profile.ts`
- Create: `packages/runtime/src/runtime/model-invocation/preprocessors/input-normalize-preprocessor.ts`
- Create: `packages/runtime/src/runtime/model-invocation/preprocessors/budget-estimate-preprocessor.ts`
- Create: `packages/runtime/src/runtime/model-invocation/preprocessors/context-assemble-preprocessor.ts`
- Modify: `packages/runtime/src/runtime/index.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/model-invocation/model-invocation-facade.test.ts`

- [ ] **Step 1: Write the failing facade orchestration test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { ModelInvocationFacade } from '../../src/runtime/model-invocation/model-invocation-facade';

describe('ModelInvocationFacade', () => {
  it('runs preprocessors before execution and returns finalized output', async () => {
    const provider = {
      generateText: vi.fn(async () => 'hello from provider')
    };

    const facade = new ModelInvocationFacade({
      provider,
      preprocessors: [
        {
          name: 'normalize',
          run: vi.fn(async request => ({
            request,
            decisionPatch: {
              allowExecution: true,
              resolvedModelId: 'openai/gpt-4.1-mini',
              resolvedMessages: request.messages
            }
          }))
        }
      ],
      postprocessors: [
        {
          name: 'finalize',
          run: vi.fn(async ({ providerResult }) => ({
            finalOutput: { kind: 'text', text: providerResult.outputText },
            deliveryMeta: { deliveredBy: 'direct-reply' }
          }))
        }
      ]
    });

    const result = await facade.invoke({
      invocationId: 'inv_001',
      modeProfile: 'direct-reply',
      stage: 'direct_reply',
      messages: [{ role: 'user', content: 'hello' }],
      contextHints: {},
      capabilityHints: {},
      budgetSnapshot: {},
      traceContext: {}
    });

    expect(provider.generateText).toHaveBeenCalledOnce();
    expect(result.finalOutput.text).toBe('hello from provider');
    expect(result.deliveryMeta.deliveredBy).toBe('direct-reply');
  });
});
```

- [ ] **Step 2: Run the runtime facade test to verify it fails**

Run: `pnpm exec vitest run packages/runtime/test/model-invocation/model-invocation-facade.test.ts`

Expected: FAIL with missing `ModelInvocationFacade` module.

- [ ] **Step 3: Implement the facade, pipeline, and profile skeleton**

```ts
// packages/runtime/src/runtime/model-invocation/model-invocation-facade.ts
import type { ModelInvocationRequest, ModelInvocationResult } from '@agent/core';
import { ModelInvocationPipeline } from './model-invocation-pipeline';
import type { ModelInvocationPipelineDeps } from './model-invocation.types';

export class ModelInvocationFacade {
  private readonly pipeline: ModelInvocationPipeline;

  constructor(private readonly deps: ModelInvocationPipelineDeps) {
    this.pipeline = new ModelInvocationPipeline(deps);
  }

  async invoke(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
    return this.pipeline.run(request);
  }
}
```

```ts
// packages/runtime/src/runtime/model-invocation/model-invocation-pipeline.ts
export class ModelInvocationPipeline {
  constructor(private readonly deps: ModelInvocationPipelineDeps) {}

  async run(request: ModelInvocationRequest): Promise<ModelInvocationResult> {
    const decision = await this.runPreprocessors(request);
    if (!decision.allowExecution) {
      throw new Error(decision.denyReason ?? 'model_invocation_denied');
    }

    const outputText = await this.deps.provider.generateText(decision.resolvedMessages, {
      role: request.modeProfile === 'direct-reply' ? 'manager' : 'research',
      modelId: decision.resolvedModelId
    });

    return this.runPostprocessors(request, decision, {
      outputText,
      usage: undefined,
      vendorMetadata: {},
      finishReason: 'stop',
      retryMeta: { attempts: 1 },
      fallbackMeta: {}
    });
  }
}
```

```ts
// packages/runtime/src/runtime/index.ts
export { ModelInvocationFacade } from './model-invocation/model-invocation-facade';
```

```ts
// packages/runtime/src/index.ts
export * from './runtime';
```

- [ ] **Step 4: Run the facade orchestration test to verify it passes**

Run: `pnpm exec vitest run packages/runtime/test/model-invocation/model-invocation-facade.test.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/runtime/index.ts packages/runtime/src/index.ts packages/runtime/src/runtime/model-invocation packages/runtime/test/model-invocation/model-invocation-facade.test.ts
git commit -m "feat(runtime): add model invocation facade"
```

## Task 3: Add Usage Billing Postprocess And Invocation Ledger Output

**Files:**

- Create: `packages/runtime/src/runtime/model-invocation/postprocessors/usage-billing-postprocessor.ts`
- Create: `packages/runtime/src/runtime/model-invocation/postprocessors/trace-audit-postprocessor.ts`
- Create: `packages/runtime/src/runtime/model-invocation/postprocessors/output-finalize-postprocessor.ts`
- Modify: `packages/runtime/src/runtime/model-invocation/model-invocation.types.ts`
- Test: `packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts`

- [ ] **Step 1: Write the failing usage postprocessor test**

```ts
import { describe, expect, it } from 'vitest';
import { UsageBillingPostprocessor } from '../../src/runtime/model-invocation/postprocessors/usage-billing-postprocessor';

describe('UsageBillingPostprocessor', () => {
  it('builds invocation ledger records and task usage deltas', async () => {
    const postprocessor = new UsageBillingPostprocessor();

    const result = await postprocessor.run({
      request: {
        invocationId: 'inv_001',
        taskId: 'task_001',
        sessionId: 'session_001',
        modeProfile: 'runtime-task',
        stage: 'plan',
        messages: [{ role: 'user', content: 'plan it' }],
        contextHints: {},
        capabilityHints: {},
        budgetSnapshot: { costConsumedUsd: 0, costBudgetUsd: 3 },
        traceContext: {}
      },
      decision: {
        allowExecution: true,
        resolvedModelId: 'openai/gpt-4.1-mini',
        resolvedMessages: [{ role: 'user', content: 'plan it' }],
        budgetDecision: { status: 'allow', estimatedInputTokens: 16 },
        capabilityInjectionPlan: {
          selectedSkills: ['planning'],
          selectedTools: [],
          selectedMcpCapabilities: [],
          rejectedCandidates: [],
          reasons: ['workflow preset requires planning context'],
          riskFlags: []
        },
        cacheDecision: { status: 'miss' },
        traceMeta: { profile: 'runtime-task' }
      },
      providerResult: {
        outputText: 'plan ready',
        usage: { promptTokens: 16, completionTokens: 20, totalTokens: 36, costUsd: 0.01, costCny: 0.07 },
        vendorMetadata: {},
        finishReason: 'stop',
        retryMeta: { attempts: 1 },
        fallbackMeta: {}
      }
    });

    expect(result.invocationUsageRecord.totalTokens).toBe(36);
    expect(result.invocationUsageRecord.selectedSkills).toEqual(['planning']);
    expect(result.taskUsageDelta.costConsumedUsd).toBe(0.01);
  });
});
```

- [ ] **Step 2: Run the usage postprocessor test to verify it fails**

Run: `pnpm exec vitest run packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts`

Expected: FAIL with missing `UsageBillingPostprocessor`.

- [ ] **Step 3: Implement the billing and finalize postprocessors**

```ts
// packages/runtime/src/runtime/model-invocation/postprocessors/usage-billing-postprocessor.ts
export class UsageBillingPostprocessor {
  async run({ request, decision, providerResult }: UsageBillingInput): Promise<UsageBillingOutput> {
    const usage = providerResult.usage ?? {
      promptTokens: decision.budgetDecision.estimatedInputTokens,
      completionTokens: 0,
      totalTokens: decision.budgetDecision.estimatedInputTokens,
      estimated: true,
      costUsd: 0,
      costCny: 0
    };

    return {
      invocationUsageRecord: {
        invocationId: request.invocationId,
        taskId: request.taskId,
        sessionId: request.sessionId,
        modeProfile: request.modeProfile,
        stage: request.stage,
        providerId: providerResult.vendorMetadata.providerId ?? 'router',
        modelId: decision.resolvedModelId,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        costUsd: usage.costUsd ?? 0,
        costCny: usage.costCny ?? 0,
        selectedSkills: decision.capabilityInjectionPlan.selectedSkills,
        selectedTools: decision.capabilityInjectionPlan.selectedTools,
        selectedMcpCapabilities: decision.capabilityInjectionPlan.selectedMcpCapabilities,
        cacheHit: decision.cacheDecision.status === 'hit',
        fallback: decision.budgetDecision.status === 'fallback',
        retry: (providerResult.retryMeta?.attempts ?? 1) > 1
      },
      taskUsageDelta: {
        tokenConsumed: usage.totalTokens,
        costConsumedUsd: usage.costUsd ?? 0,
        costConsumedCny: usage.costCny ?? 0
      }
    };
  }
}
```

```ts
// packages/runtime/src/runtime/model-invocation/postprocessors/output-finalize-postprocessor.ts
export class OutputFinalizePostprocessor {
  async run({ providerResult }: OutputFinalizeInput) {
    return {
      finalOutput: { kind: 'text' as const, text: providerResult.outputText },
      deliveryMeta: { finishReason: providerResult.finishReason }
    };
  }
}
```

- [ ] **Step 4: Run the usage postprocessor test to verify it passes**

Run: `pnpm exec vitest run packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts`

Expected: PASS with `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/runtime/model-invocation/postprocessors packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts
git commit -m "feat(runtime): add invocation usage billing postprocessor"
```

## Task 4: Migrate Direct-Reply To `ModelInvocationFacade`

**Files:**

- Modify: `apps/backend/agent-server/src/runtime/core/runtime.host.ts`
- Modify: `apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts`
- Modify: `apps/backend/agent-server/test/chat/chat.service.test-helpers.ts`
- Modify: `apps/backend/agent-server/test/chat/chat.service.test.ts`
- Test: `apps/backend/agent-server/test/chat/chat.service.test.ts`

- [ ] **Step 1: Write the failing direct-reply facade test**

```ts
import { describe, expect, it } from 'vitest';
import { createRuntimeHost } from './chat.service.test-helpers';
import { streamChat } from '../../src/chat/chat-direct-response.helpers';

describe('streamChat', () => {
  it('uses the runtime invocation facade instead of calling llm.streamText directly', async () => {
    const runtimeHost = createRuntimeHost();
    const events: unknown[] = [];

    const result = await streamChat(
      runtimeHost,
      { message: '你好', messages: [{ role: 'user', content: '你好' }] },
      event => events.push(event)
    );

    expect(runtimeHost.modelInvocationFacade.invoke).toHaveBeenCalledOnce();
    expect(result.content).toBe('你好');
    expect(events).toContainEqual({ type: 'token', data: { content: '你' } });
  });
});
```

- [ ] **Step 2: Run the direct-reply test to verify it fails**

Run: `pnpm exec vitest run apps/backend/agent-server/test/chat/chat.service.test.ts`

Expected: FAIL because `modelInvocationFacade` does not exist on `RuntimeHost`.

- [ ] **Step 3: Expose the facade on `RuntimeHost` and route `streamChat()` through it**

```ts
// apps/backend/agent-server/src/runtime/core/runtime.host.ts
import { ModelInvocationFacade } from '@agent/runtime';

export class RuntimeHost {
  readonly modelInvocationFacade = new ModelInvocationFacade({
    provider: this.runtime.llmProvider,
    preprocessors: buildDefaultInvocationPreprocessors(this.runtime),
    postprocessors: buildDefaultInvocationPostprocessors(this.runtime)
  });
}
```

```ts
// apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts
export async function streamChat(
  runtimeHost: RuntimeHost,
  dto: DirectChatRequestDto,
  onEvent: (event: DirectChatSseEvent) => void
) {
  const messages = normalizeDirectMessages(dto);
  const result = await runtimeHost.modelInvocationFacade.invoke({
    invocationId: `direct_${Date.now()}`,
    modeProfile: 'direct-reply',
    stage: 'direct_reply',
    messages,
    requestedModelId: dto.modelId,
    contextHints: { systemPrompt: dto.systemPrompt },
    capabilityHints: { responseFormat: dto.responseFormat ?? 'stream' },
    budgetSnapshot: { costConsumedUsd: 0, costBudgetUsd: 0 },
    traceContext: { source: 'chat-direct-reply' }
  });

  for (const token of result.finalOutput.text ?? '') {
    onEvent({ type: 'token', data: { content: token } });
  }

  return { content: result.finalOutput.text ?? '' };
}
```

- [ ] **Step 4: Run the direct-reply test to verify it passes**

Run: `pnpm exec vitest run apps/backend/agent-server/test/chat/chat.service.test.ts`

Expected: PASS with direct-reply tests green and no direct provider invocation assertions left.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/agent-server/src/runtime/core/runtime.host.ts apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts apps/backend/agent-server/test/chat/chat.service.test-helpers.ts apps/backend/agent-server/test/chat/chat.service.test.ts
git commit -m "feat(agent-server): route direct reply through model invocation facade"
```

## Task 5: Bridge Runtime Task Usage And Preserve Compatibility Projections

**Files:**

- Modify: `packages/runtime/src/graphs/main/tasking/context/main-graph-task-context.ts`
- Modify: `packages/runtime/src/graphs/main/tasking/context/main-graph-task-context-usage.ts`
- Test: `packages/runtime/test/model-invocation/model-invocation-facade.test.ts`
- Test: `packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts`

- [ ] **Step 1: Write the failing runtime task aggregation test**

```ts
import { describe, expect, it } from 'vitest';
import { recordTaskUsage } from '../../src/graphs/main/tasking/context/main-graph-task-context-usage';

describe('runtime task usage compatibility bridge', () => {
  it('applies invocation task usage deltas to llmUsage and budgetState', () => {
    const task = createTaskRecord();

    recordTaskUsage(depsWithTask(task), 'task_001', {
      promptTokens: 10,
      completionTokens: 15,
      totalTokens: 25,
      model: 'openai/gpt-4.1-mini',
      costUsd: 0.02,
      costCny: 0.14
    });

    expect(task.llmUsage?.totalTokens).toBe(25);
    expect(task.budgetState?.costConsumedUsd).toBe(0.02);
  });
});
```

- [ ] **Step 2: Run the runtime compatibility test to verify it fails**

Run: `pnpm exec vitest run packages/runtime/test/model-invocation/model-invocation-facade.test.ts packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts`

Expected: FAIL after introducing the facade because runtime task context is not yet consuming postprocess usage output.

- [ ] **Step 3: Update task context to ingest postprocess usage deltas**

```ts
// packages/runtime/src/graphs/main/tasking/context/main-graph-task-context.ts
onUsage: payload => {
  this.recordTaskUsage(taskId, {
    ...payload.usage,
    costUsd: payload.usage.costUsd,
    costCny: payload.usage.costCny
  });
},
onInvocationUsage: payload => {
  this.recordTaskUsage(taskId, {
    promptTokens: payload.invocationUsageRecord.promptTokens,
    completionTokens: payload.invocationUsageRecord.completionTokens,
    totalTokens: payload.invocationUsageRecord.totalTokens,
    model: payload.invocationUsageRecord.modelId,
    costUsd: payload.invocationUsageRecord.costUsd,
    costCny: payload.invocationUsageRecord.costCny
  });
}
```

```ts
// packages/runtime/src/graphs/main/tasking/context/main-graph-task-context-usage.ts
const costUsd = usage.costUsd ?? estimateModelCostUsd(model, usage.totalTokens);
const costCny = usage.costCny ?? costUsd * 7.2;
```

- [ ] **Step 4: Run the runtime compatibility tests to verify they pass**

Run: `pnpm exec vitest run packages/runtime/test/model-invocation/model-invocation-facade.test.ts packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts`

Expected: PASS and existing task-level `llmUsage` / `budgetState` projections remain green.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/graphs/main/tasking/context/main-graph-task-context.ts packages/runtime/src/graphs/main/tasking/context/main-graph-task-context-usage.ts packages/runtime/test/model-invocation/model-invocation-facade.test.ts packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts
git commit -m "refactor(runtime): bridge task usage through invocation results"
```

## Task 6: Add Conservative Capability Injection And Cache Lookup

**Files:**

- Create: `packages/runtime/src/runtime/model-invocation/preprocessors/capability-injection-preprocessor.ts`
- Create: `packages/runtime/test/model-invocation/capability-injection-preprocessor.test.ts`
- Modify: `packages/runtime/src/runtime/model-invocation/preprocessors/budget-estimate-preprocessor.ts`
- Modify: `packages/runtime/src/runtime/model-invocation/model-invocation-pipeline.ts`
- Modify: `docs/runtime/README.md`
- Modify: `docs/integration/README.md`
- Test: `packages/runtime/test/model-invocation/capability-injection-preprocessor.test.ts`
- Test: `pnpm check:docs`

- [ ] **Step 1: Write the failing capability injection policy test**

```ts
import { describe, expect, it } from 'vitest';
import { CapabilityInjectionPreprocessor } from '../../src/runtime/model-invocation/preprocessors/capability-injection-preprocessor';

describe('CapabilityInjectionPreprocessor', () => {
  it('keeps direct-reply on lightweight capability injection and rejects MCP by default', async () => {
    const preprocessor = new CapabilityInjectionPreprocessor();

    const result = await preprocessor.run({
      request: {
        invocationId: 'inv_001',
        modeProfile: 'direct-reply',
        stage: 'direct_reply',
        messages: [{ role: 'user', content: '帮我总结这个想法' }],
        contextHints: {},
        capabilityHints: { requestedTools: ['shell'], requestedMcpCapabilities: ['webSearchPrime'] },
        budgetSnapshot: {},
        traceContext: {}
      },
      decision: {
        allowExecution: true,
        resolvedModelId: 'openai/gpt-4.1-mini',
        resolvedMessages: [{ role: 'user', content: '帮我总结这个想法' }],
        budgetDecision: { status: 'allow', estimatedInputTokens: 20 },
        capabilityInjectionPlan: {
          selectedSkills: [],
          selectedTools: [],
          selectedMcpCapabilities: [],
          rejectedCandidates: [],
          reasons: [],
          riskFlags: []
        },
        cacheDecision: { status: 'miss' },
        traceMeta: {}
      }
    });

    expect(result.decisionPatch.capabilityInjectionPlan.selectedTools).toEqual([]);
    expect(result.decisionPatch.capabilityInjectionPlan.selectedMcpCapabilities).toEqual([]);
    expect(result.decisionPatch.capabilityInjectionPlan.rejectedCandidates).toContain('webSearchPrime');
  });
});
```

- [ ] **Step 2: Run the capability test to verify it fails**

Run: `pnpm exec vitest run packages/runtime/test/model-invocation/capability-injection-preprocessor.test.ts`

Expected: FAIL with missing preprocessor implementation.

- [ ] **Step 3: Implement conservative injection and pipeline cache short-circuit**

```ts
// packages/runtime/src/runtime/model-invocation/preprocessors/capability-injection-preprocessor.ts
export class CapabilityInjectionPreprocessor {
  async run({ request, decision }: CapabilityInjectionInput) {
    const selectedSkills = Array.isArray(request.capabilityHints.requestedSkills)
      ? request.capabilityHints.requestedSkills.filter(Boolean)
      : [];

    const rejectedCandidates: string[] = [];
    const selectedTools: string[] = [];
    const selectedMcpCapabilities: string[] = [];

    if (request.modeProfile === 'direct-reply') {
      for (const capability of request.capabilityHints.requestedMcpCapabilities ?? []) {
        rejectedCandidates.push(String(capability));
      }
    } else {
      selectedMcpCapabilities.push(
        ...((request.capabilityHints.requestedMcpCapabilities as string[] | undefined) ?? [])
      );
      selectedTools.push(...((request.capabilityHints.requestedTools as string[] | undefined) ?? []));
    }

    return {
      decisionPatch: {
        capabilityInjectionPlan: {
          selectedSkills,
          selectedTools,
          selectedMcpCapabilities,
          rejectedCandidates,
          reasons: request.modeProfile === 'direct-reply' ? ['direct-reply blocks MCP by default'] : [],
          riskFlags: selectedMcpCapabilities.length ? ['external-capability'] : []
        }
      }
    };
  }
}
```

```ts
// packages/runtime/src/runtime/model-invocation/model-invocation-pipeline.ts
if (decision.cacheDecision.status === 'hit' && decision.cacheDecision.cachedText) {
  return {
    finalOutput: { kind: 'text', text: decision.cacheDecision.cachedText },
    invocationRecordId: `ledger_${request.invocationId}`,
    traceSummary: { cacheStatus: 'hit', stage: request.stage },
    deliveryMeta: { deliveredBy: 'cache' }
  };
}
```

- [ ] **Step 4: Run capability tests and doc checks**

Run: `pnpm exec vitest run packages/runtime/test/model-invocation/capability-injection-preprocessor.test.ts`

Expected: PASS with `1 passed`.

Run: `pnpm check:docs`

Expected: PASS with docs validation green.

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/src/runtime/model-invocation/preprocessors/capability-injection-preprocessor.ts packages/runtime/src/runtime/model-invocation/model-invocation-pipeline.ts packages/runtime/test/model-invocation/capability-injection-preprocessor.test.ts docs/runtime/README.md docs/integration/README.md
git commit -m "feat(runtime): add conservative capability injection policy"
```

## Task 7: Final Verification And Delivery Notes

**Files:**

- Modify: `docs/runtime/README.md`
- Modify: `docs/integration/README.md`

- [ ] **Step 1: Run focused typechecks**

Run: `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`

Expected: PASS with no TypeScript errors in `packages/runtime`.

Run: `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`

Expected: PASS with no TypeScript errors in `apps/backend/agent-server`.

- [ ] **Step 2: Run focused tests**

Run: `pnpm exec vitest run packages/core/test/runtime-invocation/model-invocation.schema.test.ts packages/runtime/test/model-invocation/model-invocation-facade.test.ts packages/runtime/test/model-invocation/usage-billing-postprocessor.test.ts packages/runtime/test/model-invocation/capability-injection-preprocessor.test.ts apps/backend/agent-server/test/chat/chat.service.test.ts`

Expected: PASS with all new invocation tests green.

- [ ] **Step 3: Run repository verification for changed scope**

Run: `pnpm verify:affected`

Expected: PASS. If blocked by unrelated pre-existing failures, record the exact failing job and keep the focused type/spec/unit/demo/integration evidence from previous steps.

- [ ] **Step 4: Update delivery docs**

```md
## Runtime Invocation Pipeline

- `packages/runtime` now owns `ModelInvocationFacade`
- `apps/backend/agent-server` direct-reply uses the same invocation lifecycle as runtime-task
- invocation-level usage is the source of truth; task-level usage is a projection
- direct-reply keeps lightweight capability policy and escalates complex capability use to runtime-task
```

- [ ] **Step 5: Commit**

```bash
git add docs/runtime/README.md docs/integration/README.md
git commit -m "docs: document runtime invocation pipeline"
```

## Self-Review

### Spec coverage

- Unified `packages/runtime` interface and orchestration: covered by Tasks 2, 4, and 5.
- `packages/core` schema-first contracts: covered by Task 1.
- Direct-reply migration onto the shared pipeline: covered by Task 4.
- Invocation-level billing plus task-level aggregation: covered by Tasks 3 and 5.
- Conservative skill/tool/MCP injection plus cache short-circuit: covered by Task 6.
- Runtime/docs compatibility and verification: covered by Task 7.

### Placeholder scan

- No `TODO`/`TBD` placeholders remain in tasks.
- Every task has explicit file paths, test commands, and commit boundaries.
- Code-changing steps include concrete snippets rather than abstract instructions.

### Type consistency

- Contract names stay consistent across tasks: `ModelInvocationRequest`, `PreprocessDecision`, `ModelInvocationResult`, `ModelInvocationFacade`, `CapabilityInjectionPreprocessor`.
- Usage naming is consistent across runtime and billing tasks: `invocationUsageRecord`, `taskUsageDelta`, `costConsumedUsd`, `costConsumedCny`.
- Profile naming stays fixed as `direct-reply` and `runtime-task`.
