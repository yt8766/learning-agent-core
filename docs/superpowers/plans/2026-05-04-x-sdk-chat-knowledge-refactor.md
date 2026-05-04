状态：current
文档类型：plan
适用范围：`apps/frontend/knowledge`, `apps/frontend/agent-chat`
最后核对：2026-05-04

# X SDK Chat And Knowledge Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `apps/frontend/knowledge` 与 `apps/frontend/agent-chat` 的聊天主线彻底迁移到 `XRequest + Provider + useXChat/useXConversations`，同时保持 `agent-chat` 现有审批、Think、ThoughtChain、恢复与工作台能力不回退。

**Architecture:** 先在两个前端各自引入 `chat-runtime/*` 宿主，分别承接 provider、conversation adapter、event folding、parser 与 card command。`knowledge` 先完整切到 `x-sdk` 骨架，再把 `agent-chat` 的 `messages + events + checkpoint` 三套输入折叠成 `useXChat` 单消息主线，最后清理旧 hook、旧 adapter 与 `@ant-design/x/es/*` 直连。

**Tech Stack:** React 19、TypeScript、`@ant-design/x`、`@ant-design/x-sdk`、`@ant-design/x-markdown`、`@ant-design/x-card`、Vitest、React Query

---

## File Map

### Knowledge runtime

- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-types.ts`
- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-provider.ts`
- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-parser.tsx`
- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-conversations.ts`
- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-actions.ts`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-messages.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-sidebar.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-status-line.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-diagnostics.ts`
- Delete or compat-shrink: `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`

### Agent chat runtime

- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-types.ts`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-provider.ts`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-event-adapter.ts`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-message-parser.tsx`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-card-commands.ts`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-conversations.ts`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-actions.ts`
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-conversation.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-content.tsx`
- Modify: `apps/frontend/agent-chat/src/components/chat-message-cards.tsx`
- Delete or compat-shrink: `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`
- Delete or compat-shrink: `apps/frontend/agent-chat/src/hooks/chat-session/*`

### Tests and docs

- Modify: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`
- Modify: `apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`
- Create: `apps/frontend/knowledge/test/chat-runtime/knowledge-chat-provider.test.tsx`
- Create: `apps/frontend/knowledge/test/chat-runtime/knowledge-chat-parser.test.tsx`
- Modify: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-page.test.tsx`
- Modify: `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx`
- Modify: `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-streaming.test.tsx`
- Create: `apps/frontend/agent-chat/test/chat-runtime/agent-chat-event-adapter.test.ts`
- Create: `apps/frontend/agent-chat/test/chat-runtime/agent-chat-card-commands.test.ts`
- Modify: `docs/apps/frontend/knowledge/knowledge-chat-lab.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/apps/frontend/agent-chat/README.md`
- Modify: `docs/apps/frontend/agent-chat/chat-api-integration.md`

## Task 1: Build Knowledge Chat Runtime Contracts

**Files:**

- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-types.ts`
- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-parser.tsx`
- Test: `apps/frontend/knowledge/test/chat-runtime/knowledge-chat-parser.test.tsx`

- [ ] **Step 1: Write the failing parser test**

```tsx
import { describe, expect, it } from 'vitest';

import type { ChatMessage } from '@/types/api';
import { toKnowledgeBubbleItems } from '@/chat-runtime/knowledge-chat-parser';

describe('toKnowledgeBubbleItems', () => {
  it('maps assistant markdown, citations, trace and loading state into Bubble.List items', () => {
    const assistantMessage: ChatMessage = {
      id: 'assistant-1',
      conversationId: 'conv-1',
      role: 'assistant',
      content: '## Answer',
      createdAt: '2026-05-04T00:00:00.000Z',
      citations: [{ id: 'c1', title: 'Doc', quote: 'Excerpt', uri: '/doc', score: 0.91 }],
      traceId: 'trace-1'
    };

    const items = toKnowledgeBubbleItems({
      messages: [assistantMessage],
      feedbackByMessageId: { 'assistant-1': 'like' },
      streamState: {
        phase: 'answer',
        answerText: '## Answer',
        citations: assistantMessage.citations ?? [],
        events: [],
        runId: 'trace-1'
      },
      isRequesting: false
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'assistant-1',
      role: 'assistant',
      loading: false
    });
    expect(items[0]?.content).toMatchObject({
      kind: 'markdown',
      meta: {
        traceId: 'trace-1'
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/knowledge/test/chat-runtime/knowledge-chat-parser.test.tsx`

Expected: FAIL with `Cannot find module '@/chat-runtime/knowledge-chat-parser'` or missing export `toKnowledgeBubbleItems`.

- [ ] **Step 3: Write minimal runtime types and parser**

```ts
// apps/frontend/knowledge/src/chat-runtime/knowledge-chat-types.ts
export type KnowledgeMessageFeedbackValue = 'default' | 'like' | 'dislike';

export interface KnowledgeFrontendChatMessageContent {
  kind: 'markdown';
  text: string;
  meta: {
    citations: Array<{ id: string; title: string; quote: string; uri?: string; score?: number }>;
    traceId?: string;
    routeReason?: string;
    feedback?: KnowledgeMessageFeedbackValue;
  };
}
```

```tsx
// apps/frontend/knowledge/src/chat-runtime/knowledge-chat-parser.tsx
import type { BubbleItemType } from '@ant-design/x';

import type { ChatMessage, KnowledgeChatStreamState } from '@/types/api';
import type { KnowledgeMessageFeedbackValue } from './knowledge-chat-types';

export function toKnowledgeBubbleItems(input: {
  messages: ChatMessage[];
  feedbackByMessageId: Record<string, KnowledgeMessageFeedbackValue>;
  streamState: KnowledgeChatStreamState;
  isRequesting: boolean;
}): BubbleItemType[] {
  return input.messages.map(message => ({
    key: message.id,
    role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
    loading: false,
    content:
      message.role === 'assistant'
        ? {
            kind: 'markdown' as const,
            text: message.content,
            meta: {
              citations: message.citations ?? [],
              traceId: message.traceId,
              routeReason: message.route?.reason,
              feedback: input.feedbackByMessageId[message.id] ?? 'default'
            }
          }
        : message.content
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/knowledge/test/chat-runtime/knowledge-chat-parser.test.tsx`

Expected: PASS with 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/knowledge/src/chat-runtime/knowledge-chat-types.ts \
  apps/frontend/knowledge/src/chat-runtime/knowledge-chat-parser.tsx \
  apps/frontend/knowledge/test/chat-runtime/knowledge-chat-parser.test.tsx
git commit -m "test(knowledge): scaffold x-sdk chat parser contract"
```

## Task 2: Build Knowledge Provider And Conversations Runtime

**Files:**

- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-provider.ts`
- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-conversations.ts`
- Create: `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-actions.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- Test: `apps/frontend/knowledge/test/chat-runtime/knowledge-chat-provider.test.tsx`

- [ ] **Step 1: Write the failing provider test**

```tsx
import { describe, expect, it, vi } from 'vitest';

import { createKnowledgeChatProvider } from '@/chat-runtime/knowledge-chat-provider';

describe('createKnowledgeChatProvider', () => {
  it('streams answer deltas and completes with normalized assistant message meta', async () => {
    const api = {
      streamChat: vi.fn(async function* () {
        yield { type: 'answer.delta', delta: 'Hel', runId: 'run-1' };
        yield { type: 'answer.delta', delta: 'lo', runId: 'run-1' };
        yield {
          type: 'answer.completed',
          runId: 'run-1',
          answer: { text: 'Hello', citations: [{ id: 'c1', title: 'Doc', quote: 'Quote' }] }
        };
      })
    };

    const provider = createKnowledgeChatProvider({ api: api as never });
    const chunks: string[] = [];

    await provider.sendMessage(
      { conversationId: 'conv-1', messages: [{ role: 'user', content: 'Hi' }] },
      {
        onChunk: chunk => chunks.push(chunk.content)
      }
    );

    expect(api.streamChat).toHaveBeenCalledTimes(1);
    expect(chunks).toEqual(['Hel', 'Hello']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/knowledge/test/chat-runtime/knowledge-chat-provider.test.tsx`

Expected: FAIL with missing module `@/chat-runtime/knowledge-chat-provider`.

- [ ] **Step 3: Write minimal provider and conversation adapters**

```ts
// apps/frontend/knowledge/src/chat-runtime/knowledge-conversations.ts
import type { ConversationData } from '@ant-design/x-sdk';

import type { ChatConversation } from '@/types/api';

export function toKnowledgeConversationData(conversation: ChatConversation): ConversationData {
  return {
    key: conversation.id,
    label: conversation.title,
    group: conversation.activeModelProfileId ?? 'knowledge-rag'
  };
}
```

```ts
// apps/frontend/knowledge/src/chat-runtime/knowledge-chat-provider.ts
import type { KnowledgeFrontendApi } from '@/api/knowledge-api-provider';

export function createKnowledgeChatProvider({ api }: { api: KnowledgeFrontendApi }) {
  return {
    async sendMessage(
      input: { conversationId: string; messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> },
      hooks: { onChunk: (chunk: { content: string; finished?: boolean }) => void }
    ) {
      let text = '';
      for await (const event of api.streamChat({
        conversationId: input.conversationId,
        messages: input.messages,
        stream: true
      })) {
        if (event.type === 'answer.delta') {
          text += event.delta;
          hooks.onChunk({ content: text });
        }
        if (event.type === 'answer.completed') {
          hooks.onChunk({ content: event.answer.text, finished: true });
          return event.answer;
        }
      }
      throw new Error('Knowledge stream completed without answer.completed');
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/knowledge/test/chat-runtime/knowledge-chat-provider.test.tsx`

Expected: PASS with provider chunk aggregation verified.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/knowledge/src/chat-runtime/knowledge-chat-provider.ts \
  apps/frontend/knowledge/src/chat-runtime/knowledge-conversations.ts \
  apps/frontend/knowledge/src/chat-runtime/knowledge-chat-actions.ts \
  apps/frontend/knowledge/src/api/knowledge-api-client.ts \
  apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts \
  apps/frontend/knowledge/test/chat-runtime/knowledge-chat-provider.test.tsx
git commit -m "feat(knowledge): add x-sdk provider runtime"
```

## Task 3: Migrate Knowledge Chat Lab Page To useXChat/useXConversations

**Files:**

- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-messages.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-sidebar.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-status-line.tsx`
- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-diagnostics.ts`
- Delete or compat-shrink: `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
- Test: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`

- [ ] **Step 1: Extend the existing chat-lab render test with the failing x-sdk expectation**

```tsx
it('renders chat lab with x-sdk conversation state and streamed assistant footer metadata', async () => {
  render(<App />);

  expect(await screen.findByText('新对话')).toBeInTheDocument();

  await userEvent.type(screen.getByRole('textbox'), '知识库是什么{enter}');

  expect(await screen.findByText('引用来源')).toBeInTheDocument();
  expect(await screen.findByText(/Trace/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the affected knowledge tests to verify failure**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`

Expected: FAIL because `ChatLabPage` still depends on `useKnowledgeChat` and old `@ant-design/x/es/*` mocks.

- [ ] **Step 3: Rewrite ChatLabPage around useXConversations and useXChat**

```tsx
// apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx
const { conversations, activeConversationKey, setActiveConversationKey, addConversation } = useXConversations({
  defaultConversations: initialConversationItems,
  defaultActiveConversationKey: initialConversationItems[0]?.key
});

const provider = useMemo(() => createKnowledgeChatProvider({ api }), [api]);
const { messages, onRequest, isRequesting, abort, queueRequest } = useXChat({
  provider,
  conversationKey: String(activeConversationKey),
  defaultMessages: async ({ conversationKey }) => loadKnowledgeConversationMessages(api, String(conversationKey)),
  requestPlaceholder: () => ({
    role: 'assistant',
    content: '',
    kind: 'markdown',
    meta: { stream: { phase: 'loading', hasNextChunk: true } }
  })
});
```

- [ ] **Step 4: Run the knowledge chat-lab tests and typecheck**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`

Run: `pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit`

Expected: PASS for both tests and clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx \
  apps/frontend/knowledge/src/pages/chat-lab/chat-lab-messages.tsx \
  apps/frontend/knowledge/src/pages/chat-lab/chat-lab-sidebar.tsx \
  apps/frontend/knowledge/src/pages/chat-lab/chat-lab-status-line.tsx \
  apps/frontend/knowledge/src/pages/chat-lab/chat-lab-diagnostics.ts \
  apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts \
  apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx \
  apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx
git commit -m "refactor(knowledge): migrate chat lab to x-sdk state"
```

## Task 4: Build Agent Chat Event Folding And Card Command Contracts

**Files:**

- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-types.ts`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-event-adapter.ts`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-card-commands.ts`
- Test: `apps/frontend/agent-chat/test/chat-runtime/agent-chat-event-adapter.test.ts`
- Test: `apps/frontend/agent-chat/test/chat-runtime/agent-chat-card-commands.test.ts`

- [ ] **Step 1: Write the failing event adapter test**

```ts
import { describe, expect, it } from 'vitest';

import { foldAgentChatRuntimeEvent } from '@/chat-runtime/agent-chat-event-adapter';

describe('foldAgentChatRuntimeEvent', () => {
  it('projects checkpoint, thought chain and response steps onto one assistant message', () => {
    const next = foldAgentChatRuntimeEvent({
      currentMessage: {
        role: 'assistant',
        content: 'Working',
        kind: 'mixed',
        meta: {}
      },
      event: {
        type: 'checkpoint.updated',
        thinkState: { loading: true, messageId: 'm-assistant', thinkingDurationMs: 1200 },
        thoughtChain: [{ id: 'step-1', title: '检索中' }],
        responseSteps: [{ id: 'r-1', label: 'Search docs' }]
      }
    });

    expect(next.meta?.think?.loading).toBe(true);
    expect(next.meta?.thoughtChain).toHaveLength(1);
    expect(next.meta?.responseSteps).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the new agent-chat runtime tests to verify failure**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/chat-runtime/agent-chat-event-adapter.test.ts apps/frontend/agent-chat/test/chat-runtime/agent-chat-card-commands.test.ts`

Expected: FAIL because runtime adapter modules do not exist.

- [ ] **Step 3: Add minimal event folding and A2UI v0.9 card command generation**

```ts
// apps/frontend/agent-chat/src/chat-runtime/agent-chat-event-adapter.ts
export function foldAgentChatRuntimeEvent(input: {
  currentMessage: AgentFrontendChatMessage;
  event: {
    type: string;
    thinkState?: { loading: boolean; messageId?: string; thinkingDurationMs?: number };
    thoughtChain?: Array<{ id: string; title: string }>;
    responseSteps?: Array<{ id: string; label: string }>;
  };
}): AgentFrontendChatMessage {
  return {
    ...input.currentMessage,
    meta: {
      ...input.currentMessage.meta,
      think: input.event.thinkState,
      thoughtChain: input.event.thoughtChain ?? [],
      responseSteps: input.event.responseSteps ?? []
    }
  };
}
```

```ts
// apps/frontend/agent-chat/src/chat-runtime/agent-chat-card-commands.ts
export function buildApprovalCardCommands(surfaceId: string, title: string) {
  return [
    { version: 'v0.9', createSurface: { surfaceId, catalogId: 'local://agent-chat-card.json' } },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components: [
          { id: 'root', component: 'Column', children: ['title'] },
          { id: 'title', component: 'Text', text: title }
        ]
      }
    }
  ];
}
```

- [ ] **Step 4: Run the runtime tests to verify they pass**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/chat-runtime/agent-chat-event-adapter.test.ts apps/frontend/agent-chat/test/chat-runtime/agent-chat-card-commands.test.ts`

Expected: PASS with adapter fold and command version assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/agent-chat/src/chat-runtime/agent-chat-types.ts \
  apps/frontend/agent-chat/src/chat-runtime/agent-chat-event-adapter.ts \
  apps/frontend/agent-chat/src/chat-runtime/agent-chat-card-commands.ts \
  apps/frontend/agent-chat/test/chat-runtime/agent-chat-event-adapter.test.ts \
  apps/frontend/agent-chat/test/chat-runtime/agent-chat-card-commands.test.ts
git commit -m "test(agent-chat): define x-sdk event and card contracts"
```

## Task 5: Build Agent Chat Provider, Conversations And Actions Runtime

**Files:**

- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-provider.ts`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-conversations.ts`
- Create: `apps/frontend/agent-chat/src/chat-runtime/agent-chat-actions.ts`
- Modify: `apps/frontend/agent-chat/src/api/chat-api.ts`
- Modify: `apps/frontend/agent-chat/src/api/chat-query.ts`
- Test: `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-streaming.test.tsx`

- [ ] **Step 1: Add the failing streaming expectation to the existing agent-chat streaming test**

```tsx
it('keeps a single assistant x-sdk message while stream patches text and meta projections', async () => {
  const rendered = renderAgentChatPage();

  await rendered.send('生成部署计划');

  expect(await screen.findByText(/思考中|已思考/)).toBeInTheDocument();
  expect(screen.getAllByTestId('assistant-message')).toHaveLength(1);
});
```

- [ ] **Step 2: Run the streaming test to verify failure**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-streaming.test.tsx`

Expected: FAIL because the current page still derives view state from `useChatSession`.

- [ ] **Step 3: Implement provider, conversations and action bridge**

```ts
// apps/frontend/agent-chat/src/chat-runtime/agent-chat-provider.ts
export function createAgentChatProvider(deps: AgentChatProviderDeps) {
  return {
    async sendMessage(input: AgentChatProviderRequest, hooks: AgentChatProviderHooks) {
      const session = await deps.ensureSession(input.conversationKey, input.initialUserText);

      hooks.onAssistantPlaceholder({ sessionId: session.id });

      const stream = deps.createSessionStream(session.id);
      deps.bindStream(stream, {
        onEvent: event => hooks.onPatch(deps.foldEvent(event)),
        onDone: () => hooks.onDone()
      });
    }
  };
}
```

- [ ] **Step 4: Run the streaming test and agent-chat typecheck**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-streaming.test.tsx`

Run: `pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`

Expected: PASS with one assistant message being patched over time and clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/agent-chat/src/chat-runtime/agent-chat-provider.ts \
  apps/frontend/agent-chat/src/chat-runtime/agent-chat-conversations.ts \
  apps/frontend/agent-chat/src/chat-runtime/agent-chat-actions.ts \
  apps/frontend/agent-chat/src/api/chat-api.ts \
  apps/frontend/agent-chat/src/api/chat-query.ts \
  apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-streaming.test.tsx
git commit -m "feat(agent-chat): add x-sdk runtime bridge"
```

## Task 6: Migrate Agent Chat Pages To useXChat, XMarkdown And XCard

**Files:**

- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-conversation.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-content.tsx`
- Modify: `apps/frontend/agent-chat/src/components/chat-message-cards.tsx`
- Delete or compat-shrink: `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`
- Delete or compat-shrink: `apps/frontend/agent-chat/src/hooks/chat-session/*`
- Test: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-page.test.tsx`
- Test: `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx`

- [ ] **Step 1: Add a failing full-page regression test**

```tsx
it('keeps approval cards, thought chain and workbench visible after x-sdk migration', async () => {
  renderAgentChatPage();

  await userEvent.type(screen.getByRole('textbox'), '继续执行计划{enter}');

  expect(await screen.findByText(/Reject|Approve|取消/)).toBeInTheDocument();
  expect(await screen.findByText(/Current Workspace/)).toBeInTheDocument();
  expect(await screen.findByText(/思考中|已思考/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the agent-chat page tests to verify failure**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/pages/chat-home/chat-home-page.test.tsx apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx`

Expected: FAIL because the current page still depends on `useChatSession` and old bubble item builders.

- [ ] **Step 3: Rewrite page composition around parser output and x-card surfaces**

```tsx
// apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx
const { conversations, activeConversationKey, setActiveConversationKey } = useAgentChatConversations(...);
const provider = useMemo(() => createAgentChatProvider(runtimeDeps), [runtimeDeps]);
const { messages, onRequest, isRequesting, abort } = useXChat({
  provider,
  conversationKey: String(activeConversationKey),
  defaultMessages: ({ conversationKey }) => loadAgentChatDefaultMessages(conversationKey, runtimeDeps),
});

const parsed = useMemo(
  () => parseAgentChatMessages({ messages, actionHandlers, copiedMessageId }),
  [messages, actionHandlers, copiedMessageId],
);
```

```tsx
// apps/frontend/agent-chat/src/pages/chat/chat-message-content.tsx
return (
  <div className="chatx-message-stack">
    <AgentMarkdownMessage content={message.content} meta={message.meta} />
    {message.meta?.think ? <Think {...message.meta.think} /> : null}
    {message.meta?.thoughtChain?.length ? <ThoughtChain items={message.meta.thoughtChain} /> : null}
    {message.meta?.cards?.length ? (
      <XCard.Box commands={message.meta.cards.flatMap(card => card.commands)} onAction={onCardAction}>
        {message.meta.cards.map(card => (
          <XCard.Card key={card.surfaceId} id={card.surfaceId} />
        ))}
      </XCard.Box>
    ) : null}
  </div>
);
```

- [ ] **Step 4: Run the full agent-chat test slice and typecheck**

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/agent-chat/test/pages/chat-home/chat-home-page.test.tsx apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-streaming.test.tsx`

Run: `pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`

Expected: PASS, with approval cards, thought chain and workbench surviving the migration.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx \
  apps/frontend/agent-chat/src/pages/chat-home/chat-home-conversation.tsx \
  apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx \
  apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx \
  apps/frontend/agent-chat/src/pages/chat/chat-message-content.tsx \
  apps/frontend/agent-chat/src/components/chat-message-cards.tsx \
  apps/frontend/agent-chat/src/hooks/use-chat-session.ts \
  apps/frontend/agent-chat/src/hooks/chat-session \
  apps/frontend/agent-chat/test/pages/chat-home/chat-home-page.test.tsx \
  apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx
git commit -m "refactor(agent-chat): migrate frontline chat to x-sdk"
```

## Task 7: Cleanup, Docs And Final Verification

**Files:**

- Modify: `docs/apps/frontend/knowledge/knowledge-chat-lab.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/apps/frontend/agent-chat/README.md`
- Modify: `docs/apps/frontend/agent-chat/chat-api-integration.md`
- Cleanup: remove dead imports, dead styles and stale `@ant-design/x/es/*` test mocks in affected files

- [ ] **Step 1: Write the failing doc-and-cleanup checklist into the PR working notes**

```md
- docs still mention useKnowledgeChat or useChatSession as primary chat state
- tests still mock @ant-design/x/es/\*
- page imports still rely on deprecated direct es entrypoints
```

- [ ] **Step 2: Run grep to verify stale entrypoints and stale hook references still exist before cleanup**

Run: `rg -n "@ant-design/x/es/|useKnowledgeChat|useChatSession" apps/frontend/knowledge apps/frontend/agent-chat docs/apps/frontend`

Expected: matches in migrated files and docs before cleanup.

- [ ] **Step 3: Remove stale references and update docs**

```md
`knowledge` 现在使用 `useXConversations + useXChat` 作为唯一聊天状态主线，`chat-runtime/*` 承接 provider、parser 和 action 映射。

`agent-chat` 现在使用 `useXConversations + useXChat` 承接前线消息主线，运行态事件通过 `chat-runtime/agent-chat-event-adapter.ts` 折叠到单条 assistant message 的 `meta` 投影。
```

- [ ] **Step 4: Run final verification**

Run: `pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit`

Run: `pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/knowledge/test`

Run: `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/agent-chat/test`

Run: `pnpm check:docs`

Expected: all commands pass; grep no longer finds stale direct entrypoints or old primary hook references in migrated docs/pages.

- [ ] **Step 5: Commit**

```bash
git add docs/apps/frontend/knowledge/knowledge-chat-lab.md \
  docs/apps/frontend/knowledge/knowledge-frontend.md \
  docs/apps/frontend/agent-chat/README.md \
  docs/apps/frontend/agent-chat/chat-api-integration.md \
  apps/frontend/knowledge \
  apps/frontend/agent-chat
git commit -m "docs(frontend): document x-sdk chat runtime migration"
```

## Self-Review

### Spec coverage

- `knowledge` 完整切到 `x-sdk`：Task 1-3 覆盖。
- `agent-chat` 保留审批、Think、ThoughtChain、恢复、工作台：Task 4-6 覆盖。
- `x-card` 承接结构化卡片：Task 4、Task 6 覆盖。
- 删除旧 hook 主状态职责：Task 3、Task 6 覆盖。
- 更新文档与验证：Task 7 覆盖。

### Placeholder scan

- 计划中未使用 `TBD`、`TODO`、`implement later`。
- 每个任务都包含具体文件、测试、命令与提交动作。
- 代码步骤均给出明确函数、组件或类型骨架，不依赖“类似上一步”。

### Type consistency

- `knowledge` 统一使用 `KnowledgeMessageFeedbackValue`、`toKnowledgeBubbleItems`、`createKnowledgeChatProvider`。
- `agent-chat` 统一使用 `AgentFrontendChatMessage`、`foldAgentChatRuntimeEvent`、`buildApprovalCardCommands`、`createAgentChatProvider`。
- `useXChat/useXConversations` 在两个应用中都是唯一聊天状态主线。
