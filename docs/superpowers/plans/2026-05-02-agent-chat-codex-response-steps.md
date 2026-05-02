# Agent Chat Codex Response Steps Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/core`、`apps/backend/agent-server`、`apps/frontend/agent-chat`、`docs/contracts/api`、`docs/apps/frontend/agent-chat`、`docs/apps/backend/agent-server`
最后核对：2026-05-02

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `agent-chat` assistant replies show Codex-style fast response steps while running, then fold into a completed response with expandable step details, backed by a stable schema-first contract and backend SSE projection.

**Architecture:** Keep the raw chat SSE stream compatible by continuing to send `ChatEventRecord` frames without custom `event:` fields. Add a `chat_response_step` payload projection in `packages/core`, emit it from `agent-server` as `node_progress` and execution/session events, and let `agent-chat` maintain a per-message response step projection for quick and completed rendering.

**Tech Stack:** TypeScript, Zod contracts in `@agent/core`, NestJS backend SSE, React, Vitest, Sass modules through `apps/frontend/agent-chat/src/styles/chat-home-page.scss`, pnpm workspace commands.

---

## Current Baseline

- `docs/contracts/api/agent-chat.md` defines `/api/chat/stream` as comment keep-alive plus `data: <ChatEventRecord JSON>\n\n`, with no custom `event:` field.
- Task trajectory already uses a compatibility projection: `node_progress` with `payload.projection = "task_trajectory"` and step events with `payload.projection = "trajectory_step"`.
- Backend trajectory projection lives in `apps/backend/agent-server/src/chat/chat-trajectory-events.adapter.ts`.
- Frontend SSE parsing and event folding lives under `apps/frontend/agent-chat/src/hooks/chat-session/`.
- Chat message rendering currently flows through `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx` and shared cards in `apps/frontend/agent-chat/src/components/chat-message-cards.tsx`.
- `apps/frontend/agent-chat/src/styles/chat-home-page.scss` is the style aggregation entry; do not add a second Sass module with the same namespace.

## File Structure

Files to create:

```text
packages/core/src/tasking/schemas/chat-response-step.ts
packages/core/src/tasking/types/chat-response-step.ts
packages/core/test/chat-response-step-contracts.test.ts

apps/backend/agent-server/src/chat/chat-response-steps.adapter.ts
apps/backend/agent-server/test/chat/chat-response-steps.adapter.spec.ts

apps/frontend/agent-chat/src/lib/chat-response-step-projections.ts
apps/frontend/agent-chat/src/components/chat-response-steps/quick-response-steps.tsx
apps/frontend/agent-chat/src/components/chat-response-steps/response-step-detail.tsx
apps/frontend/agent-chat/src/components/chat-response-steps/response-step-summary.tsx
apps/frontend/agent-chat/src/components/chat-response-steps/index.ts
apps/frontend/agent-chat/test/lib/chat-response-step-projections.test.ts
apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx

docs/apps/backend/agent-server/chat-response-steps.md
```

Files to modify:

```text
packages/core/src/tasking/schemas/index.ts
packages/core/src/tasking/types/index.ts
packages/core/src/tasking/index.ts
packages/core/src/index.ts

apps/backend/agent-server/src/chat/chat.service.ts
apps/backend/agent-server/src/chat/chat.controller.ts
apps/backend/agent-server/test/chat/chat.controller.spec.ts

apps/frontend/agent-chat/src/hooks/chat-session/chat-session-events.ts
apps/frontend/agent-chat/src/hooks/chat-session/chat-session-event-message-helpers.ts
apps/frontend/agent-chat/src/hooks/chat-session/chat-session-stream.ts
apps/frontend/agent-chat/src/hooks/chat-session/use-chat-session-stream-manager.ts
apps/frontend/agent-chat/src/types/chat.ts
apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx
apps/frontend/agent-chat/src/components/chat-message-cards.tsx
apps/frontend/agent-chat/src/styles/chat-home-page.scss
apps/frontend/agent-chat/test/hooks/chat-session/chat-session-stream.test.ts
apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx

docs/contracts/api/agent-chat.md
docs/apps/frontend/agent-chat/overview.md
docs/apps/backend/agent-server/agent-server-overview.md
```

Boundary decisions:

- `packages/core` owns the stable JSON schemas and inferred types only.
- `agent-server` owns translation from existing runtime/chat events to response-step projections.
- `agent-chat` owns local folding, display grouping, and responsive UI.
- No app imports from `packages/*/src`; frontend imports public exports from `@agent/core`.
- If `chat-message-adapter.tsx` grows beyond 400 lines while implementing this plan, extract response-step rendering into `apps/frontend/agent-chat/src/pages/chat/chat-message-response-steps.tsx` during the same task.

---

## Task 1: Core Response-Step Contract

**Purpose:** Add schema-first contracts for Codex-style response steps and snapshots.

**Files:**

- Create: `packages/core/src/tasking/schemas/chat-response-step.ts`
- Create: `packages/core/src/tasking/types/chat-response-step.ts`
- Create: `packages/core/test/chat-response-step-contracts.test.ts`
- Modify: `packages/core/src/tasking/schemas/index.ts`
- Modify: `packages/core/src/tasking/types/index.ts`
- Modify: `packages/core/src/tasking/index.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing contract tests**

Add `packages/core/test/chat-response-step-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { ChatResponseStepEventSchema, ChatResponseStepRecordSchema, ChatResponseStepSnapshotSchema } from '../src';

const now = '2026-05-02T08:30:00.000Z';

describe('chat response step contracts', () => {
  it('parses a running file-read response step', () => {
    const parsed = ChatResponseStepRecordSchema.parse({
      id: 'step-read-chat-page',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      sequence: 1,
      phase: 'explore',
      status: 'running',
      title: 'Read chat-home-page.tsx',
      detail: 'Inspecting the current chat home page composition.',
      target: {
        kind: 'file',
        label: 'chat-home-page.tsx',
        path: 'apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx'
      },
      startedAt: now,
      sourceEventId: 'event-1',
      sourceEventType: 'tool_called'
    });

    expect(parsed.phase).toBe('explore');
    expect(parsed.target?.kind).toBe('file');
  });

  it('parses a completed snapshot for quick and detail rendering', () => {
    const parsed = ChatResponseStepSnapshotSchema.parse({
      projection: 'chat_response_steps',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      steps: [
        {
          id: 'step-verify',
          sessionId: 'session-1',
          messageId: 'assistant-1',
          sequence: 2,
          phase: 'verify',
          status: 'completed',
          title: 'Ran affected tests',
          target: {
            kind: 'test',
            label: 'chat response steps tests'
          },
          startedAt: now,
          completedAt: now,
          sourceEventId: 'event-2',
          sourceEventType: 'execution_step_completed'
        }
      ],
      summary: {
        title: '已处理 2m 14s',
        completedCount: 1,
        runningCount: 0,
        blockedCount: 0,
        failedCount: 0
      },
      updatedAt: now
    });

    expect(parsed.projection).toBe('chat_response_steps');
    expect(parsed.steps[0]?.status).toBe('completed');
  });

  it('rejects unknown phase and status values', () => {
    expect(() =>
      ChatResponseStepRecordSchema.parse({
        id: 'step-bad',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        sequence: 1,
        phase: 'wander',
        status: 'done-ish',
        title: 'Invalid step',
        startedAt: now,
        sourceEventId: 'event-3',
        sourceEventType: 'node_status'
      })
    ).toThrow();
  });

  it('parses an incremental event wrapper', () => {
    const parsed = ChatResponseStepEventSchema.parse({
      projection: 'chat_response_step',
      action: 'completed',
      step: {
        id: 'step-command',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        sequence: 3,
        phase: 'execute',
        status: 'completed',
        title: 'Ran pnpm exec vitest',
        target: {
          kind: 'command',
          label: 'pnpm exec vitest run'
        },
        startedAt: now,
        completedAt: now,
        sourceEventId: 'event-4',
        sourceEventType: 'execution_step_completed'
      }
    });

    expect(parsed.action).toBe('completed');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/chat-response-step-contracts.test.ts
```

Expected: fail because `ChatResponseStepEventSchema`, `ChatResponseStepRecordSchema`, and `ChatResponseStepSnapshotSchema` are not exported.

- [ ] **Step 3: Implement schemas**

Create `packages/core/src/tasking/schemas/chat-response-step.ts`:

```ts
import { z } from 'zod';

export const ChatResponseStepPhaseSchema = z.enum([
  'intake',
  'context',
  'explore',
  'approve',
  'execute',
  'edit',
  'verify',
  'summarize'
]);

export const ChatResponseStepStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'blocked',
  'failed',
  'cancelled'
]);

export const ChatResponseStepTargetSchema = z
  .object({
    kind: z.enum(['file', 'command', 'url', 'approval', 'test', 'artifact', 'message', 'other']),
    label: z.string().min(1),
    path: z.string().min(1).optional(),
    href: z.string().url().optional()
  })
  .strict();

export const ChatResponseStepRecordSchema = z
  .object({
    id: z.string().min(1),
    sessionId: z.string().min(1),
    messageId: z.string().min(1),
    sequence: z.number().int().nonnegative(),
    phase: ChatResponseStepPhaseSchema,
    status: ChatResponseStepStatusSchema,
    title: z.string().min(1),
    detail: z.string().min(1).optional(),
    target: ChatResponseStepTargetSchema.optional(),
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
    sourceEventId: z.string().min(1),
    sourceEventType: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const ChatResponseStepSummarySchema = z
  .object({
    title: z.string().min(1),
    completedCount: z.number().int().nonnegative(),
    runningCount: z.number().int().nonnegative(),
    blockedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative()
  })
  .strict();

export const ChatResponseStepSnapshotSchema = z
  .object({
    projection: z.literal('chat_response_steps'),
    sessionId: z.string().min(1),
    messageId: z.string().min(1),
    status: z.enum(['running', 'completed', 'blocked', 'failed', 'cancelled']),
    steps: z.array(ChatResponseStepRecordSchema),
    summary: ChatResponseStepSummarySchema,
    updatedAt: z.string().datetime()
  })
  .strict();

export const ChatResponseStepEventSchema = z
  .object({
    projection: z.literal('chat_response_step'),
    action: z.enum(['started', 'updated', 'completed', 'failed', 'blocked', 'cancelled']),
    step: ChatResponseStepRecordSchema
  })
  .strict();
```

- [ ] **Step 4: Implement inferred types and exports**

Create `packages/core/src/tasking/types/chat-response-step.ts`:

```ts
import type { z } from 'zod';

import type {
  ChatResponseStepEventSchema,
  ChatResponseStepPhaseSchema,
  ChatResponseStepRecordSchema,
  ChatResponseStepSnapshotSchema,
  ChatResponseStepStatusSchema,
  ChatResponseStepSummarySchema,
  ChatResponseStepTargetSchema
} from '../schemas/chat-response-step';

export type ChatResponseStepPhase = z.infer<typeof ChatResponseStepPhaseSchema>;
export type ChatResponseStepStatus = z.infer<typeof ChatResponseStepStatusSchema>;
export type ChatResponseStepTarget = z.infer<typeof ChatResponseStepTargetSchema>;
export type ChatResponseStepRecord = z.infer<typeof ChatResponseStepRecordSchema>;
export type ChatResponseStepSummary = z.infer<typeof ChatResponseStepSummarySchema>;
export type ChatResponseStepSnapshot = z.infer<typeof ChatResponseStepSnapshotSchema>;
export type ChatResponseStepEvent = z.infer<typeof ChatResponseStepEventSchema>;
```

Update the four index files so the new schema and types are public:

```ts
export * from './chat-response-step';
```

- [ ] **Step 5: Run contract tests and core typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/chat-response-step-contracts.test.ts
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
```

Expected: both commands pass.

---

## Task 2: Backend Response-Step Adapter

**Purpose:** Translate existing chat events into stable response-step projections without changing the wire framing.

**Files:**

- Create: `apps/backend/agent-server/src/chat/chat-response-steps.adapter.ts`
- Create: `apps/backend/agent-server/test/chat/chat-response-steps.adapter.spec.ts`

- [ ] **Step 1: Write failing adapter tests**

Add `apps/backend/agent-server/test/chat/chat-response-steps.adapter.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { ChatEventRecord } from '@agent/core';

import { buildChatResponseStepEvent, buildChatResponseStepSnapshot } from '../../src/chat/chat-response-steps.adapter';

const baseEvent = {
  id: 'event-1',
  sessionId: 'session-1',
  taskId: 'task-1',
  createdAt: '2026-05-02T08:30:00.000Z'
} satisfies Partial<ChatEventRecord>;

describe('chat response steps adapter', () => {
  it('projects a tool call into a running explore step', () => {
    const event = {
      ...baseEvent,
      type: 'tool_called',
      payload: {
        title: 'Read chat-message-adapter.tsx',
        summary: 'Inspecting message rendering.',
        path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx'
      }
    } as ChatEventRecord;

    const projection = buildChatResponseStepEvent(event, {
      messageId: 'assistant-1',
      sequence: 0
    });

    expect(projection?.action).toBe('started');
    expect(projection?.step.phase).toBe('explore');
    expect(projection?.step.target?.kind).toBe('file');
  });

  it('projects an execution completion into a completed command step', () => {
    const event = {
      ...baseEvent,
      id: 'event-2',
      type: 'execution_step_completed',
      payload: {
        title: 'Ran affected tests',
        command:
          'pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx'
      }
    } as ChatEventRecord;

    const projection = buildChatResponseStepEvent(event, {
      messageId: 'assistant-1',
      sequence: 1
    });

    expect(projection?.action).toBe('completed');
    expect(projection?.step.status).toBe('completed');
    expect(projection?.step.phase).toBe('verify');
    expect(projection?.step.target?.kind).toBe('command');
  });

  it('returns null for assistant token deltas', () => {
    const event = {
      ...baseEvent,
      id: 'event-3',
      type: 'assistant_token',
      payload: { content: 'hello' }
    } as ChatEventRecord;

    expect(buildChatResponseStepEvent(event, { messageId: 'assistant-1', sequence: 2 })).toBeNull();
  });

  it('builds a summary snapshot from projected steps', () => {
    const started = buildChatResponseStepEvent(
      {
        ...baseEvent,
        id: 'event-4',
        type: 'tool_called',
        payload: { title: 'Read file', path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx' }
      } as ChatEventRecord,
      { messageId: 'assistant-1', sequence: 0 }
    );
    const completed = buildChatResponseStepEvent(
      {
        ...baseEvent,
        id: 'event-5',
        type: 'execution_step_completed',
        payload: { title: 'Ran tests', command: 'pnpm exec vitest run' }
      } as ChatEventRecord,
      { messageId: 'assistant-1', sequence: 1 }
    );

    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      steps: [started!.step, completed!.step],
      updatedAt: '2026-05-02T08:31:00.000Z'
    });

    expect(snapshot.summary.completedCount).toBe(1);
    expect(snapshot.summary.runningCount).toBe(1);
    expect(snapshot.projection).toBe('chat_response_steps');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/chat/chat-response-steps.adapter.spec.ts
```

Expected: fail because `chat-response-steps.adapter.ts` does not exist.

- [ ] **Step 3: Implement minimal adapter**

Create `apps/backend/agent-server/src/chat/chat-response-steps.adapter.ts`:

```ts
import { z } from 'zod';

import {
  ChatResponseStepEventSchema,
  ChatResponseStepSnapshotSchema,
  type ChatEventRecord,
  type ChatResponseStepEvent,
  type ChatResponseStepPhase,
  type ChatResponseStepRecord,
  type ChatResponseStepSnapshot,
  type ChatResponseStepStatus,
  type ChatResponseStepTarget
} from '@agent/core';

type BuildStepContext = {
  messageId: string;
  sequence: number;
};

type BuildSnapshotInput = {
  sessionId: string;
  messageId: string;
  status: ChatResponseStepSnapshot['status'];
  steps: ChatResponseStepRecord[];
  updatedAt: string;
};

const StepPayloadSchema = z
  .object({
    title: z.string().optional(),
    summary: z.string().optional(),
    path: z.string().optional(),
    file: z.string().optional(),
    command: z.string().optional(),
    url: z.string().url().optional(),
    approvalId: z.string().optional()
  })
  .passthrough();

const EVENT_MAP: Partial<
  Record<
    ChatEventRecord['type'],
    {
      action: ChatResponseStepEvent['action'];
      phase: ChatResponseStepPhase;
      status: ChatResponseStepStatus;
    }
  >
> = {
  tool_called: { action: 'started', phase: 'explore', status: 'running' },
  tool_stream_dispatched: { action: 'started', phase: 'execute', status: 'running' },
  tool_stream_completed: { action: 'completed', phase: 'execute', status: 'completed' },
  execution_step_started: { action: 'started', phase: 'execute', status: 'running' },
  execution_step_completed: { action: 'completed', phase: 'verify', status: 'completed' },
  execution_step_blocked: { action: 'blocked', phase: 'approve', status: 'blocked' },
  approval_required: { action: 'blocked', phase: 'approve', status: 'blocked' },
  approval_resolved: { action: 'completed', phase: 'approve', status: 'completed' },
  review_completed: { action: 'completed', phase: 'verify', status: 'completed' },
  final_response_completed: { action: 'completed', phase: 'summarize', status: 'completed' },
  session_failed: { action: 'failed', phase: 'summarize', status: 'failed' },
  run_cancelled: { action: 'cancelled', phase: 'summarize', status: 'cancelled' }
};

export function buildChatResponseStepEvent(
  sourceEvent: ChatEventRecord,
  context: BuildStepContext
): ChatResponseStepEvent | null {
  const mapping = EVENT_MAP[sourceEvent.type];
  if (!mapping) {
    return null;
  }

  const payload = StepPayloadSchema.parse(sourceEvent.payload ?? {});
  const target = buildTarget(payload, mapping.phase);
  const step: ChatResponseStepRecord = {
    id: `response-step-${sourceEvent.id}`,
    sessionId: sourceEvent.sessionId,
    messageId: context.messageId,
    sequence: context.sequence,
    phase: mapping.phase,
    status: mapping.status,
    title: payload.title ?? fallbackTitle(sourceEvent.type),
    detail: payload.summary,
    target,
    startedAt: sourceEvent.createdAt,
    completedAt:
      mapping.status === 'completed' || mapping.status === 'failed' || mapping.status === 'cancelled'
        ? sourceEvent.createdAt
        : undefined,
    sourceEventId: sourceEvent.id,
    sourceEventType: sourceEvent.type
  };

  return ChatResponseStepEventSchema.parse({
    projection: 'chat_response_step',
    action: mapping.action,
    step
  });
}

export function buildChatResponseStepSnapshot(input: BuildSnapshotInput): ChatResponseStepSnapshot {
  const completedCount = input.steps.filter(step => step.status === 'completed').length;
  const runningCount = input.steps.filter(step => step.status === 'running' || step.status === 'queued').length;
  const blockedCount = input.steps.filter(step => step.status === 'blocked').length;
  const failedCount = input.steps.filter(step => step.status === 'failed').length;

  return ChatResponseStepSnapshotSchema.parse({
    projection: 'chat_response_steps',
    sessionId: input.sessionId,
    messageId: input.messageId,
    status: input.status,
    steps: input.steps,
    summary: {
      title:
        input.status === 'completed' ? `已处理 ${input.steps.length} 个步骤` : `处理中 ${input.steps.length} 个步骤`,
      completedCount,
      runningCount,
      blockedCount,
      failedCount
    },
    updatedAt: input.updatedAt
  });
}

function buildTarget(
  payload: z.infer<typeof StepPayloadSchema>,
  phase: ChatResponseStepPhase
): ChatResponseStepTarget | undefined {
  const path = payload.path ?? payload.file;
  if (path) {
    return { kind: 'file', label: path.split('/').at(-1) ?? path, path };
  }
  if (payload.command) {
    return { kind: 'command', label: payload.command };
  }
  if (payload.url) {
    return { kind: 'url', label: payload.url, href: payload.url };
  }
  if (payload.approvalId) {
    return { kind: 'approval', label: payload.approvalId };
  }
  if (phase === 'verify') {
    return { kind: 'test', label: 'verification' };
  }
  return undefined;
}

function fallbackTitle(eventType: ChatEventRecord['type']) {
  return eventType.replaceAll('_', ' ');
}
```

- [ ] **Step 4: Run adapter tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/chat/chat-response-steps.adapter.spec.ts
```

Expected: pass.

---

## Task 3: Backend SSE Projection Wiring

**Purpose:** Emit response-step incremental projections and snapshots through the existing `ChatEventRecord` stream.

**Files:**

- Modify: `apps/backend/agent-server/src/chat/chat.service.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.controller.ts`
- Modify: `apps/backend/agent-server/test/chat/chat.controller.spec.ts`
- Modify if existing test ownership is clearer after inspection: `apps/backend/agent-server/test/chat/chat.service.*.spec.ts`

- [ ] **Step 1: Inspect current stream emission points**

Run:

```bash
rg -n "stream|EventEmitter|ChatEventRecord|assistant_token|node_progress|subscribe" apps/backend/agent-server/src/chat apps/backend/agent-server/test/chat
```

Expected: identify the single path that serializes `ChatEventRecord` frames for `/api/chat/stream`.

- [ ] **Step 2: Write failing SSE projection test**

In the existing controller or service stream spec, add an assertion equivalent to:

```ts
expect(streamedEvents).toContainEqual(
  expect.objectContaining({
    type: 'node_progress',
    payload: expect.objectContaining({
      projection: 'chat_response_step',
      action: 'started',
      step: expect.objectContaining({
        phase: 'explore',
        status: 'running',
        title: 'Read chat-message-adapter.tsx'
      })
    })
  })
);
```

Also assert that the completed stream includes:

```ts
expect(streamedEvents).toContainEqual(
  expect.objectContaining({
    type: 'node_progress',
    payload: expect.objectContaining({
      projection: 'chat_response_steps',
      status: 'completed',
      summary: expect.objectContaining({
        completedCount: expect.any(Number)
      })
    })
  })
);
```

- [ ] **Step 3: Run the targeted backend stream test to verify it fails**

Run the specific test file found in Step 1, for example:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/chat/chat.controller.spec.ts
```

Expected: fail because response-step projections are not emitted.

- [ ] **Step 4: Wire projection emission**

Use `buildChatResponseStepEvent` whenever a streamed raw event is not `assistant_token`. Wrap the projection in a normal `ChatEventRecord` with:

```ts
{
  id: `response-step-event-${sourceEvent.id}`,
  sessionId: sourceEvent.sessionId,
  taskId: sourceEvent.taskId,
  type: 'node_progress',
  payload: buildChatResponseStepEvent(sourceEvent, {
    messageId: currentAssistantMessageId,
    sequence: nextStepSequence
  }),
  createdAt: sourceEvent.createdAt
}
```

On final assistant completion, emit a snapshot frame:

```ts
{
  id: `response-step-snapshot-${assistantMessageId}`,
  sessionId,
  taskId,
  type: 'node_progress',
  payload: buildChatResponseStepSnapshot({
    sessionId,
    messageId: assistantMessageId,
    status: finalStatus,
    steps: accumulatedSteps,
    updatedAt: new Date().toISOString()
  }),
  createdAt: new Date().toISOString()
}
```

Keep sequence assignment deterministic per session stream replay by deriving it from the ordered source events in the service, not from a module-level counter.

- [ ] **Step 5: Run backend adapter and stream tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/chat/chat-response-steps.adapter.spec.ts apps/backend/agent-server/test/chat/chat.controller.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: all commands pass.

---

## Task 4: Frontend Projection Folding

**Purpose:** Parse response-step SSE payloads into deterministic per-message UI state.

**Files:**

- Create: `apps/frontend/agent-chat/src/lib/chat-response-step-projections.ts`
- Create: `apps/frontend/agent-chat/test/lib/chat-response-step-projections.test.ts`
- Modify: `apps/frontend/agent-chat/src/types/chat.ts`

- [ ] **Step 1: Write failing projection tests**

Add `apps/frontend/agent-chat/test/lib/chat-response-step-projections.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { ChatResponseStepEvent, ChatResponseStepSnapshot } from '@agent/core';

import {
  foldChatResponseStepProjection,
  initialChatResponseStepsState
} from '../../src/lib/chat-response-step-projections';

const step = {
  id: 'response-step-event-1',
  sessionId: 'session-1',
  messageId: 'assistant-1',
  sequence: 0,
  phase: 'explore',
  status: 'running',
  title: 'Read chat-message-adapter.tsx',
  startedAt: '2026-05-02T08:30:00.000Z',
  sourceEventId: 'event-1',
  sourceEventType: 'tool_called'
} satisfies ChatResponseStepEvent['step'];

describe('chat response step projections', () => {
  it('upserts incremental steps by id and sorts by sequence', () => {
    const next = foldChatResponseStepProjection(initialChatResponseStepsState(), {
      projection: 'chat_response_step',
      action: 'started',
      step
    } satisfies ChatResponseStepEvent);

    expect(next.byMessageId['assistant-1']?.steps.map(item => item.title)).toEqual(['Read chat-message-adapter.tsx']);
  });

  it('replaces message state with a completed snapshot', () => {
    const snapshot = {
      projection: 'chat_response_steps',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      steps: [{ ...step, status: 'completed', completedAt: '2026-05-02T08:31:00.000Z' }],
      summary: {
        title: '已处理 1 个步骤',
        completedCount: 1,
        runningCount: 0,
        blockedCount: 0,
        failedCount: 0
      },
      updatedAt: '2026-05-02T08:31:00.000Z'
    } satisfies ChatResponseStepSnapshot;

    const next = foldChatResponseStepProjection(initialChatResponseStepsState(), snapshot);

    expect(next.byMessageId['assistant-1']?.status).toBe('completed');
    expect(next.byMessageId['assistant-1']?.summary.completedCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/lib/chat-response-step-projections.test.ts
```

Expected: fail because the projection helper does not exist.

- [ ] **Step 3: Implement projection helper**

Create `apps/frontend/agent-chat/src/lib/chat-response-step-projections.ts`:

```ts
import {
  ChatResponseStepEventSchema,
  ChatResponseStepSnapshotSchema,
  type ChatResponseStepEvent,
  type ChatResponseStepRecord,
  type ChatResponseStepSnapshot,
  type ChatResponseStepSummary
} from '@agent/core';

export type ChatResponseStepsForMessage = {
  messageId: string;
  status: ChatResponseStepSnapshot['status'] | 'running';
  steps: ChatResponseStepRecord[];
  summary: ChatResponseStepSummary;
  updatedAt: string;
};

export type ChatResponseStepsState = {
  byMessageId: Record<string, ChatResponseStepsForMessage>;
};

export type ChatResponseStepProjection = ChatResponseStepEvent | ChatResponseStepSnapshot;

export function initialChatResponseStepsState(): ChatResponseStepsState {
  return { byMessageId: {} };
}

export function parseChatResponseStepProjection(payload: unknown): ChatResponseStepProjection | null {
  const event = ChatResponseStepEventSchema.safeParse(payload);
  if (event.success) {
    return event.data;
  }

  const snapshot = ChatResponseStepSnapshotSchema.safeParse(payload);
  if (snapshot.success) {
    return snapshot.data;
  }

  return null;
}

export function foldChatResponseStepProjection(
  state: ChatResponseStepsState,
  projection: ChatResponseStepProjection
): ChatResponseStepsState {
  if (projection.projection === 'chat_response_steps') {
    return {
      byMessageId: {
        ...state.byMessageId,
        [projection.messageId]: {
          messageId: projection.messageId,
          status: projection.status,
          steps: sortSteps(projection.steps),
          summary: projection.summary,
          updatedAt: projection.updatedAt
        }
      }
    };
  }

  const current = state.byMessageId[projection.step.messageId];
  const steps = sortSteps(upsertStep(current?.steps ?? [], projection.step));
  const updatedAt = projection.step.completedAt ?? projection.step.startedAt;

  return {
    byMessageId: {
      ...state.byMessageId,
      [projection.step.messageId]: {
        messageId: projection.step.messageId,
        status: deriveStatus(steps),
        steps,
        summary: summarizeSteps(steps),
        updatedAt
      }
    }
  };
}

function upsertStep(steps: ChatResponseStepRecord[], next: ChatResponseStepRecord) {
  if (!steps.some(step => step.id === next.id)) {
    return [...steps, next];
  }

  return steps.map(step => (step.id === next.id ? next : step));
}

function sortSteps(steps: ChatResponseStepRecord[]) {
  return [...steps].sort(
    (left, right) => left.sequence - right.sequence || left.startedAt.localeCompare(right.startedAt)
  );
}

function deriveStatus(steps: ChatResponseStepRecord[]): ChatResponseStepsForMessage['status'] {
  if (steps.some(step => step.status === 'failed')) return 'failed';
  if (steps.some(step => step.status === 'blocked')) return 'blocked';
  if (steps.some(step => step.status === 'cancelled')) return 'cancelled';
  if (steps.length > 0 && steps.every(step => step.status === 'completed')) return 'completed';
  return 'running';
}

function summarizeSteps(steps: ChatResponseStepRecord[]): ChatResponseStepSummary {
  return {
    title: `已处理 ${steps.length} 个步骤`,
    completedCount: steps.filter(step => step.status === 'completed').length,
    runningCount: steps.filter(step => step.status === 'running' || step.status === 'queued').length,
    blockedCount: steps.filter(step => step.status === 'blocked').length,
    failedCount: steps.filter(step => step.status === 'failed').length
  };
}
```

- [ ] **Step 4: Add session state type**

Modify `apps/frontend/agent-chat/src/types/chat.ts` to expose an optional field on the local session or stream state type used by the hook:

```ts
import type { ChatResponseStepsState } from '@/lib/chat-response-step-projections';

export type ChatSessionStreamState = {
  responseSteps: ChatResponseStepsState;
};
```

If `ChatSessionStreamState` already exists, add `responseSteps: ChatResponseStepsState` to that type instead of creating a duplicate.

- [ ] **Step 5: Run projection tests and frontend typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/lib/chat-response-step-projections.test.ts
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: projection tests pass; typecheck passes after the state type is wired to the existing shape.

---

## Task 5: Frontend SSE State Integration

**Purpose:** Fold response-step projections from `node_progress` chat events into session state.

**Files:**

- Modify: `apps/frontend/agent-chat/src/hooks/chat-session/chat-session-events.ts`
- Modify: `apps/frontend/agent-chat/src/hooks/chat-session/chat-session-stream.ts`
- Modify: `apps/frontend/agent-chat/src/hooks/chat-session/use-chat-session-stream-manager.ts`
- Modify: `apps/frontend/agent-chat/test/hooks/chat-session/chat-session-stream.test.ts`

- [ ] **Step 1: Write failing stream test**

In `apps/frontend/agent-chat/test/hooks/chat-session/chat-session-stream.test.ts`, add a test that feeds this event through the same parser used by the stream hook:

```ts
const responseStepEvent = {
  id: 'response-step-event-1',
  sessionId: 'session-1',
  type: 'node_progress',
  createdAt: '2026-05-02T08:30:00.000Z',
  payload: {
    projection: 'chat_response_step',
    action: 'started',
    step: {
      id: 'step-1',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      sequence: 0,
      phase: 'explore',
      status: 'running',
      title: 'Read chat-message-adapter.tsx',
      startedAt: '2026-05-02T08:30:00.000Z',
      sourceEventId: 'event-1',
      sourceEventType: 'tool_called'
    }
  }
};

expect(result.responseSteps.byMessageId['assistant-1']?.steps[0]?.title).toBe('Read chat-message-adapter.tsx');
```

- [ ] **Step 2: Run the stream test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/hooks/chat-session/chat-session-stream.test.ts
```

Expected: fail because `responseSteps` is not folded into hook state.

- [ ] **Step 3: Fold projections in event handling**

In the event handling function that currently calls `mergeEvent`, `mergeMessage`, `syncMessageFromEvent`, or card helpers, add:

```ts
const responseStepProjection = parseChatResponseStepProjection(nextEvent.payload);
const nextResponseSteps = responseStepProjection
  ? foldChatResponseStepProjection(current.responseSteps, responseStepProjection)
  : current.responseSteps;
```

Initialize stream state with:

```ts
responseSteps: initialChatResponseStepsState();
```

Keep raw events in the timeline so the workbench can still show observability cards.

- [ ] **Step 4: Run stream and projection tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/lib/chat-response-step-projections.test.ts apps/frontend/agent-chat/test/hooks/chat-session/chat-session-stream.test.ts
```

Expected: both files pass.

---

## Task 6: Response-Step UI Components

**Purpose:** Render fast running steps and completed expandable details in the chat message surface.

**Files:**

- Create: `apps/frontend/agent-chat/src/components/chat-response-steps/quick-response-steps.tsx`
- Create: `apps/frontend/agent-chat/src/components/chat-response-steps/response-step-detail.tsx`
- Create: `apps/frontend/agent-chat/src/components/chat-response-steps/response-step-summary.tsx`
- Create: `apps/frontend/agent-chat/src/components/chat-response-steps/index.ts`
- Create: `apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx`
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-page.scss`

- [ ] **Step 1: Write failing component tests**

Add `apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ChatResponseStepsForMessage } from '../../src/lib/chat-response-step-projections';
import { QuickResponseSteps, ResponseStepSummary } from '../../src/components/chat-response-steps';

const state: ChatResponseStepsForMessage = {
  messageId: 'assistant-1',
  status: 'running',
  updatedAt: '2026-05-02T08:30:00.000Z',
  summary: {
    title: '处理中 2 个步骤',
    completedCount: 1,
    runningCount: 1,
    blockedCount: 0,
    failedCount: 0
  },
  steps: [
    {
      id: 'step-1',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      sequence: 0,
      phase: 'explore',
      status: 'completed',
      title: 'Read chat-message-adapter.tsx',
      startedAt: '2026-05-02T08:30:00.000Z',
      completedAt: '2026-05-02T08:30:10.000Z',
      sourceEventId: 'event-1',
      sourceEventType: 'tool_called'
    },
    {
      id: 'step-2',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      sequence: 1,
      phase: 'verify',
      status: 'running',
      title: 'Ran pnpm exec vitest',
      startedAt: '2026-05-02T08:30:12.000Z',
      sourceEventId: 'event-2',
      sourceEventType: 'execution_step_started'
    }
  ]
};

describe('chat response step components', () => {
  it('renders running quick response steps', () => {
    render(<QuickResponseSteps responseSteps={state} />);

    expect(screen.getByText('Read chat-message-adapter.tsx')).toBeInTheDocument();
    expect(screen.getByText('Ran pnpm exec vitest')).toBeInTheDocument();
  });

  it('renders completed summary and hidden details container', () => {
    render(<ResponseStepSummary responseSteps={{ ...state, status: 'completed' }} />);

    expect(screen.getByText('处理中 2 个步骤')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看步骤细节/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx
```

Expected: fail because components do not exist.

- [ ] **Step 3: Implement components**

Implement `QuickResponseSteps` as a compact vertical list:

```tsx
import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';

type QuickResponseStepsProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function QuickResponseSteps({ responseSteps }: QuickResponseStepsProps) {
  return (
    <div className="chat-response-steps chat-response-steps--quick" aria-label="AI response steps">
      <div className="chat-response-steps__summary">{responseSteps.summary.title}</div>
      <ol className="chat-response-steps__list">
        {responseSteps.steps.map(step => (
          <li className={`chat-response-steps__item is-${step.status}`} key={step.id}>
            <span className="chat-response-steps__status" aria-hidden="true" />
            <span className="chat-response-steps__title">{step.title}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

Implement `ResponseStepSummary` with a native `<details>` element:

```tsx
import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';
import { ResponseStepDetail } from './response-step-detail';

type ResponseStepSummaryProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function ResponseStepSummary({ responseSteps }: ResponseStepSummaryProps) {
  return (
    <details className="chat-response-steps chat-response-steps--complete">
      <summary>
        <span>{responseSteps.summary.title}</span>
        <button type="button" tabIndex={-1}>
          查看步骤细节
        </button>
      </summary>
      <ol className="chat-response-steps__list">
        {responseSteps.steps.map(step => (
          <ResponseStepDetail key={step.id} step={step} />
        ))}
      </ol>
    </details>
  );
}
```

Implement `ResponseStepDetail`:

```tsx
import type { ChatResponseStepRecord } from '@agent/core';

type ResponseStepDetailProps = {
  step: ChatResponseStepRecord;
};

export function ResponseStepDetail({ step }: ResponseStepDetailProps) {
  return (
    <li className={`chat-response-steps__item is-${step.status}`}>
      <span className="chat-response-steps__status" aria-hidden="true" />
      <span className="chat-response-steps__title">{step.title}</span>
      {step.detail ? <span className="chat-response-steps__detail">{step.detail}</span> : null}
    </li>
  );
}
```

Export from `index.ts`:

```ts
export * from './quick-response-steps';
export * from './response-step-detail';
export * from './response-step-summary';
```

- [ ] **Step 4: Add restrained styles**

Append to `apps/frontend/agent-chat/src/styles/chat-home-page.scss` or an existing imported partial from that file:

```scss
.chat-response-steps {
  color: var(--chat-muted-text, #6b7280);
  font-size: 0.92rem;
  line-height: 1.6;
}

.chat-response-steps__summary {
  margin-bottom: 0.25rem;
  color: var(--chat-muted-text, #8a8f98);
}

.chat-response-steps__list {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chat-response-steps__item {
  display: grid;
  grid-template-columns: 0.75rem minmax(0, 1fr);
  align-items: start;
  column-gap: 0.45rem;
}

.chat-response-steps__status {
  width: 0.42rem;
  height: 0.42rem;
  margin-top: 0.55rem;
  border-radius: 999px;
  background: #a3aab5;
}

.chat-response-steps__item.is-running .chat-response-steps__status {
  background: #1677ff;
}

.chat-response-steps__item.is-completed .chat-response-steps__status {
  background: #22a06b;
}

.chat-response-steps__item.is-blocked .chat-response-steps__status,
.chat-response-steps__item.is-failed .chat-response-steps__status {
  background: #d97706;
}

.chat-response-steps__title,
.chat-response-steps__detail {
  min-width: 0;
  overflow-wrap: anywhere;
}

.chat-response-steps__detail {
  grid-column: 2;
  color: var(--chat-subtle-text, #9aa0aa);
}
```

- [ ] **Step 5: Run component tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx
```

Expected: pass.

---

## Task 7: Chat Message Rendering Integration

**Purpose:** Place quick steps in running assistant messages and completed details beside final assistant content.

**Files:**

- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx`
- Modify: `apps/frontend/agent-chat/src/components/chat-message-cards.tsx`
- Modify: `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx`

- [ ] **Step 1: Write failing rendering test**

In `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx`, add a test that renders an assistant message with `responseSteps.byMessageId[message.id]` and asserts:

```ts
expect(screen.getByText('Read chat-message-adapter.tsx')).toBeInTheDocument();
expect(screen.getByText('Ran pnpm exec vitest')).toBeInTheDocument();
```

Add a second assertion for completed messages:

```ts
expect(screen.getByRole('button', { name: /查看步骤细节/ })).toBeInTheDocument();
```

- [ ] **Step 2: Run the rendering test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx
```

Expected: fail because response-step state is not passed into message rendering.

- [ ] **Step 3: Thread response-step state into message rendering**

Add a prop to the adapter boundary:

```ts
responseStepsByMessageId?: ChatResponseStepsState['byMessageId'];
```

When rendering each assistant message:

```tsx
const messageResponseSteps = responseStepsByMessageId?.[message.id];

{
  messageResponseSteps && messageResponseSteps.status !== 'completed' ? (
    <QuickResponseSteps responseSteps={messageResponseSteps} />
  ) : null;
}

{
  message.content ? renderMessageContent(message) : null;
}

{
  messageResponseSteps && messageResponseSteps.status === 'completed' ? (
    <ResponseStepSummary responseSteps={messageResponseSteps} />
  ) : null;
}
```

If a pending assistant message receives streamed steps before the final message id is known, preserve the existing pending-message replacement path and copy `responseStepsByMessageId[pendingId]` to the final assistant id in the stream state reducer.

- [ ] **Step 4: Keep card boundaries clean**

If `chat-message-cards.tsx` currently owns assistant card chrome, expose a narrow slot prop:

```ts
type ChatMessageCardProps = {
  beforeContent?: React.ReactNode;
  afterContent?: React.ReactNode;
};
```

Render the slots without placing cards inside cards.

- [ ] **Step 5: Run rendering and component tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx
```

Expected: both files pass.

---

## Task 8: Contract Docs, Module Docs, and Affected Verification

**Purpose:** Record the final interface and verify the whole changed surface.

**Files:**

- Modify: `docs/contracts/api/agent-chat.md`
- Modify: `docs/apps/frontend/agent-chat/overview.md`
- Modify: `docs/apps/backend/agent-server/agent-server-overview.md`
- Create: `docs/apps/backend/agent-server/chat-response-steps.md`

- [ ] **Step 1: Update API contract docs**

In `docs/contracts/api/agent-chat.md`, add a subsection under SSE:

```md
### Chat Response Steps projection

`agent-server` may emit `node_progress` events whose payload is one of:

- `ChatResponseStepEventSchema` with `payload.projection = "chat_response_step"`
- `ChatResponseStepSnapshotSchema` with `payload.projection = "chat_response_steps"`

The stream framing remains `data: <ChatEventRecord JSON>\n\n`; no custom SSE `event:` field is introduced. Old consumers may ignore these `node_progress` payloads. New `agent-chat` clients fold them into per-assistant-message quick steps while the reply is running and expandable step details after completion.
```

- [ ] **Step 2: Update frontend docs**

In `docs/apps/frontend/agent-chat/overview.md`, add:

```md
`agent-chat` renders Codex-style assistant response steps from `node_progress` payload projections. Running replies use `QuickResponseSteps`; completed replies use `ResponseStepSummary` with expandable detail rows. The projection folding helper is `src/lib/chat-response-step-projections.ts`, and raw SSE events remain available to the workbench timeline.
```

- [ ] **Step 3: Add backend module note**

Create `docs/apps/backend/agent-server/chat-response-steps.md`:

```md
# Chat Response Steps

状态：snapshot
文档类型：reference
适用范围：`apps/backend/agent-server/src/chat`
最后核对：2026-05-02

`chat-response-steps.adapter.ts` maps existing chat events into `@agent/core` response-step schemas for the frontend chat surface.

The adapter does not own runtime execution. It only projects already-emitted chat/session/tool/approval events into UI-friendly steps:

- incremental payload: `projection = "chat_response_step"`
- snapshot payload: `projection = "chat_response_steps"`

Both payloads are sent as normal `ChatEventRecord` frames, usually with `type = "node_progress"`. Consumers that do not understand the projection can ignore it.

Do not put prompt logic, graph nodes, model parsing, or tool execution in this adapter. Those belong in runtime, agent flows, or tool hosts.
```

- [ ] **Step 4: Update backend overview**

In `docs/apps/backend/agent-server/agent-server-overview.md`, add a short bullet under chat module notes:

```md
- Chat response steps are emitted through `chat-response-steps.adapter.ts` as `node_progress` payload projections. This keeps `/api/chat/stream` wire framing stable while giving `agent-chat` Codex-style quick progress and completed step details.
```

- [ ] **Step 5: Run affected tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/chat-response-step-contracts.test.ts apps/backend/agent-server/test/chat/chat-response-steps.adapter.spec.ts apps/frontend/agent-chat/test/lib/chat-response-step-projections.test.ts apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx apps/frontend/agent-chat/test/hooks/chat-session/chat-session-stream.test.ts apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx
```

Expected: all targeted tests pass.

- [ ] **Step 6: Run required type and package checks**

Run:

```bash
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm build:lib
pnpm --dir apps/backend/agent-server build
pnpm check:docs
```

Expected: all commands pass. If `pnpm build:lib` or backend build is blocked by an unrelated existing red light, record the exact blocker and keep the targeted tests and typechecks green.

- [ ] **Step 7: Review cleanup**

Run:

```bash
rg -n "chat_response_step|ChatResponseStep|responseSteps" packages/core/src apps/backend/agent-server/src apps/frontend/agent-chat/src docs/contracts/api/agent-chat.md docs/apps/frontend/agent-chat docs/apps/backend/agent-server
```

Expected: references are limited to the contract, adapter, projection folding, UI components, integration points, tests, and docs listed in this plan. Remove unused exports, dead helper functions, duplicate style namespaces, or unconnected test fixtures found by this scan.

---

## Execution Notes

- Run this plan in the current checkout. Do not use `git worktree`.
- Do not commit unless the user explicitly asks for commits. If committing later, first read `docs/conventions/github-flow.md`, review the scoped diff, and avoid staging unrelated dirty workspace changes.
- Keep API-compatible behavior: existing `assistant_token`, `assistant_message`, trajectory, approval, and workbench timeline consumers must continue to work.
- Keep UI compact and operational. This is a chat execution surface, not a marketing page.
- After implementation, update this plan's checkboxes or leave a concise completion note in the delivery response that lists completed tasks, verification commands, and any blocked checks.
