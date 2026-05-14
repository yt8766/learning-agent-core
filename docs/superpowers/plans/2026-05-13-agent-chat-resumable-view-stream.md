# Agent Chat Resumable View Stream Implementation Plan

状态：draft
文档类型：plan
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`packages/core`
最后核对：2026-05-13
创建日期：2026-05-13

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/api/chat/view-stream` resumable and idempotent for `agent-chat`, while preserving the project's schema-first `ChatViewStreamEvent` contract and avoiding AI SDK UI protocol leakage.

**Architecture:** Strengthen the existing V2 view stream instead of replacing it. `packages/core` remains the schema source of truth; `agent-server` projects runtime facts into persisted view events through a replaceable repository; `agent-chat` consumes events with `seq`-based dedupe, final content calibration, and reconnect semantics.

**Tech Stack:** TypeScript, Zod, NestJS, Express SSE, React hooks, Vitest, pnpm.

---

## Files And Responsibilities

- Modify: `docs/contracts/api/agent-chat-runtime-v2.md`
  - Canonical API contract for the new resumable view-stream semantics.
- Modify: `packages/core/src/tasking/schemas/chat-view-stream.ts`
  - Schema-first definitions for specific view-stream event payloads.
- Modify: `packages/core/test/chat-runtime-v2-contracts.test.ts`
  - Contract parse tests for new event shapes.
- Create: `apps/backend/agent-server/src/chat/chat-view-stream-event.repository.ts`
  - Replaceable in-memory event repository for `sessionId + runId` ordered view events.
- Create: `apps/backend/agent-server/test/chat/chat-view-stream-event.repository.spec.ts`
  - Repository unit tests.
- Modify: `apps/backend/agent-server/src/chat/chat-view-stream.service.ts`
  - Append and replay projected view events through the repository; subscribe using stable sequence numbers.
- Modify: `apps/backend/agent-server/test/chat/chat-view-stream.service.spec.ts`
  - Service tests for `afterSeq`, replay, subscribe, and close behavior.
- Modify: `apps/backend/agent-server/src/chat/chat-view-stream.controller.ts`
  - Keep explicit SSE framing and make close cleanup safe.
- Modify: `apps/backend/agent-server/test/chat/chat-view-stream.controller.spec.ts`
  - Controller tests for `afterSeq` passthrough and explicit event names.
- Modify: `apps/backend/agent-server/src/chat/chat-view-stream.adapter.ts`
  - Project `fragment_started`, `fragment_completed`, tool execution, auto review, and close events with whitelist payloads.
- Modify: `apps/backend/agent-server/test/chat/chat-view-stream.adapter.spec.ts`
  - Adapter tests for new projection shapes and payload redaction.
- Modify: `apps/frontend/agent-chat/src/hooks/chat-session/use-chat-view-stream.ts`
  - Reducer-level `seq` dedupe, `fragment_completed` calibration, close semantics, and reconnect state.
- Modify: `apps/frontend/agent-chat/src/api/chat-runtime-v2-api.ts`
  - Ensure `afterSeq` path building and parsing remain schema-backed.
- Modify: `apps/frontend/agent-chat/test/hooks/chat-session/use-chat-view-stream.test.ts`
  - Frontend reducer and helper tests for dedupe, calibration, retryable error, cancelled close, and pending interaction.

---

### Task 1: Contract And API Documentation

**Files:**

- Modify: `docs/contracts/api/agent-chat-runtime-v2.md`
- Modify: `packages/core/src/tasking/schemas/chat-view-stream.ts`
- Modify: `packages/core/test/chat-runtime-v2-contracts.test.ts`

- [ ] **Step 1: Extend the contract tests first**

Add tests to `packages/core/test/chat-runtime-v2-contracts.test.ts` for `fragment_started`, `fragment_completed`, `run_status`, `tool_execution_started`, and `tool_execution_completed`.

```ts
it('parses resumable fragment lifecycle view stream events', () => {
  const started = ChatViewStreamEventSchema.parse({
    id: 'view-fragment-started',
    seq: 2,
    sessionId: 'session-1',
    runId: 'run-1',
    event: 'fragment_started',
    at: timestamp,
    data: {
      messageId: 'message-assistant-1',
      fragmentId: 'fragment-response-1',
      kind: 'response',
      status: 'streaming'
    }
  });

  const completed = ChatViewStreamEventSchema.parse({
    id: 'view-fragment-completed',
    seq: 4,
    sessionId: 'session-1',
    runId: 'run-1',
    event: 'fragment_completed',
    at: timestamp,
    data: {
      messageId: 'message-assistant-1',
      fragmentId: 'fragment-response-1',
      kind: 'response',
      status: 'completed',
      content: '最终回答'
    }
  });

  expect(started.data.kind).toBe('response');
  expect(completed.data.content).toBe('最终回答');
});

it('parses tool execution view stream events without raw payload fields', () => {
  const started = ChatViewStreamEventSchema.parse({
    id: 'view-tool-started',
    seq: 5,
    sessionId: 'session-1',
    runId: 'run-1',
    event: 'tool_execution_started',
    at: timestamp,
    data: {
      toolName: 'shell',
      toolDisplayName: 'Shell command',
      stage: 'execute',
      status: 'running',
      riskLevel: 'low',
      userFacingSummary: '正在执行只读验证命令'
    }
  });

  const completed = ChatViewStreamEventSchema.parse({
    id: 'view-tool-completed',
    seq: 6,
    sessionId: 'session-1',
    runId: 'run-1',
    event: 'tool_execution_completed',
    at: timestamp,
    data: {
      toolName: 'shell',
      status: 'completed',
      elapsedMs: 120,
      userFacingSummary: '验证命令已完成'
    }
  });

  expect(started.data).not.toHaveProperty('rawInput');
  expect(completed.data.elapsedMs).toBe(120);
});
```

- [ ] **Step 2: Run the contract tests to verify they fail**

Run:

```bash
pnpm exec vitest packages/core/test/chat-runtime-v2-contracts.test.ts
```

Expected: FAIL because `fragment_started`, structured `fragment_completed`, `tool_execution_started`, and `tool_execution_completed` payload schemas are not strict enough or not present.

- [ ] **Step 3: Implement the schema additions**

Update `packages/core/src/tasking/schemas/chat-view-stream.ts` with explicit payload schemas:

```ts
const ChatViewFragmentKindSchema = z.enum([
  'thinking',
  'response',
  'tool_call',
  'tool_result',
  'evidence',
  'system_note',
  'error'
]);

const ChatViewFragmentStartedDataSchema = z.object({
  messageId: z.string(),
  fragmentId: z.string(),
  kind: ChatViewFragmentKindSchema,
  status: z.literal('streaming'),
  title: z.string().optional()
});

const ChatViewFragmentCompletedDataSchema = z.object({
  messageId: z.string(),
  fragmentId: z.string(),
  kind: ChatViewFragmentKindSchema,
  status: z.enum(['completed', 'failed']),
  content: z.string(),
  elapsedMs: z.number().optional()
});

const ChatViewRunStatusDataSchema = z.object({
  status: z.enum([
    'queued',
    'running',
    'thinking',
    'streaming_response',
    'waiting_interaction',
    'completed',
    'failed',
    'cancelled'
  ]),
  completedAt: z.string().optional(),
  reason: z.string().optional()
});

const ChatViewToolExecutionDataSchema = z.object({
  toolName: z.string(),
  toolDisplayName: z.string().optional(),
  stage: z.string().optional(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  userFacingSummary: z.string(),
  artifactId: z.string().optional(),
  artifactKind: z.string().optional(),
  artifactTitle: z.string().optional(),
  elapsedMs: z.number().optional(),
  references: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        url: z.string().optional(),
        sourceType: z.string().optional()
      })
    )
    .optional()
});
```

Then add dedicated event schemas to the discriminated union:

```ts
export const ChatViewFragmentStartedEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('fragment_started'),
  data: ChatViewFragmentStartedDataSchema
});

export const ChatViewFragmentCompletedEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('fragment_completed'),
  data: ChatViewFragmentCompletedDataSchema
});

export const ChatViewRunStatusEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('run_status'),
  data: ChatViewRunStatusDataSchema
});

export const ChatViewToolExecutionStartedEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('tool_execution_started'),
  data: ChatViewToolExecutionDataSchema
});

export const ChatViewToolExecutionCompletedEventSchema = ChatViewStreamEventBaseSchema.extend({
  event: z.literal('tool_execution_completed'),
  data: ChatViewToolExecutionDataSchema
});
```

- [ ] **Step 4: Update the API contract doc**

Update `docs/contracts/api/agent-chat-runtime-v2.md` to include the resumable semantics from the spec:

```md
### 6.x 恢复与幂等

`afterSeq` 是 `sessionId + runId` 范围内的展示流游标。服务端只补发 `seq > afterSeq` 的 view events；前端必须忽略 `seq <= lastSeq` 的事件。重连只恢复展示，不重新触发 runtime 执行。

`close.reason = "cancelled"` 表示用户或系统已取消 run，前端不得继续自动恢复。
```

- [ ] **Step 5: Run contract and docs checks**

Run:

```bash
pnpm exec vitest packages/core/test/chat-runtime-v2-contracts.test.ts
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 6: Commit this task**

```bash
git add docs/contracts/api/agent-chat-runtime-v2.md packages/core/src/tasking/schemas/chat-view-stream.ts packages/core/test/chat-runtime-v2-contracts.test.ts
git commit -m "feat: define resumable chat view stream contract"
```

---

### Task 2: Backend View Event Repository

**Files:**

- Create: `apps/backend/agent-server/src/chat/chat-view-stream-event.repository.ts`
- Create: `apps/backend/agent-server/test/chat/chat-view-stream-event.repository.spec.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.module.ts`

- [ ] **Step 1: Write failing repository tests**

Create `apps/backend/agent-server/test/chat/chat-view-stream-event.repository.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { ChatViewStreamEventRepository } from '../../src/chat/chat-view-stream-event.repository';

const makeEvent = (seq: number, event = 'fragment_delta') =>
  ({
    id: `view-${seq}`,
    seq,
    event,
    sessionId: 'session-1',
    runId: 'run-1',
    at: '2026-05-13T00:00:00.000Z',
    data:
      event === 'fragment_delta'
        ? { messageId: 'assistant-1', fragmentId: 'fragment-run-1-response', delta: `token-${seq}` }
        : { reason: 'completed' }
  }) as any;

describe('ChatViewStreamEventRepository', () => {
  it('appends and lists events by session, run, and afterSeq', () => {
    const repository = new ChatViewStreamEventRepository();

    repository.append(makeEvent(0));
    repository.append(makeEvent(1));
    repository.append({ ...makeEvent(0), sessionId: 'session-2', runId: 'run-2', id: 'other' });

    expect(repository.list('session-1', 'run-1').map(event => event.seq)).toEqual([0, 1]);
    expect(repository.list('session-1', 'run-1', 0).map(event => event.seq)).toEqual([1]);
  });

  it('returns the last sequence and preserves close events', () => {
    const repository = new ChatViewStreamEventRepository();

    repository.append(makeEvent(0));
    repository.markClosed('session-1', 'run-1', makeEvent(1, 'close'));

    expect(repository.getLastSeq('session-1', 'run-1')).toBe(1);
    expect(repository.list('session-1', 'run-1', 0)[0]?.event).toBe('close');
  });
});
```

- [ ] **Step 2: Run the repository test to verify it fails**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest test/chat/chat-view-stream-event.repository.spec.ts
```

Expected: FAIL because the repository file does not exist.

- [ ] **Step 3: Implement the repository**

Create `apps/backend/agent-server/src/chat/chat-view-stream-event.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import type { ChatViewCloseEvent, ChatViewStreamEvent } from '@agent/core';

@Injectable()
export class ChatViewStreamEventRepository {
  private readonly eventsByRun = new Map<string, ChatViewStreamEvent[]>();

  append(event: ChatViewStreamEvent): ChatViewStreamEvent {
    const key = this.buildKey(event.sessionId, event.runId);
    const events = this.eventsByRun.get(key) ?? [];
    const existing = events.find(candidate => candidate.id === event.id);
    if (existing) {
      return existing;
    }
    events.push(event);
    events.sort((left, right) => left.seq - right.seq);
    this.eventsByRun.set(key, events);
    return event;
  }

  list(sessionId: string, runId: string, afterSeq?: number): ChatViewStreamEvent[] {
    const events = this.eventsByRun.get(this.buildKey(sessionId, runId)) ?? [];
    return typeof afterSeq === 'number' ? events.filter(event => event.seq > afterSeq) : [...events];
  }

  getLastSeq(sessionId: string, runId: string): number {
    const events = this.eventsByRun.get(this.buildKey(sessionId, runId)) ?? [];
    return events.length > 0 ? events[events.length - 1].seq : -1;
  }

  markClosed(sessionId: string, runId: string, closeEvent: ChatViewCloseEvent): ChatViewStreamEvent {
    return this.append(closeEvent);
  }

  private buildKey(sessionId: string, runId: string): string {
    return `${sessionId}:${runId}`;
  }
}
```

- [ ] **Step 4: Register the repository provider**

Update `apps/backend/agent-server/src/chat/chat.module.ts` and add `ChatViewStreamEventRepository` to providers.

```ts
import { ChatViewStreamEventRepository } from './chat-view-stream-event.repository';

@Module({
  providers: [
    ChatViewStreamEventRepository,
    ChatViewStreamService
  ]
})
```

Keep existing providers; only add the new repository.

- [ ] **Step 5: Run repository tests**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest test/chat/chat-view-stream-event.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit this task**

```bash
git add apps/backend/agent-server/src/chat/chat-view-stream-event.repository.ts apps/backend/agent-server/src/chat/chat.module.ts apps/backend/agent-server/test/chat/chat-view-stream-event.repository.spec.ts
git commit -m "feat: add chat view stream event repository"
```

---

### Task 3: Backend Service Replay And Subscribe Semantics

**Files:**

- Modify: `apps/backend/agent-server/src/chat/chat-view-stream.service.ts`
- Modify: `apps/backend/agent-server/test/chat/chat-view-stream.service.spec.ts`
- Modify: `apps/backend/agent-server/test/chat/chat-view-stream.controller.spec.ts`

- [ ] **Step 1: Write failing service tests**

Update `apps/backend/agent-server/test/chat/chat-view-stream.service.spec.ts` so `createService` injects the repository:

```ts
const repository = {
  append: vi.fn(),
  list: vi.fn().mockReturnValue([]),
  getLastSeq: vi.fn().mockReturnValue(-1),
  markClosed: vi.fn()
};
const service = new ChatViewStreamService(runtimeSessionService as never, chatRunService as never, repository as never);
```

Add this test:

```ts
it('replays persisted view events by afterSeq without reprojecting history', () => {
  const { service, repository, runtimeSessionService } = createService();
  repository.list.mockReturnValue([{ id: 'view-2', seq: 2, event: 'close' }]);

  const events = service.listEvents('s-1', 'run-1', 1);

  expect(events).toEqual([{ id: 'view-2', seq: 2, event: 'close' }]);
  expect(repository.list).toHaveBeenCalledWith('s-1', 'run-1', 1);
  expect(runtimeSessionService.listSessionEvents).not.toHaveBeenCalled();
});
```

Add this subscribe test:

```ts
it('appends projected realtime events before forwarding them to listeners', () => {
  const { service, repository, runtimeSessionService } = createService();
  const listener = vi.fn();
  let capturedCallback: (event: unknown) => void = () => undefined;

  repository.getLastSeq.mockReturnValue(4);
  runtimeSessionService.subscribeSession.mockImplementation((_sessionId, callback) => {
    capturedCallback = callback;
    return vi.fn();
  });

  service.subscribe('s-1', 'run-1', listener, 3);
  capturedCallback({
    id: 'source-1',
    type: 'assistant_token',
    sessionId: 's-1',
    at: '2026-05-13T00:00:00.000Z',
    payload: { messageId: 'assistant-1', token: 'hi' }
  });

  expect(repository.append).toHaveBeenCalled();
  expect(listener).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run service tests to verify failure**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest test/chat/chat-view-stream.service.spec.ts
```

Expected: FAIL because the service constructor and repository usage are not implemented.

- [ ] **Step 3: Update service implementation**

Update `apps/backend/agent-server/src/chat/chat-view-stream.service.ts`:

```ts
constructor(
  private readonly runtimeSessionService: RuntimeSessionService,
  private readonly chatRunService: ChatRunService,
  private readonly viewEventRepository: ChatViewStreamEventRepository
) {}

listEvents(sessionId: string, runId: string, afterSeq?: number): ChatViewStreamEvent[] {
  const run = this.getRunForSession(sessionId, runId);
  this.backfillSessionEvents(sessionId, run);
  return this.viewEventRepository.list(sessionId, runId, afterSeq);
}

subscribe(
  sessionId: string,
  runId: string,
  listener: (event: ChatViewStreamEvent) => void,
  afterSeq?: number
): () => void {
  const run = this.getRunForSession(sessionId, runId);
  this.backfillSessionEvents(sessionId, run);

  return this.runtimeSessionService.subscribeSession(sessionId, sourceEvent => {
    const projectedEvents = this.projectAndAppend([sourceEvent], run);
    for (const projectedEvent of projectedEvents) {
      if (typeof afterSeq !== 'number' || projectedEvent.seq > afterSeq) {
        listener(projectedEvent);
      }
    }
  });
}
```

Add the missing import:

```ts
import { ChatViewStreamEventRepository } from './chat-view-stream-event.repository';
```

- [ ] **Step 4: Update controller test for `afterSeq` passthrough**

Add to `apps/backend/agent-server/test/chat/chat-view-stream.controller.spec.ts`:

```ts
it('passes parsed afterSeq to list and subscribe', () => {
  const service = {
    listEvents: vi.fn(() => []),
    subscribe: vi.fn(() => vi.fn())
  };
  const controller = new ChatViewStreamController(service as never);
  const response = createSseResponse();
  const request = { on: vi.fn() };

  controller.stream(request as never, response as never, 'session-1', 'run-1', '7');

  expect(service.listEvents).toHaveBeenCalledWith('session-1', 'run-1', 7);
  expect(service.subscribe).toHaveBeenCalledWith('session-1', 'run-1', expect.any(Function), 7);
});
```

- [ ] **Step 5: Run backend chat view-stream tests**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest test/chat/chat-view-stream-event.repository.spec.ts test/chat/chat-view-stream.service.spec.ts test/chat/chat-view-stream.controller.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit this task**

```bash
git add apps/backend/agent-server/src/chat/chat-view-stream.service.ts apps/backend/agent-server/test/chat/chat-view-stream.service.spec.ts apps/backend/agent-server/test/chat/chat-view-stream.controller.spec.ts
git commit -m "feat: make chat view stream replayable"
```

---

### Task 4: Backend Projection Adapter Events And Whitelisting

**Files:**

- Modify: `apps/backend/agent-server/src/chat/chat-view-stream.adapter.ts`
- Modify: `apps/backend/agent-server/test/chat/chat-view-stream.adapter.spec.ts`

- [ ] **Step 1: Write failing adapter tests**

Add a test for fragment lifecycle:

```ts
it('projects final assistant response into fragment completion, run status, and close', () => {
  const events = projectChatViewStreamEvents(
    [
      {
        id: 'event-final',
        type: 'final_response_completed',
        sessionId: 'session-1',
        at: '2026-05-13T00:00:00.000Z',
        payload: { messageId: 'assistant-1', content: '最终回答' }
      } as ChatEventRecord
    ],
    { run, nextSeq: 10 }
  );

  expect(events.map(event => event.event)).toEqual(['fragment_completed', 'run_status', 'close']);
  expect(events[0]).toMatchObject({
    seq: 10,
    event: 'fragment_completed',
    data: {
      messageId: 'assistant-1',
      kind: 'response',
      status: 'completed',
      content: '最终回答'
    }
  });
});
```

Add a test for tool payload whitelisting:

```ts
it('projects tool execution events with whitelisted payload fields only', () => {
  const events = projectChatViewStreamEvents(
    [
      {
        id: 'event-tool',
        type: 'tool_stream_dispatched',
        sessionId: 'session-1',
        at: '2026-05-13T00:00:00.000Z',
        payload: {
          toolName: 'shell',
          toolDisplayName: 'Shell',
          command: 'cat secret.txt',
          rawInput: { token: 'secret' },
          userFacingSummary: '正在执行只读命令',
          riskLevel: 'low'
        }
      } as ChatEventRecord
    ],
    { run, nextSeq: 1 }
  );

  expect(events[0]).toMatchObject({
    event: 'tool_execution_started',
    data: {
      toolName: 'shell',
      toolDisplayName: 'Shell',
      status: 'running',
      riskLevel: 'low',
      userFacingSummary: '正在执行只读命令'
    }
  });
  expect(events[0]?.data).not.toHaveProperty('rawInput');
  expect(events[0]?.data).not.toHaveProperty('command');
});
```

- [ ] **Step 2: Run adapter tests to verify failure**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest test/chat/chat-view-stream.adapter.spec.ts
```

Expected: FAIL until adapter maps the new event shapes and whitelist rules.

- [ ] **Step 3: Implement projection helpers**

In `apps/backend/agent-server/src/chat/chat-view-stream.adapter.ts`, add helpers:

```ts
function buildToolExecutionData(sourceEvent: ChatEventRecord, status: 'running' | 'completed' | 'failed') {
  return {
    toolName: readPayloadString(sourceEvent, ['toolName', 'name']) || 'tool',
    toolDisplayName: readPayloadString(sourceEvent, ['toolDisplayName', 'displayName']) || undefined,
    stage: readPayloadString(sourceEvent, ['stage']) || undefined,
    status,
    riskLevel: readRiskLevel(sourceEvent),
    userFacingSummary:
      readPayloadString(sourceEvent, ['userFacingSummary', 'summary']) ||
      (status === 'running' ? '工具正在执行。' : '工具执行已结束。'),
    artifactId: readPayloadString(sourceEvent, ['artifactId']) || undefined,
    artifactKind: readPayloadString(sourceEvent, ['artifactKind']) || undefined,
    artifactTitle: readPayloadString(sourceEvent, ['artifactTitle']) || undefined,
    elapsedMs: readPayloadNumber(sourceEvent, ['elapsedMs'])
  };
}

function readPayloadNumber(sourceEvent: ChatEventRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = sourceEvent.payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function readRiskLevel(sourceEvent: ChatEventRecord): 'low' | 'medium' | 'high' | 'critical' | undefined {
  const value = readPayloadString(sourceEvent, ['riskLevel', 'riskClass']);
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : undefined;
}
```

Add cases to `projectSingleChatViewStreamEvent`:

```ts
case 'tool_stream_dispatched':
  return [
    {
      event: 'tool_execution_started',
      data: buildToolExecutionData(sourceEvent, 'running')
    }
  ];
case 'tool_stream_completed':
  return [
    {
      event: 'tool_execution_completed',
      data: buildToolExecutionData(sourceEvent, 'completed')
    }
  ];
```

- [ ] **Step 4: Ensure final response still closes the stream**

Keep the existing final-response projection order:

```ts
['fragment_completed', 'run_status', 'close'];
```

Do not emit `close` for non-terminal tool events.

- [ ] **Step 5: Run adapter tests**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest test/chat/chat-view-stream.adapter.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit this task**

```bash
git add apps/backend/agent-server/src/chat/chat-view-stream.adapter.ts apps/backend/agent-server/test/chat/chat-view-stream.adapter.spec.ts
git commit -m "feat: project chat view stream tool events"
```

---

### Task 5: Frontend Reducer Dedupe, Calibration, And Close Semantics

**Files:**

- Modify: `apps/frontend/agent-chat/src/hooks/chat-session/use-chat-view-stream.ts`
- Modify: `apps/frontend/agent-chat/test/hooks/chat-session/use-chat-view-stream.test.ts`
- Modify: `apps/frontend/agent-chat/src/api/chat-runtime-v2-api.ts`

- [ ] **Step 1: Write failing frontend reducer tests**

Add duplicate seq test:

```ts
it('ignores duplicate or older sequence events', () => {
  const state1 = applyChatViewStreamEvent(createInitialChatViewStreamState(), {
    event: 'fragment_delta',
    id: 'view-2',
    seq: 2,
    sessionId: 'session-1',
    runId: 'run-1',
    at,
    data: { messageId: 'assistant-1', fragmentId: 'frag-1', delta: 'A' }
  });

  const state2 = applyChatViewStreamEvent(state1, {
    event: 'fragment_delta',
    id: 'view-2-duplicate',
    seq: 2,
    sessionId: 'session-1',
    runId: 'run-1',
    at,
    data: { messageId: 'assistant-1', fragmentId: 'frag-1', delta: 'A' }
  });

  expect(state2.fragments['frag-1'].content).toBe('A');
  expect(state2.lastSeq).toBe(2);
});
```

Add completion calibration test:

```ts
it('calibrates assistant content with fragment_completed', () => {
  const streamed = applyChatViewStreamEvent(createInitialChatViewStreamState(), {
    event: 'fragment_delta',
    id: 'view-1',
    seq: 1,
    sessionId: 'session-1',
    runId: 'run-1',
    at,
    data: { messageId: 'assistant-1', fragmentId: 'frag-1', delta: '不完整' }
  });

  const completed = applyChatViewStreamEvent(streamed, {
    event: 'fragment_completed',
    id: 'view-2',
    seq: 2,
    sessionId: 'session-1',
    runId: 'run-1',
    at,
    data: {
      messageId: 'assistant-1',
      fragmentId: 'frag-1',
      kind: 'response',
      status: 'completed',
      content: '完整最终回答'
    }
  });

  expect(completed.fragments['frag-1'].content).toBe('完整最终回答');
  expect(completed.messages[0]?.content).toBe('完整最终回答');
});
```

Add cancelled close test:

```ts
it('marks cancelled close as non-resumable', () => {
  const state = applyChatViewStreamEvent(createInitialChatViewStreamState(), {
    event: 'close',
    id: 'view-close-cancelled',
    seq: 3,
    sessionId: 'session-1',
    runId: 'run-1',
    at,
    data: { reason: 'cancelled', retryable: false, autoResume: false }
  });

  expect(state.status).toBe('closed');
  expect(state.close).toEqual({ reason: 'cancelled', retryable: false, autoResume: false });
});
```

- [ ] **Step 2: Run frontend tests to verify failure**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest test/hooks/chat-session/use-chat-view-stream.test.ts
```

Expected: FAIL because duplicate seq and `fragment_completed` calibration are not implemented.

- [ ] **Step 3: Implement reducer dedupe**

At the top of `applyChatViewStreamEvent`, add:

```ts
if (typeof state.lastSeq === 'number' && event.seq <= state.lastSeq) {
  return state;
}
```

Keep the existing `baseState.lastSeq = event.seq` for accepted events.

- [ ] **Step 4: Implement `fragment_completed` handling**

Add a reducer case in `apps/frontend/agent-chat/src/hooks/chat-session/use-chat-view-stream.ts`:

```ts
case 'fragment_completed': {
  const nextFragments = {
    ...state.fragments,
    [event.data.fragmentId]: {
      id: event.data.fragmentId,
      messageId: event.data.messageId,
      content: event.data.content
    }
  };

  return {
    ...baseState,
    fragments: nextFragments,
    messages: upsertAssistantMessage(baseState.messages, {
      id: event.data.messageId,
      sessionId: event.sessionId,
      content: event.data.content,
      createdAt: event.at
    })
  };
}
```

- [ ] **Step 5: Preserve pending and close behavior**

Ensure existing `interaction_waiting`, `error`, and `close` cases continue to work. Do not auto-reconnect from inside `applyChatViewStreamEvent`; the hook effect can reconnect later using `lastSeq`.

- [ ] **Step 6: Run frontend reducer tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest test/hooks/chat-session/use-chat-view-stream.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit this task**

```bash
git add apps/frontend/agent-chat/src/hooks/chat-session/use-chat-view-stream.ts apps/frontend/agent-chat/src/api/chat-runtime-v2-api.ts apps/frontend/agent-chat/test/hooks/chat-session/use-chat-view-stream.test.ts
git commit -m "feat: dedupe chat view stream events"
```

---

### Task 6: End-To-End Verification, Docs Cleanup, And Final Checks

**Files:**

- Modify: `docs/contracts/api/agent-chat-runtime-v2.md`
- Modify if needed: `docs/integration/frontend-backend-integration.md`
- Modify if needed: `docs/conventions/frontend-conventions.md`
- Modify if needed: `docs/superpowers/specs/2026-05-13-agent-chat-resumable-view-stream-design.md`

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm exec vitest packages/core/test/chat-runtime-v2-contracts.test.ts
pnpm --dir apps/backend/agent-server exec vitest test/chat/chat-view-stream-event.repository.spec.ts test/chat/chat-view-stream.service.spec.ts test/chat/chat-view-stream.controller.spec.ts test/chat/chat-view-stream.adapter.spec.ts
pnpm --dir apps/frontend/agent-chat exec vitest test/hooks/chat-session/use-chat-view-stream.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript checks for affected packages**

Run:

```bash
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 3: Scan docs for outdated stream descriptions**

Run:

```bash
rg -n "view-stream|afterSeq|assistant_token|resumable|EventSource|/api/chat/stream" docs AGENTS.md apps/*/README.md packages/*/README.md
```

Update any description that says `/api/chat/stream` is the primary UI display stream. The correct wording is:

```md
`/api/chat/view-stream` is the UI projection stream for `agent-chat`; `/api/chat/stream` remains the legacy/domain fact stream for compatibility and governance.
```

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 5: Run affected build checks**

Because this touches `packages/*`, backend, and frontend contracts, run:

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

Expected: PASS. If either command fails for an existing unrelated red light, record the blocker, then keep the targeted tests and type checks as the minimum proof for this change.

- [ ] **Step 6: Commit final documentation and cleanup**

```bash
git add docs/contracts/api/agent-chat-runtime-v2.md docs/integration/frontend-backend-integration.md docs/conventions/frontend-conventions.md docs/superpowers/specs/2026-05-13-agent-chat-resumable-view-stream-design.md
git commit -m "docs: document resumable chat view stream"
```

Only include files that actually changed.

---

## Completion Criteria

- `ChatViewStreamEvent` contract includes strict schemas for resumable fragment lifecycle and tool execution events.
- `ChatViewStreamService` replays from a repository instead of reprojecting all runtime events per request.
- `afterSeq` returns only `seq > afterSeq`.
- Realtime subscription appends events before forwarding them.
- Frontend reducer ignores duplicate or older seq values.
- `fragment_completed` calibrates final assistant content.
- `close.reason = "cancelled"` does not trigger auto-resume behavior.
- Tool execution view events contain only whitelisted fields.
- Old `/api/chat/stream` remains compatible and is not expanded as the new UI stream.
- Docs and tests pass for the affected scope.
