# Agent Chat Inline Agent OS Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/core`、`apps/backend/agent-server`、`apps/frontend/agent-chat`、`docs/contracts/api`、`docs/apps/frontend/agent-chat`
最后核对：2026-05-03

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `agent-chat` choose between ordinary `已思考` replies and inline `处理中 / 已处理` Agent OS execution replies, with execution details visible inside the chat message rather than in a right-side drawer.

**Architecture:** Extend the schema-first `ChatResponseStep` contract with optional display mode and Agent OS groups, map backend response-step events into those groups, and let the frontend render either `MessageThinkingPanel` or a new inline `AgentOsRunPanel`. The implementation stays backward compatible by deriving groups on the frontend when older snapshots do not include the new fields.

**Tech Stack:** TypeScript, Zod, `@agent/core` contracts, NestJS backend chat adapter, React, Vitest, Sass through `apps/frontend/agent-chat/src/styles/chat-home-page.scss`, pnpm workspace commands.

---

## Current Baseline

- `packages/core/src/tasking/schemas/chat-response-step.ts` already defines `ChatResponseStepRecordSchema`, `ChatResponseStepSummarySchema`, `ChatResponseStepSnapshotSchema`, and `ChatResponseStepEventSchema`.
- `apps/backend/agent-server/src/chat/chat-response-steps.adapter.ts` maps existing chat events to response-step projections but still surfaces internal labels such as `ownerLabel`, `agentLabel`, `nodeLabel`, `nodeId`, and `final_response_completed`.
- `apps/frontend/agent-chat/src/lib/chat-response-step-projections.ts` folds events and snapshots into `ChatResponseStepsForMessage`.
- `apps/frontend/agent-chat/src/components/chat-response-steps/quick-response-steps.tsx` and `response-step-summary.tsx` render the current UI. Completed summaries are currently expanded by default.
- `apps/frontend/agent-chat/src/pages/chat/chat-message-response-steps.tsx` chooses `QuickResponseSteps` or `ResponseStepSummary` based only on completion status.
- `apps/frontend/agent-chat/src/pages/chat/message-thinking-panel.tsx` already handles ordinary thinking display.
- The repository forbids `git worktree`; run this plan in the current checkout only.

## File Structure

Files to modify:

```text
packages/core/src/tasking/schemas/chat-response-step.ts
packages/core/src/tasking/types/chat-response-step.ts
packages/core/test/chat-response-step-contracts.test.ts

apps/backend/agent-server/src/chat/chat-response-steps.adapter.ts
apps/backend/agent-server/test/chat/chat-response-step-projections.spec.ts

apps/frontend/agent-chat/src/lib/chat-response-step-projections.ts
apps/frontend/agent-chat/src/components/chat-response-steps/quick-response-steps.tsx
apps/frontend/agent-chat/src/components/chat-response-steps/response-step-summary.tsx
apps/frontend/agent-chat/src/components/chat-response-steps/response-step-detail.tsx
apps/frontend/agent-chat/src/components/chat-response-steps/index.ts
apps/frontend/agent-chat/src/pages/chat/chat-message-response-steps.tsx
apps/frontend/agent-chat/src/styles/chat-home-page.scss
apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx
apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx

docs/apps/frontend/agent-chat/overview.md
docs/apps/frontend/agent-chat/README.md
docs/contracts/api/agent-chat.md
docs/superpowers/specs/2026-05-02-agent-chat-codex-response-steps-design.md
```

Files to create:

```text
apps/frontend/agent-chat/src/components/chat-response-steps/agent-os-run-panel.tsx
apps/frontend/agent-chat/src/components/chat-response-steps/agent-os-group.tsx
apps/frontend/agent-chat/src/components/chat-response-steps/agent-os-step-item.tsx
```

Boundary decisions:

- `packages/core` owns stable schemas and inferred types only.
- `agent-server` owns event-to-Agent-OS grouping and user-readable backend summaries.
- `agent-chat` owns final fallback grouping, display-mode fallback, and chat rendering.
- Right-side Runtime Drawer and advanced panels are not the core path for this feature.

---

### Task 1: Extend Core Response-Step Contract

**Files:**

- Modify: `packages/core/src/tasking/schemas/chat-response-step.ts`
- Modify: `packages/core/src/tasking/types/chat-response-step.ts`
- Test: `packages/core/test/chat-response-step-contracts.test.ts`

- [ ] **Step 1: Write the failing contract test**

Append these tests to `packages/core/test/chat-response-step-contracts.test.ts` inside the existing `describe` block for chat response steps, or create a new `describe('chat response step Agent OS contract', ...)` in the same file:

```ts
import { describe, expect, it } from 'vitest';
import { ChatResponseStepSnapshotSchema } from '../src/tasking/schemas/chat-response-step';

const baseStep = {
  id: 'step-1',
  sessionId: 'session-1',
  messageId: 'assistant-1',
  sequence: 0,
  phase: 'execute',
  status: 'completed',
  title: 'Ran agent-chat tests',
  target: {
    kind: 'command',
    label: 'pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx'
  },
  startedAt: '2026-05-03T08:00:00.000Z',
  completedAt: '2026-05-03T08:00:05.000Z',
  sourceEventId: 'event-1',
  sourceEventType: 'execution_step_completed'
} as const;

describe('chat response step Agent OS contract', () => {
  it('parses optional display mode and Agent OS groups on snapshots', () => {
    const parsed = ChatResponseStepSnapshotSchema.parse({
      projection: 'chat_response_steps',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      displayMode: 'agent_execution',
      steps: [baseStep],
      agentOsGroups: [
        {
          kind: 'execution',
          title: '执行',
          summary: 'Ran 1 command',
          status: 'completed',
          steps: [baseStep]
        }
      ],
      summary: {
        title: '已处理 5s',
        completedCount: 1,
        runningCount: 0,
        blockedCount: 0,
        failedCount: 0
      },
      updatedAt: '2026-05-03T08:00:05.000Z'
    });

    expect(parsed.displayMode).toBe('agent_execution');
    expect(parsed.agentOsGroups?.[0]?.kind).toBe('execution');
  });

  it('rejects Agent OS group steps from another message', () => {
    const result = ChatResponseStepSnapshotSchema.safeParse({
      projection: 'chat_response_steps',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      displayMode: 'agent_execution',
      steps: [baseStep],
      agentOsGroups: [
        {
          kind: 'execution',
          title: '执行',
          status: 'completed',
          steps: [{ ...baseStep, messageId: 'assistant-2' }]
        }
      ],
      summary: {
        title: '已处理 5s',
        completedCount: 1,
        runningCount: 0,
        blockedCount: 0,
        failedCount: 0
      },
      updatedAt: '2026-05-03T08:00:05.000Z'
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain(
      'Agent OS group step messageId must match snapshot messageId.'
    );
  });
});
```

- [ ] **Step 2: Run the failing contract test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/chat-response-step-contracts.test.ts
```

Expected: FAIL because `displayMode` and `agentOsGroups` are unknown fields on `ChatResponseStepSnapshotSchema`.

- [ ] **Step 3: Add schema enums and group schema**

In `packages/core/src/tasking/schemas/chat-response-step.ts`, add these exports after `ChatResponseStepAgentScopeSchema`:

```ts
export const ChatTurnDisplayModeSchema = z.enum(['answer_only', 'agent_execution']);

export const ChatAgentOsGroupKindSchema = z.enum([
  'thinking',
  'exploration',
  'execution',
  'collaboration',
  'verification',
  'delivery'
]);
```

Add this schema after `ChatResponseStepSummarySchema`:

```ts
export const ChatAgentOsGroupSchema = z
  .object({
    kind: ChatAgentOsGroupKindSchema,
    title: z.string().min(1),
    summary: z.string().min(1).optional(),
    status: ChatResponseStepStatusSchema,
    steps: z.array(ChatResponseStepRecordSchema)
  })
  .strict();
```

Update `ChatResponseStepSnapshotSchema` object with these optional fields:

```ts
displayMode: ChatTurnDisplayModeSchema.optional(),
agentOsGroups: z.array(ChatAgentOsGroupSchema).optional(),
```

Inside the existing `superRefine`, after the current `snapshot.steps.forEach(...)`, add:

```ts
snapshot.agentOsGroups?.forEach((group, groupIndex) => {
  group.steps.forEach((step, stepIndex) => {
    if (step.sessionId !== snapshot.sessionId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agentOsGroups', groupIndex, 'steps', stepIndex, 'sessionId'],
        message: 'Agent OS group step sessionId must match snapshot sessionId.'
      });
    }

    if (step.messageId !== snapshot.messageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agentOsGroups', groupIndex, 'steps', stepIndex, 'messageId'],
        message: 'Agent OS group step messageId must match snapshot messageId.'
      });
    }
  });
});
```

- [ ] **Step 4: Export inferred types**

In `packages/core/src/tasking/types/chat-response-step.ts`, extend the import list:

```ts
  ChatAgentOsGroupKindSchema,
  ChatAgentOsGroupSchema,
  ChatTurnDisplayModeSchema,
```

Add inferred types:

```ts
export type ChatTurnDisplayMode = z.infer<typeof ChatTurnDisplayModeSchema>;
export type ChatAgentOsGroupKind = z.infer<typeof ChatAgentOsGroupKindSchema>;
export type ChatAgentOsGroup = z.infer<typeof ChatAgentOsGroupSchema>;
```

- [ ] **Step 5: Run contract verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/chat-response-step-contracts.test.ts
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
```

Expected: PASS for the test file and PASS for core typecheck.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add packages/core/src/tasking/schemas/chat-response-step.ts packages/core/src/tasking/types/chat-response-step.ts packages/core/test/chat-response-step-contracts.test.ts
git commit -m "feat: extend chat response step agent os contract"
```

---

### Task 2: Map Backend Steps Into Agent OS Groups

**Files:**

- Modify: `apps/backend/agent-server/src/chat/chat-response-steps.adapter.ts`
- Test: `apps/backend/agent-server/test/chat/chat-response-step-projections.spec.ts`

- [ ] **Step 1: Write failing backend projection tests**

Append these tests to `apps/backend/agent-server/test/chat/chat-response-step-projections.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildChatResponseStepEvent, buildChatResponseStepSnapshot } from '../../src/chat/chat-response-steps.adapter';

const at = '2026-05-03T09:00:00.000Z';

describe('chat response steps Agent OS grouping', () => {
  it('marks snapshots with command and verification steps as agent execution', () => {
    const command = buildChatResponseStepEvent(
      {
        id: 'event-command',
        sessionId: 'session-1',
        type: 'execution_step_started',
        at,
        payload: {
          title: 'Ran pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx',
          command: 'pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx'
        }
      },
      { messageId: 'assistant-1', sequence: 0 }
    )?.step;

    const finished = buildChatResponseStepEvent(
      {
        id: 'event-final',
        sessionId: 'session-1',
        type: 'final_response_completed',
        at,
        payload: { title: '整理最终回复' }
      },
      { messageId: 'assistant-1', sequence: 1 }
    )?.step;

    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      steps: [command!, finished!],
      updatedAt: at
    });

    expect(snapshot.displayMode).toBe('agent_execution');
    expect(snapshot.summary.title).toBe('已处理 1 个动作');
    expect(snapshot.agentOsGroups?.map(group => group.kind)).toEqual(['execution', 'delivery']);
  });

  it('keeps final-response-only snapshots as answer only', () => {
    const finished = buildChatResponseStepEvent(
      {
        id: 'event-final-only',
        sessionId: 'session-1',
        type: 'final_response_completed',
        at,
        payload: {}
      },
      { messageId: 'assistant-1', sequence: 0 }
    )?.step;

    const snapshot = buildChatResponseStepSnapshot({
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      steps: [finished!],
      updatedAt: at
    });

    expect(snapshot.displayMode).toBe('answer_only');
    expect(snapshot.agentOsGroups).toEqual([]);
    expect(snapshot.summary.title).not.toContain('1 个步骤');
  });
});
```

- [ ] **Step 2: Run the failing backend tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/chat/chat-response-step-projections.spec.ts
```

Expected: FAIL because snapshots do not include `displayMode`, `agentOsGroups`, or the new low-value-step summary behavior.

- [ ] **Step 3: Add grouping helpers**

In `apps/backend/agent-server/src/chat/chat-response-steps.adapter.ts`, import the new types:

```ts
  type ChatAgentOsGroup,
  type ChatAgentOsGroupKind,
  type ChatTurnDisplayMode
```

Add these helpers near `appendDuration`:

```ts
function resolveDisplayMode(steps: ChatResponseStepRecord[]): ChatTurnDisplayMode {
  return hasExecutionSignal(steps) ? 'agent_execution' : 'answer_only';
}

function hasExecutionSignal(steps: ChatResponseStepRecord[]) {
  return steps.some(step => {
    if (step.sourceEventType === 'final_response_completed' || step.sourceEventType === 'session_finished') {
      return false;
    }
    return (
      step.target?.kind === 'command' ||
      step.target?.kind === 'file' ||
      step.target?.kind === 'approval' ||
      step.target?.kind === 'test' ||
      step.phase === 'execute' ||
      step.phase === 'edit' ||
      step.phase === 'verify' ||
      step.agentScope === 'sub'
    );
  });
}

function buildAgentOsGroups(steps: ChatResponseStepRecord[], displayMode: ChatTurnDisplayMode): ChatAgentOsGroup[] {
  if (displayMode === 'answer_only') {
    return [];
  }

  const groups = new Map<ChatAgentOsGroupKind, ChatResponseStepRecord[]>();
  steps.forEach(step => {
    const kind = resolveAgentOsGroupKind(step);
    groups.set(kind, [...(groups.get(kind) ?? []), toUserReadableStep(step)]);
  });

  const orderedKinds: ChatAgentOsGroupKind[] = [
    'thinking',
    'exploration',
    'execution',
    'collaboration',
    'verification',
    'delivery'
  ];

  return orderedKinds.flatMap(kind => {
    const groupSteps = groups.get(kind) ?? [];
    if (groupSteps.length === 0) {
      return [];
    }

    return [
      {
        kind,
        title: resolveAgentOsGroupTitle(kind),
        summary: summarizeAgentOsGroup(kind, groupSteps),
        status: deriveGroupStatus(groupSteps),
        steps: groupSteps
      }
    ];
  });
}

function resolveAgentOsGroupKind(step: ChatResponseStepRecord): ChatAgentOsGroupKind {
  if (step.agentScope === 'sub') return 'collaboration';
  if (
    step.phase === 'context' ||
    step.phase === 'explore' ||
    step.target?.kind === 'file' ||
    step.target?.kind === 'url'
  ) {
    return 'exploration';
  }
  if (step.phase === 'approve' || step.phase === 'verify' || step.target?.kind === 'test') return 'verification';
  if (step.phase === 'execute' || step.phase === 'edit' || step.target?.kind === 'command') return 'execution';
  if (step.phase === 'summarize') return 'delivery';
  return 'thinking';
}

function resolveAgentOsGroupTitle(kind: ChatAgentOsGroupKind) {
  const titles: Record<ChatAgentOsGroupKind, string> = {
    thinking: '思考',
    exploration: '探索',
    execution: '执行',
    collaboration: '协作',
    verification: '验证',
    delivery: '交付'
  };
  return titles[kind];
}

function summarizeAgentOsGroup(kind: ChatAgentOsGroupKind, steps: ChatResponseStepRecord[]) {
  if (kind === 'execution') {
    const commandCount = steps.filter(step => step.target?.kind === 'command').length;
    return commandCount > 0
      ? `Ran ${commandCount} command${commandCount > 1 ? 's' : ''}`
      : `执行 ${steps.length} 个动作`;
  }
  if (kind === 'exploration') return `已查看 ${steps.length} 个上下文`;
  if (kind === 'collaboration') return `协作 ${steps.length} 项`;
  if (kind === 'verification') return `验证 ${steps.length} 项`;
  if (kind === 'delivery') return '最终交付已整理';
  return `思考 ${steps.length} 项`;
}

function deriveGroupStatus(steps: ChatResponseStepRecord[]): ChatResponseStepRecord['status'] {
  if (steps.some(step => step.status === 'failed')) return 'failed';
  if (steps.some(step => step.status === 'blocked')) return 'blocked';
  if (steps.some(step => step.status === 'cancelled')) return 'cancelled';
  if (steps.some(step => step.status === 'running' || step.status === 'queued')) return 'running';
  return 'completed';
}

function toUserReadableStep(step: ChatResponseStepRecord): ChatResponseStepRecord {
  return {
    ...step,
    title: userReadableTitle(step),
    nodeId: undefined,
    nodeLabel: undefined,
    fromNodeId: undefined,
    toNodeId: undefined
  };
}

function userReadableTitle(step: ChatResponseStepRecord) {
  if (step.sourceEventType === 'final_response_completed' || step.sourceEventType === 'session_finished') {
    return '最终回复完成';
  }
  if (step.target?.kind === 'command') return step.title;
  if (step.target?.kind === 'file') return `查看 ${step.target.label}`;
  if (step.agentScope === 'sub') return step.agentLabel ? `${step.agentLabel} 完成协作任务` : '子 Agent 完成协作任务';
  return step.title;
}
```

- [ ] **Step 4: Include display mode and groups in snapshots**

Update `buildChatResponseStepSnapshot`:

```ts
export function buildChatResponseStepSnapshot(input: BuildSnapshotInput): ChatResponseStepSnapshot {
  const completedCount = input.steps.filter(step => step.status === 'completed').length;
  const runningCount = input.steps.filter(step => step.status === 'running' || step.status === 'queued').length;
  const blockedCount = input.steps.filter(step => step.status === 'blocked').length;
  const failedCount = input.steps.filter(step => step.status === 'failed').length;
  const displayMode = resolveDisplayMode(input.steps);
  const agentOsGroups = buildAgentOsGroups(input.steps, displayMode);
  const visibleActionCount =
    displayMode === 'agent_execution' ? agentOsGroups.reduce((total, group) => total + group.steps.length, 0) : 0;

  return ChatResponseStepSnapshotSchema.parse({
    projection: 'chat_response_steps',
    sessionId: input.sessionId,
    messageId: input.messageId,
    status: input.status,
    displayMode,
    steps: input.steps,
    agentOsGroups,
    summary: {
      title:
        displayMode === 'answer_only'
          ? '已思考'
          : input.status === 'completed'
            ? appendDuration(`已处理 ${visibleActionCount} 个动作`, input.steps)
            : appendDuration(`处理中 ${visibleActionCount} 个动作`, input.steps),
      completedCount,
      runningCount,
      blockedCount,
      failedCount
    },
    updatedAt: input.updatedAt
  });
}
```

- [ ] **Step 5: Run backend projection verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/chat/chat-response-step-projections.spec.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS for the projection test and backend typecheck.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add apps/backend/agent-server/src/chat/chat-response-steps.adapter.ts apps/backend/agent-server/test/chat/chat-response-step-projections.spec.ts
git commit -m "feat: map chat steps into agent os groups"
```

---

### Task 3: Add Frontend Projection Fallbacks

**Files:**

- Modify: `apps/frontend/agent-chat/src/lib/chat-response-step-projections.ts`
- Test: `apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx`

- [ ] **Step 1: Add failing projection-oriented component tests**

In `apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx`, replace the completed-summary expectation with the new desired behavior and add an answer-only case:

```ts
it('renders completed execution summaries collapsed by default', () => {
  const html = renderToStaticMarkup(
    <ResponseStepSummary
      responseSteps={{
        ...state,
        status: 'completed',
        displayMode: 'agent_execution',
        agentOsGroups: [
          {
            kind: 'execution',
            title: '执行',
            summary: 'Ran 1 command',
            status: 'completed',
            steps: [state.steps[1]]
          }
        ]
      }}
    />
  );

  expect(html).toContain('处理中 2 个步骤');
  expect(html).toContain('<details class="chat-response-steps chat-response-steps--complete">');
  expect(html).not.toContain('open=""');
  expect(html).toContain('执行');
  expect(html).not.toContain('request-received → route-selection');
});

it('does not render response steps for answer-only final-response snapshots', () => {
  const html = renderToStaticMarkup(
    <ResponseStepSummary
      responseSteps={{
        messageId: 'assistant-answer',
        status: 'completed',
        updatedAt: '2026-05-03T09:00:00.000Z',
        displayMode: 'answer_only',
        summary: {
          title: '已思考',
          completedCount: 1,
          runningCount: 0,
          blockedCount: 0,
          failedCount: 0
        },
        steps: [
          {
            id: 'step-final',
            sessionId: 'session-1',
            messageId: 'assistant-answer',
            sequence: 0,
            phase: 'summarize',
            status: 'completed',
            title: '整理最终回复',
            startedAt: '2026-05-03T09:00:00.000Z',
            completedAt: '2026-05-03T09:00:00.000Z',
            sourceEventId: 'event-final',
            sourceEventType: 'final_response_completed'
          }
        ],
        agentOsGroups: []
      }}
    />
  );

  expect(html).toBe('');
});
```

- [ ] **Step 2: Run the failing frontend tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx
```

Expected: FAIL because `ChatResponseStepsForMessage` has no `displayMode` or `agentOsGroups`, completed details are open, and answer-only summaries still render.

- [ ] **Step 3: Extend frontend projection type and snapshot folding**

In `apps/frontend/agent-chat/src/lib/chat-response-step-projections.ts`, import the new type:

```ts
  type ChatAgentOsGroup,
  type ChatTurnDisplayMode,
```

Extend `ChatResponseStepsForMessage`:

```ts
  displayMode: ChatTurnDisplayMode;
  agentOsGroups: ChatAgentOsGroup[];
```

Update snapshot folding:

```ts
[projection.messageId]: {
  messageId: projection.messageId,
  status: projection.status,
  displayMode: projection.displayMode ?? deriveDisplayMode(projection.steps),
  steps: sortSteps(projection.steps),
  agentOsGroups: projection.agentOsGroups ?? buildFallbackAgentOsGroups(sortSteps(projection.steps)),
  summary: projection.summary,
  updatedAt: projection.updatedAt
}
```

Update event folding:

```ts
const displayMode = deriveDisplayMode(steps);

[projection.step.messageId]: {
  messageId: projection.step.messageId,
  status: deriveStatus(steps),
  displayMode,
  steps,
  agentOsGroups: buildFallbackAgentOsGroups(steps),
  summary: summarizeSteps(steps, displayMode),
  updatedAt
}
```

Replace `summarizeSteps` signature:

```ts
function summarizeSteps(steps: ChatResponseStepRecord[], displayMode: ChatTurnDisplayMode): ChatResponseStepSummary {
  if (displayMode === 'answer_only') {
    return {
      title: '已思考',
      completedCount: steps.filter(step => step.status === 'completed').length,
      runningCount: steps.filter(step => step.status === 'running' || step.status === 'queued').length,
      blockedCount: steps.filter(step => step.status === 'blocked').length,
      failedCount: steps.filter(step => step.status === 'failed').length
    };
  }

  const runningCount = steps.filter(step => step.status === 'running' || step.status === 'queued').length;
  const completedCount = steps.filter(step => step.status === 'completed').length;
  const titlePrefix = runningCount > 0 ? '处理中' : '已处理';
  const visibleActionCount = buildFallbackAgentOsGroups(steps).reduce((total, group) => total + group.steps.length, 0);

  return {
    title: `${titlePrefix} ${visibleActionCount} 个动作`,
    completedCount,
    runningCount,
    blockedCount: steps.filter(step => step.status === 'blocked').length,
    failedCount: steps.filter(step => step.status === 'failed').length
  };
}
```

Add fallback helpers:

```ts
function deriveDisplayMode(steps: ChatResponseStepRecord[]): ChatTurnDisplayMode {
  return steps.some(step => {
    if (step.sourceEventType === 'final_response_completed' || step.sourceEventType === 'session_finished') {
      return false;
    }
    return (
      step.target?.kind === 'command' ||
      step.target?.kind === 'file' ||
      step.target?.kind === 'approval' ||
      step.target?.kind === 'test' ||
      step.phase === 'execute' ||
      step.phase === 'edit' ||
      step.phase === 'verify' ||
      step.agentScope === 'sub'
    );
  })
    ? 'agent_execution'
    : 'answer_only';
}

function buildFallbackAgentOsGroups(steps: ChatResponseStepRecord[]): ChatAgentOsGroup[] {
  const displayMode = deriveDisplayMode(steps);
  if (displayMode === 'answer_only') return [];
  const grouped = new Map<ChatAgentOsGroup['kind'], ChatResponseStepRecord[]>();
  steps.forEach(step => {
    const kind = resolveFallbackGroupKind(step);
    grouped.set(kind, [...(grouped.get(kind) ?? []), sanitizeStepForAgentOs(step)]);
  });
  const orderedKinds: ChatAgentOsGroup['kind'][] = [
    'thinking',
    'exploration',
    'execution',
    'collaboration',
    'verification',
    'delivery'
  ];
  return orderedKinds.flatMap(kind => {
    const groupSteps = grouped.get(kind) ?? [];
    return groupSteps.length
      ? [{ kind, title: groupTitle(kind), status: deriveGroupStatus(groupSteps), steps: groupSteps }]
      : [];
  });
}

function resolveFallbackGroupKind(step: ChatResponseStepRecord): ChatAgentOsGroup['kind'] {
  if (step.agentScope === 'sub') return 'collaboration';
  if (step.phase === 'context' || step.phase === 'explore' || step.target?.kind === 'file') return 'exploration';
  if (step.phase === 'verify' || step.phase === 'approve' || step.target?.kind === 'test') return 'verification';
  if (step.phase === 'execute' || step.phase === 'edit' || step.target?.kind === 'command') return 'execution';
  if (step.phase === 'summarize') return 'delivery';
  return 'thinking';
}

function groupTitle(kind: ChatAgentOsGroup['kind']) {
  return {
    thinking: '思考',
    exploration: '探索',
    execution: '执行',
    collaboration: '协作',
    verification: '验证',
    delivery: '交付'
  }[kind];
}

function deriveGroupStatus(steps: ChatResponseStepRecord[]): ChatResponseStepRecord['status'] {
  if (steps.some(step => step.status === 'failed')) return 'failed';
  if (steps.some(step => step.status === 'blocked')) return 'blocked';
  if (steps.some(step => step.status === 'cancelled')) return 'cancelled';
  if (steps.some(step => step.status === 'running' || step.status === 'queued')) return 'running';
  return 'completed';
}

function sanitizeStepForAgentOs(step: ChatResponseStepRecord): ChatResponseStepRecord {
  return {
    ...step,
    nodeId: undefined,
    nodeLabel: undefined,
    fromNodeId: undefined,
    toNodeId: undefined
  };
}
```

- [ ] **Step 4: Make completed summary skip answer-only rendering**

In `apps/frontend/agent-chat/src/components/chat-response-steps/response-step-summary.tsx`, add this guard at the top of `ResponseStepSummary`:

```tsx
if (responseSteps.displayMode === 'answer_only') {
  return null;
}
```

Change the root details from:

```tsx
<details className="chat-response-steps chat-response-steps--complete" open>
```

to:

```tsx
<details className="chat-response-steps chat-response-steps--complete">
```

- [ ] **Step 5: Run frontend projection verification**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: PASS for component tests and frontend typecheck.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add apps/frontend/agent-chat/src/lib/chat-response-step-projections.ts apps/frontend/agent-chat/src/components/chat-response-steps/response-step-summary.tsx apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx
git commit -m "feat: derive chat agent os display mode"
```

---

### Task 4: Render Inline Agent OS Groups

**Files:**

- Create: `apps/frontend/agent-chat/src/components/chat-response-steps/agent-os-run-panel.tsx`
- Create: `apps/frontend/agent-chat/src/components/chat-response-steps/agent-os-group.tsx`
- Create: `apps/frontend/agent-chat/src/components/chat-response-steps/agent-os-step-item.tsx`
- Modify: `apps/frontend/agent-chat/src/components/chat-response-steps/index.ts`
- Modify: `apps/frontend/agent-chat/src/components/chat-response-steps/quick-response-steps.tsx`
- Modify: `apps/frontend/agent-chat/src/components/chat-response-steps/response-step-summary.tsx`
- Modify: `apps/frontend/agent-chat/src/components/chat-response-steps/response-step-detail.tsx`
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-page.scss`
- Test: `apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx`

- [ ] **Step 1: Write failing render tests for groups**

Add this test to `apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx`:

```tsx
it('renders inline Agent OS groups with user-readable steps only', () => {
  const html = renderToStaticMarkup(
    <QuickResponseSteps
      responseSteps={{
        ...state,
        displayMode: 'agent_execution',
        agentOsGroups: [
          {
            kind: 'exploration',
            title: '探索',
            summary: '已查看 1 个上下文',
            status: 'completed',
            steps: [
              {
                ...state.steps[0],
                title: '查看 chat-message-adapter.tsx',
                nodeId: undefined,
                nodeLabel: undefined,
                fromNodeId: undefined,
                toNodeId: undefined
              }
            ]
          },
          {
            kind: 'verification',
            title: '验证',
            summary: '验证 1 项',
            status: 'running',
            steps: [
              {
                ...state.steps[1],
                title: '运行 agent-chat response steps tests',
                nodeId: undefined
              }
            ]
          }
        ]
      }}
    />
  );

  expect(html).toContain('探索');
  expect(html).toContain('已查看 1 个上下文');
  expect(html).toContain('查看 chat-message-adapter.tsx');
  expect(html).toContain('验证');
  expect(html).toContain('运行 agent-chat response steps tests');
  expect(html).not.toContain('request-received');
  expect(html).not.toContain('route-selection');
  expect(html).not.toContain('主 Agent');
  expect(html).not.toContain('礼部');
});
```

- [ ] **Step 2: Run the failing render tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx
```

Expected: FAIL because the UI still renders flat `ResponseStepDetail` rows and exposes owner labels and node transitions.

- [ ] **Step 3: Add `AgentOsStepItem`**

Create `apps/frontend/agent-chat/src/components/chat-response-steps/agent-os-step-item.tsx`:

```tsx
import type { ChatResponseStepRecord } from '@agent/core';

type AgentOsStepItemProps = {
  step: ChatResponseStepRecord;
};

export function AgentOsStepItem({ step }: AgentOsStepItemProps) {
  return (
    <li className={`chat-response-steps__agent-os-step is-${step.status}`}>
      <span className="chat-response-steps__status" aria-hidden="true" />
      <span className="chat-response-steps__agent-os-step-title">{step.title}</span>
      {step.detail ? <span className="chat-response-steps__agent-os-step-detail">{step.detail}</span> : null}
      {step.target?.kind === 'command' ? (
        <code className="chat-response-steps__target">{step.target.label}</code>
      ) : null}
      {step.target?.kind === 'file' ? <code className="chat-response-steps__target">{step.target.path}</code> : null}
    </li>
  );
}
```

- [ ] **Step 4: Add `AgentOsGroup`**

Create `apps/frontend/agent-chat/src/components/chat-response-steps/agent-os-group.tsx`:

```tsx
import type { ChatAgentOsGroup } from '@agent/core';
import { AgentOsStepItem } from './agent-os-step-item';

type AgentOsGroupProps = {
  group: ChatAgentOsGroup;
};

export function AgentOsGroup({ group }: AgentOsGroupProps) {
  return (
    <section className={`chat-response-steps__agent-os-group is-${group.status}`} aria-label={group.title}>
      <header className="chat-response-steps__agent-os-group-header">
        <span className="chat-response-steps__agent-os-group-title">{group.title}</span>
        {group.summary ? <span className="chat-response-steps__agent-os-group-summary">{group.summary}</span> : null}
      </header>
      <ol className="chat-response-steps__agent-os-step-list">
        {group.steps.map(step => (
          <AgentOsStepItem key={step.id} step={step} />
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 5: Add `AgentOsRunPanel`**

Create `apps/frontend/agent-chat/src/components/chat-response-steps/agent-os-run-panel.tsx`:

```tsx
import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';
import { AgentOsGroup } from './agent-os-group';
import { buildResponseStepSummaryTitle } from './response-step-summary';

type AgentOsRunPanelProps = {
  responseSteps: ChatResponseStepsForMessage;
  defaultOpen: boolean;
};

export function AgentOsRunPanel({ responseSteps, defaultOpen }: AgentOsRunPanelProps) {
  if (responseSteps.displayMode === 'answer_only') {
    return null;
  }

  return (
    <details
      className={`chat-response-steps chat-response-steps--agent-os ${defaultOpen ? 'is-running' : 'is-complete'}`}
      open={defaultOpen}
    >
      <summary className="chat-response-steps__complete-summary">
        <span>{buildResponseStepSummaryTitle(responseSteps)}</span>
        <span className="chat-response-steps__chevron" aria-hidden="true">
          ›
        </span>
      </summary>
      <div className="chat-response-steps__agent-os-groups">
        {responseSteps.agentOsGroups.map(group => (
          <AgentOsGroup key={group.kind} group={group} />
        ))}
      </div>
    </details>
  );
}
```

- [ ] **Step 6: Wire components into quick and summary renderers**

In `apps/frontend/agent-chat/src/components/chat-response-steps/quick-response-steps.tsx`, replace the component body with:

```tsx
import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';
import { AgentOsRunPanel } from './agent-os-run-panel';

type QuickResponseStepsProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function QuickResponseSteps({ responseSteps }: QuickResponseStepsProps) {
  return <AgentOsRunPanel responseSteps={responseSteps} defaultOpen />;
}
```

In `apps/frontend/agent-chat/src/components/chat-response-steps/response-step-summary.tsx`, replace the render block with:

```tsx
import type { ChatResponseStepsForMessage } from '@/lib/chat-response-step-projections';
import { AgentOsRunPanel } from './agent-os-run-panel';

type ResponseStepSummaryProps = {
  responseSteps: ChatResponseStepsForMessage;
};

export function ResponseStepSummary({ responseSteps }: ResponseStepSummaryProps) {
  return <AgentOsRunPanel responseSteps={responseSteps} defaultOpen={false} />;
}
```

Keep `buildResponseStepSummaryTitle` in the same file and export it as it is.

In `apps/frontend/agent-chat/src/components/chat-response-steps/index.ts`, export new components:

```ts
export * from './agent-os-run-panel';
export * from './agent-os-group';
export * from './agent-os-step-item';
export * from './quick-response-steps';
export * from './response-step-detail';
export * from './response-step-summary';
```

- [ ] **Step 7: Add focused styles**

Append these styles to `apps/frontend/agent-chat/src/styles/chat-home-page.scss` under the existing `.chat-response-steps` section:

```scss
.chat-response-steps--agent-os {
  border: 0;
  background: transparent;
}

.chat-response-steps__agent-os-groups {
  display: grid;
  gap: 14px;
  margin-top: 14px;
}

.chat-response-steps__agent-os-group {
  display: grid;
  gap: 8px;
}

.chat-response-steps__agent-os-group-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  color: #1f2633;
}

.chat-response-steps__agent-os-group-title {
  font-weight: 650;
}

.chat-response-steps__agent-os-group-summary {
  color: #8b95a6;
  font-size: 13px;
}

.chat-response-steps__agent-os-step-list {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chat-response-steps__agent-os-step {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  color: #2c3340;
}

.chat-response-steps__agent-os-step-title,
.chat-response-steps__agent-os-step-detail,
.chat-response-steps__target {
  min-width: 0;
}

.chat-response-steps__agent-os-step-detail {
  grid-column: 2;
  color: #8b95a6;
  font-size: 13px;
}

.chat-response-steps__target {
  grid-column: 2;
  width: fit-content;
  max-width: 100%;
  overflow-wrap: anywhere;
  border-radius: 6px;
  background: #f3f5f8;
  padding: 2px 6px;
  color: #303846;
  font-size: 12px;
}
```

- [ ] **Step 8: Run frontend render verification**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: PASS for component tests and frontend typecheck.

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add apps/frontend/agent-chat/src/components/chat-response-steps apps/frontend/agent-chat/src/styles/chat-home-page.scss apps/frontend/agent-chat/test/components/chat-response-steps.test.tsx
git commit -m "feat: render inline agent os response steps"
```

---

### Task 5: Keep Ordinary Thinking Separate From Execution Runs

**Files:**

- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-response-steps.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx`
- Test: `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx`

- [ ] **Step 1: Write failing message adapter tests**

Add these tests to `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx` near the existing thinking and response step tests:

```tsx
it('does not render response step UI for answer-only final responses', () => {
  const messages: ChatMessageRecord[] = [
    {
      id: 'assistant-answer',
      sessionId: 'session-1',
      role: 'assistant',
      content: '<think>用户问 Docker 概念，需要简洁解释。</think>镜像是模板，容器是运行实例。',
      createdAt: '2026-05-03T10:00:00.000Z'
    }
  ];

  const items = buildBubbleItems({
    messages,
    responseStepsByMessageId: {
      'assistant-answer': {
        messageId: 'assistant-answer',
        status: 'completed',
        displayMode: 'answer_only',
        updatedAt: '2026-05-03T10:00:01.000Z',
        summary: {
          title: '已思考',
          completedCount: 1,
          runningCount: 0,
          blockedCount: 0,
          failedCount: 0
        },
        steps: [],
        agentOsGroups: []
      }
    },
    onCopy: () => undefined,
    getAgentLabel: role => role ?? 'agent'
  });
  const html = renderToStaticMarkup(<>{items[0]?.content}</>);

  expect(html).toContain('已思考');
  expect(html).not.toContain('已处理');
  expect(html).not.toContain('chat-response-steps--agent-os');
});

it('renders execution runs as one inline Agent OS entry without a separate thinking entry', () => {
  const messages: ChatMessageRecord[] = [
    {
      id: 'assistant-execution',
      sessionId: 'session-1',
      role: 'assistant',
      content: '已完成 chat 步骤展示收束。',
      createdAt: '2026-05-03T10:00:00.000Z'
    }
  ];

  const items = buildBubbleItems({
    messages,
    responseStepsByMessageId: {
      'assistant-execution': {
        messageId: 'assistant-execution',
        status: 'completed',
        displayMode: 'agent_execution',
        updatedAt: '2026-05-03T10:00:01.000Z',
        summary: {
          title: '已处理 2 个动作',
          completedCount: 2,
          runningCount: 0,
          blockedCount: 0,
          failedCount: 0
        },
        steps: [],
        agentOsGroups: [
          {
            kind: 'thinking',
            title: '思考',
            summary: '确认展示模式',
            status: 'completed',
            steps: []
          },
          {
            kind: 'execution',
            title: '执行',
            summary: 'Edited 2 files',
            status: 'completed',
            steps: []
          }
        ]
      }
    },
    cognitionTargetMessageId: 'assistant-execution',
    thinkState: {
      title: '已思考',
      content: '这段思考应该并入 Agent OS。',
      loading: false
    },
    onCopy: () => undefined,
    getAgentLabel: role => role ?? 'agent'
  });
  const html = renderToStaticMarkup(<>{items[0]?.content}</>);

  expect(html).toContain('已处理 2 个动作');
  expect(html).toContain('思考');
  expect(html).toContain('执行');
  expect(html.match(/已思考/g)?.length ?? 0).toBe(0);
});
```

- [ ] **Step 2: Run the failing adapter tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat/chat-message-adapter.test.tsx
```

Expected: FAIL because answer-only response steps still render or execution thinking still appears as a separate entry.

- [ ] **Step 3: Make `renderMessageResponseSteps` skip answer-only**

In `apps/frontend/agent-chat/src/pages/chat/chat-message-response-steps.tsx`, update the guard:

```tsx
if (!responseSteps || responseSteps.displayMode === 'answer_only') {
  return null;
}
```

- [ ] **Step 4: Suppress separate thinking panel for execution runs**

In `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx`, find the code that computes and renders message thinking. Introduce this boolean near the `responseSteps` lookup:

```ts
const isAgentExecutionResponse = responseSteps?.displayMode === 'agent_execution';
```

Apply it to thinking rendering so execution responses do not show a separate thinking panel:

```ts
const shouldRenderThinkingPanel = !isAgentExecutionResponse && Boolean(thinkingPanel);
```

Use `shouldRenderThinkingPanel` wherever the component currently checks `thinkingPanel` for main-thread rendering. Keep the existing parsing and cleanup of `<think>` content so final visible Markdown remains free of raw think tags.

- [ ] **Step 5: Run adapter verification**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat/chat-message-adapter.test.tsx
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: PASS for adapter tests and frontend typecheck.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add apps/frontend/agent-chat/src/pages/chat/chat-message-response-steps.tsx apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx
git commit -m "fix: separate thinking from execution runs"
```

---

### Task 6: Update Documentation And Run Affected Verification

**Files:**

- Modify: `docs/apps/frontend/agent-chat/overview.md`
- Modify: `docs/apps/frontend/agent-chat/README.md`
- Modify: `docs/contracts/api/agent-chat.md`
- Modify: `docs/superpowers/specs/2026-05-02-agent-chat-codex-response-steps-design.md`

- [ ] **Step 1: Update frontend overview**

In `docs/apps/frontend/agent-chat/overview.md`, replace the current paragraph that says response steps render above the AI正文 with:

```md
`agent-chat` 会把每轮 assistant 回复分成 `answer_only` 与 `agent_execution` 两种主线程展示模式。普通问答只显示 `思考中 / 已思考`，不会把 `final_response_completed` 这类低价值步骤渲染成“已处理 1 个步骤”。执行任务显示聊天内 `处理中 / 已处理` 入口；运行中默认展开，完成后默认折叠，展开后按“思考、探索、执行、协作、验证、交付”展示 Agent OS 过程视图。用户理解和复盘本轮执行不依赖右侧 Runtime Drawer。
```

- [ ] **Step 2: Update frontend README**

In `docs/apps/frontend/agent-chat/README.md`, add this bullet under the chat experience section:

```md
- 主聊天线程采用 inline Agent OS：普通问答走 `已思考`，执行任务走 `处理中 / 已处理`，执行详情在同一条 assistant 回复内按六段展开，不依赖右侧高级面板。
```

- [ ] **Step 3: Update API contract docs**

In `docs/contracts/api/agent-chat.md`, add this schema note near the chat response step projection section:

```md
`chat_response_steps` snapshot 可携带可选 `displayMode` 与 `agentOsGroups`：

- `displayMode`: `answer_only | agent_execution`
- `agentOsGroups[].kind`: `thinking | exploration | execution | collaboration | verification | delivery`
- `agentOsGroups[].steps`: 已经过 adapter 转换的用户可读步骤；内部 `nodeId`、`fromNodeId`、`toNodeId` 不作为主视觉文案使用

旧客户端可以忽略这两个字段；新客户端在字段缺失时可从 step phase、target、agentScope 与 sourceEventType 兜底派生。
```

- [ ] **Step 4: Mark the older Codex response-steps spec as superseded**

At the top of `docs/superpowers/specs/2026-05-02-agent-chat-codex-response-steps-design.md`, add this note after the header metadata:

```md
> 后续设计（2026-05-03）：聊天主线程 response steps 已收敛为 inline Agent OS 方向。普通问答只显示 `已思考`；执行任务显示 `处理中 / 已处理` 并在同一条 assistant 回复内展开六段过程。后续实现以 `docs/superpowers/specs/2026-05-03-agent-chat-inline-agent-os-design.md` 为准。
```

- [ ] **Step 5: Run docs verification**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 6: Run affected code verification**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/chat-response-step-contracts.test.ts
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/chat/chat-response-step-projections.spec.ts
pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat/chat-message-adapter.test.tsx
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: all commands PASS. If a command fails because of an unrelated existing red light, record the failing command, the first relevant error, and why it is unrelated before delivery.

- [ ] **Step 7: Commit Task 6**

Run:

```bash
git add docs/apps/frontend/agent-chat/overview.md docs/apps/frontend/agent-chat/README.md docs/contracts/api/agent-chat.md docs/superpowers/specs/2026-05-02-agent-chat-codex-response-steps-design.md
git commit -m "docs: document inline agent os chat flow"
```

---

## Final Review Checklist

- [ ] Ordinary answer-only replies show `已思考` and do not show `已处理 1 个步骤`.
- [ ] Execution replies show one `处理中 / 已处理` entry.
- [ ] Execution replies render Agent OS groups inside the chat message.
- [ ] Completed execution details are collapsed by default.
- [ ] Failed, blocked, and cancelled states remain visible in the summary.
- [ ] Main visual text does not contain `final_response_completed`, `nodeId`, `fromNodeId`, or `toNodeId`.
- [ ] The feature does not depend on a right-side Runtime Drawer.
- [ ] `pnpm check:docs` passes.
- [ ] Core, backend, and frontend affected tests pass or blockers are recorded with exact command output.

## Self-Review

- Spec coverage: Tasks 1-2 cover contract and backend grouping; Tasks 3-5 cover frontend display-mode fallback, inline Agent OS rendering, answer-only thinking, completed folding, and hidden internal fields; Task 6 covers documentation cleanup and verification.
- Placeholder scan: The plan contains no unresolved placeholder markers and no unnamed paths. Each task names exact files, commands, and expected outcomes.
- Type consistency: The plan uses `ChatTurnDisplayMode`, `ChatAgentOsGroupKind`, and `ChatAgentOsGroup` consistently across core, backend, and frontend.
