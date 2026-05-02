# Agent Chat Thinking Feedback Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/agent-chat`、`apps/backend/agent-server`、`packages/core`、`packages/runtime`、`agents/supervisor`
最后核对：2026-05-03

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build default-expanded assistant thinking display, assistant copy / regenerate / thumbs feedback actions, message feedback API, learning preference handoff, and direct reply answer-quality cleanup without adding share features.

**Architecture:** Frontend parsing stays in the chat message adapter helpers so raw model output becomes explicit `visibleContent` and `thinkContent` before Markdown rendering. Feedback uses schema-first contracts in `packages/core`, a thin backend endpoint in `agent-server`, and frontend optimistic state through the existing chat session hook. Direct reply quality is improved in the supervisor prompt and final reply sanitizers so stored assistant messages do not persist `<think>` blocks.

**Tech Stack:** React, TypeScript, Ant Design, `@ant-design/x`, Vitest, NestJS-style backend services, zod schemas in `packages/core`, pnpm workspace commands.

---

## File Structure

- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter-helpers.ts`
  - Owns `parseAssistantThinkingContent`, resilient `<think>` stripping, and helper tests.
- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx`
  - Wires parsed thinking data and message actions into `Bubble.List` items.
- Create: `apps/frontend/agent-chat/src/pages/chat/message-thinking-panel.tsx`
  - Renders default-expanded “思考中 / 已思考” panel.
- Modify: `apps/frontend/agent-chat/src/components/chat-message-cards.tsx`
  - Removes duplicate direct stripping and accepts already-clean assistant content.
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-messages.scss`
  - Styles thinking panel and assistant action bar.
- Modify: `apps/frontend/agent-chat/src/api/chat-api.ts`
  - Adds `submitMessageFeedback` and optional regenerate request helper.
- Modify: `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`
  - Exposes `submitMessageFeedback` and `regenerateAssistantMessage` from session actions.
- Modify: `apps/frontend/agent-chat/src/hooks/chat-session/use-chat-session-actions.ts`
  - Implements optimistic feedback and regenerate wiring.
- Modify: `apps/frontend/agent-chat/src/types/chat-message.ts`
  - Adds optional frontend message feedback projection fields.
- Modify: `packages/core/src/tasking/schemas/session.ts`
  - Defines schema-first `ChatMessageFeedback` request / response contracts.
- Modify: `packages/core/src/tasking/types/session.ts`
  - Exports inferred feedback types.
- Modify: `packages/core/test/core-type-contracts.test.ts`
  - Covers feedback schema parsing.
- Modify: `apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts`
  - Adds backend-side `<think>` cleaning at the current direct response helper boundary.
- Modify: `apps/backend/agent-server/src/chat/chat.service.ts`
  - Adds feedback persistence and regenerate hint handling at the existing message endpoint boundary.
- Modify: `apps/backend/agent-server/src/chat/chat.controller.ts`
  - Exposes the feedback endpoint.
- Modify: `apps/backend/agent-server/test/chat/chat.service.session.spec.ts`
  - Covers feedback endpoint/service behavior and final message cleaning.
- Modify: `packages/runtime/src/session/session-coordinator-direct-reply.ts`
  - Sanitizes streamed direct reply final content before completion events persist it.
- Modify: `agents/supervisor/src/flows/supervisor/prompts/supervisor-plan-prompts.ts`
  - Adds foundational technical explanation answer preference.
- Modify: `agents/supervisor/src/flows/delivery/prompts/delivery-summary-prompts.ts`
  - Extends final reply sanitizer to remove `<think>` blocks.
- Modify: `docs/apps/frontend/agent-chat/README.md`
  - Documents thinking panel and message actions.
- Modify: `docs/contracts/api/agent-chat.md`
  - Documents message feedback contract.

## Task 1: Frontend Think Parser

**Files:**

- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter-helpers.ts`
- Test: `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-helpers.test.ts`

- [ ] **Step 1: Write failing parser tests**

Add test cases near the existing `stripThinkTags` and `extractThinkBlocks` tests:

```ts
it('parseAssistantThinkingContent splits completed think blocks from visible content', () => {
  expect(parseAssistantThinkingContent('<think>先判断概念边界</think>镜像是模板。', false)).toEqual({
    visibleContent: '镜像是模板。',
    thinkContent: '先判断概念边界',
    thinkingState: 'completed',
    hasMalformedThink: false
  });
});

it('parseAssistantThinkingContent hides unfinished streaming think content', () => {
  expect(parseAssistantThinkingContent('<think>正在整理 Docker 类比', true)).toEqual({
    visibleContent: '',
    thinkContent: '正在整理 Docker 类比',
    thinkingState: 'streaming',
    hasMalformedThink: true
  });
});

it('parseAssistantThinkingContent protects visible content when think is malformed after completion', () => {
  expect(parseAssistantThinkingContent('正文之前\n<think>未闭合思考', false)).toEqual({
    visibleContent: '正文之前',
    thinkContent: '未闭合思考',
    thinkingState: 'completed',
    hasMalformedThink: true
  });
});

it('stripThinkTags removes unfinished think blocks as a display safety fallback', () => {
  expect(stripThinkTags('答案\n<think>内部推理')).toBe('答案');
});
```

- [ ] **Step 2: Run parser tests and verify failure**

Run:

```bash
pnpm exec vitest apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-helpers.test.ts --run
```

Expected: FAIL because `parseAssistantThinkingContent` is not exported and `stripThinkTags` does not remove unfinished blocks.

- [ ] **Step 3: Implement parser helpers**

In `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter-helpers.ts`, add:

```ts
export type AssistantThinkingState = 'none' | 'streaming' | 'completed';

export interface ParsedAssistantThinkingContent {
  visibleContent: string;
  thinkContent: string;
  thinkingState: AssistantThinkingState;
  hasMalformedThink: boolean;
}

const THINK_BLOCK_PATTERN = /<think>([\s\S]*?)<\/think>/gi;
const OPEN_THINK_PATTERN = /<think>/i;

export function parseAssistantThinkingContent(content: string, streaming: boolean): ParsedAssistantThinkingContent {
  const thinkBlocks = Array.from(content.matchAll(THINK_BLOCK_PATTERN), match => match[1]?.trim() ?? '').filter(
    Boolean
  );
  const withoutClosedBlocks = content.replace(THINK_BLOCK_PATTERN, '').trimStart();
  const openMatch = withoutClosedBlocks.match(OPEN_THINK_PATTERN);
  const hasMalformedThink = Boolean(openMatch);

  if (!openMatch) {
    return {
      visibleContent: withoutClosedBlocks,
      thinkContent: thinkBlocks.join('\n\n'),
      thinkingState: thinkBlocks.length ? 'completed' : 'none',
      hasMalformedThink: false
    };
  }

  const visibleContent = withoutClosedBlocks.slice(0, openMatch.index).trimEnd();
  const unfinishedThink = withoutClosedBlocks.slice((openMatch.index ?? 0) + '<think>'.length).trim();
  const thinkContent = [...thinkBlocks, unfinishedThink].filter(Boolean).join('\n\n');

  return {
    visibleContent,
    thinkContent,
    thinkingState: streaming ? 'streaming' : thinkContent ? 'completed' : 'none',
    hasMalformedThink
  };
}
```

Update existing helpers to delegate:

```ts
export function stripThinkTags(content: string) {
  return parseAssistantThinkingContent(content, false).visibleContent.trimStart();
}

export function extractThinkBlocks(content: string): string {
  return parseAssistantThinkingContent(content, false).thinkContent;
}
```

- [ ] **Step 4: Run parser tests and verify pass**

Run:

```bash
pnpm exec vitest apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-helpers.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add apps/frontend/agent-chat/src/pages/chat/chat-message-adapter-helpers.ts apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-helpers.test.ts
git commit -m "feat: parse assistant thinking blocks"
```

## Task 2: Default-Expanded Thinking Panel

**Files:**

- Create: `apps/frontend/agent-chat/src/pages/chat/message-thinking-panel.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx`
- Modify: `apps/frontend/agent-chat/src/components/chat-message-cards.tsx`
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-messages.scss`
- Test: `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx`

- [ ] **Step 1: Write failing render test**

Add to `chat-message-adapter.test.tsx`:

```tsx
it('renders assistant think content in a default-expanded thinking panel without leaking tags', () => {
  const messages: ChatMessageRecord[] = [
    {
      id: 'assistant_1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '<think>需要解释镜像和容器的区别。</think>镜像是模板，容器是运行实例。',
      createdAt: '2026-05-03T00:00:00.000Z'
    }
  ];

  const items = buildBubbleItems({
    messages,
    activeStatus: 'completed',
    onCopy: () => undefined,
    getAgentLabel: role => role ?? 'agent',
    cognitionDurationLabel: '2 秒'
  });
  const html = renderToStaticMarkup(<>{items[0]?.content}</>);

  expect(html).toContain('已思考（用时 2 秒）');
  expect(html).toContain('需要解释镜像和容器的区别。');
  expect(html).toContain('镜像是模板，容器是运行实例。');
  expect(html).not.toContain('<think>');
});
```

- [ ] **Step 2: Run render test and verify failure**

Run:

```bash
pnpm exec vitest apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx --run
```

Expected: FAIL because `MessageThinkingPanel` does not exist and `buildBubbleItems` does not render think blocks.

- [ ] **Step 3: Create `MessageThinkingPanel`**

Create `apps/frontend/agent-chat/src/pages/chat/message-thinking-panel.tsx`:

```tsx
import { DownOutlined, LoadingOutlined, UpOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useState } from 'react';

import type { AssistantThinkingState } from './chat-message-adapter-helpers';

export interface MessageThinkingPanelProps {
  content: string;
  state: AssistantThinkingState;
  durationLabel?: string;
}

export function MessageThinkingPanel({ content, state, durationLabel }: MessageThinkingPanelProps) {
  const [expanded, setExpanded] = useState(true);
  if (!content.trim() && state === 'none') {
    return null;
  }

  const title = state === 'streaming' ? '思考中' : durationLabel ? `已思考（用时 ${durationLabel}）` : '已思考';

  return (
    <section className={`chatx-thinking-panel is-${state}`} aria-label={title}>
      <button
        type="button"
        className="chatx-thinking-panel__header"
        aria-expanded={expanded}
        onClick={() => setExpanded(value => !value)}
      >
        <span className="chatx-thinking-panel__mark" aria-hidden="true">
          {state === 'streaming' ? <LoadingOutlined /> : null}
        </span>
        <span className="chatx-thinking-panel__title">{title}</span>
        <Button
          type="text"
          size="small"
          className="chatx-thinking-panel__toggle"
          icon={expanded ? <UpOutlined /> : <DownOutlined />}
          aria-label={expanded ? '收起思考内容' : '展开思考内容'}
        />
      </button>
      {expanded && content.trim() ? <div className="chatx-thinking-panel__body">{content}</div> : null}
    </section>
  );
}
```

- [ ] **Step 4: Wire parser into assistant rendering**

In `chat-message-adapter.tsx`, import:

```ts
import { MessageThinkingPanel } from './message-thinking-panel';
import { parseAssistantThinkingContent } from './chat-message-adapter-helpers';
```

Extend `renderMessageContent` options with:

```ts
thinkingDurationLabel?: string;
```

Inside assistant normalization, replace direct stripping with parsed content:

```ts
const assistantParsed =
  message.role === 'assistant'
    ? parseAssistantThinkingContent(stripStreamingCursor(message.content), streaming)
    : undefined;
const normalizedMessage =
  message.role === 'assistant'
    ? {
        ...message,
        content: assistantParsed?.visibleContent ?? ''
      }
    : message.role === 'user'
      ? {
          ...message,
          content: stripWorkflowCommandPrefix(message.content)
        }
      : message;
```

Wrap content:

```tsx
const thinkingPanel =
  message.role === 'assistant' && assistantParsed && assistantParsed.thinkingState !== 'none' ? (
    <MessageThinkingPanel
      content={assistantParsed.thinkContent}
      state={assistantParsed.thinkingState}
      durationLabel={options.thinkingDurationLabel}
    />
  ) : null;

return (
  <div className="chatx-assistant-stack">
    {thinkingPanel}
    {beforeContent}
    {content}
    {afterContent}
    {evidenceContent}
  </div>
);
```

Pass `cognitionDurationLabel` from `buildBubbleItems` to `renderMessageContent`:

```ts
thinkingDurationLabel: cognitionDurationLabel;
```

- [ ] **Step 5: Remove duplicate stripping from card renderer**

In `chat-message-cards.tsx`, keep Markdown rendering on already-normalized content:

```tsx
<XMarkdown
  content={message.content}
  streaming={streaming ? { hasNextChunk: true, tail: true } : undefined}
  openLinksInNewTab
  escapeRawHtml
  className="chatx-markdown"
  components={markdownComponents}
/>
```

Remove the unused `stripThinkTags` import if TypeScript reports it.

- [ ] **Step 6: Add styles**

Append to `chat-home-messages.scss` near message styles:

```scss
.chatx-thinking-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: rgba(71, 85, 105, 0.92);
  font-size: 14px;
  line-height: 1.7;

  &__header {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0;
  }

  &__mark {
    display: inline-flex;
    width: 18px;
    height: 18px;
    align-items: center;
    justify-content: center;
    color: $color-blue-600;
  }

  &__title {
    font-weight: 600;
  }

  &__toggle.ant-btn.ant-btn-text {
    width: 22px;
    min-width: 22px;
    height: 22px;
    padding: 0;
    color: rgba(71, 85, 105, 0.82);
  }

  &__body {
    margin-left: 9px;
    padding-left: 16px;
    border-left: 2px solid rgba(148, 163, 184, 0.35);
    color: rgba(71, 85, 105, 0.86);
    white-space: pre-wrap;
    word-break: break-word;
  }
}
```

- [ ] **Step 7: Run render tests and type check**

Run:

```bash
pnpm exec vitest apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx --run
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: both PASS.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add apps/frontend/agent-chat/src/pages/chat/message-thinking-panel.tsx apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx apps/frontend/agent-chat/src/components/chat-message-cards.tsx apps/frontend/agent-chat/src/styles/chat-home-messages.scss apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx
git commit -m "feat: show assistant thinking panel"
```

## Task 3: Assistant Action Bar And Frontend Feedback State

**Files:**

- Modify: `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx`
- Modify: `apps/frontend/agent-chat/src/api/chat-api.ts`
- Modify: `apps/frontend/agent-chat/src/hooks/chat-session/use-chat-session-actions.ts`
- Modify: `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`
- Modify: `apps/frontend/agent-chat/src/types/chat-message.ts`
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-messages.scss`
- Test: `apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx`
- Test: `apps/frontend/agent-chat/test/api/chat-api.test.ts`
- Test: `apps/frontend/agent-chat/test/hooks/chat-session/use-chat-session-actions.test.ts`

- [ ] **Step 1: Write failing action-bar render test**

Add:

```tsx
it('renders assistant copy regenerate thumbs actions and keeps user footer copy-only', () => {
  const messages: ChatMessageRecord[] = [
    {
      id: 'user_1',
      sessionId: 'session-1',
      role: 'user',
      content: 'docker 容器和镜像的区别',
      createdAt: '2026-05-03T00:00:00.000Z'
    },
    {
      id: 'assistant_1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '镜像是模板，容器是实例。',
      createdAt: '2026-05-03T00:00:01.000Z'
    }
  ];

  const items = buildBubbleItems({
    messages,
    activeStatus: 'completed',
    onCopy: () => undefined,
    onRegenerate: () => undefined,
    onMessageFeedback: () => undefined,
    getAgentLabel: role => role ?? 'agent'
  });
  const html = renderToStaticMarkup(<>{items.map(item => item.footer)}</>);

  expect(html).toContain('复制消息');
  expect(html).toContain('重新生成');
  expect(html).toContain('点赞');
  expect(html).toContain('点踩');
  expect(html.match(/重新生成/g)).toHaveLength(1);
});
```

- [ ] **Step 2: Run action-bar test and verify failure**

Run:

```bash
pnpm exec vitest apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx --run
```

Expected: FAIL because `onRegenerate` and `onMessageFeedback` options are not implemented and footer lacks the buttons.

- [ ] **Step 3: Add frontend feedback types**

In `chat-message.ts`, add:

```ts
export type ChatMessageFeedbackRating = 'helpful' | 'unhelpful' | 'none';

export type ChatMessageFeedbackReasonCode = 'too_shallow' | 'incorrect' | 'missed_point' | 'bad_format' | 'other';

export interface ChatMessageFeedbackState {
  rating: ChatMessageFeedbackRating;
  reasonCode?: ChatMessageFeedbackReasonCode;
  comment?: string;
  updatedAt?: string;
}
```

Add optional `feedback?: ChatMessageFeedbackState;` to `ChatMessageRecord` if that type is locally declared in this file.

- [ ] **Step 4: Extend API client**

In `chat-api.ts`, add:

```ts
export function submitMessageFeedback(
  sessionId: string,
  messageId: string,
  feedback: {
    rating: 'helpful' | 'unhelpful' | 'none';
    reasonCode?: 'too_shallow' | 'incorrect' | 'missed_point' | 'bad_format' | 'other';
    comment?: string;
  }
) {
  return request<ChatMessageRecord>(`/chat/messages/${encodeURIComponent(messageId)}/feedback`, {
    method: 'POST',
    data: {
      sessionId,
      ...feedback
    }
  });
}
```

- [ ] **Step 5: Add API test**

In `chat-api.test.ts`, follow existing axios mock style and assert:

```ts
await submitMessageFeedback('session-1', 'assistant-1', {
  rating: 'unhelpful',
  reasonCode: 'too_shallow',
  comment: '需要对比表'
});

expect(requestConfig.url).toBe('/chat/messages/assistant-1/feedback');
expect(requestConfig.method).toBe('POST');
expect(requestConfig.data).toEqual({
  sessionId: 'session-1',
  rating: 'unhelpful',
  reasonCode: 'too_shallow',
  comment: '需要对比表'
});
```

- [ ] **Step 6: Extend bubble options and footer**

In `chat-message-adapter.tsx`, add imports:

```ts
import { DislikeOutlined, LikeOutlined, ReloadOutlined } from '@ant-design/icons';
```

Extend `BuildBubbleItemsOptions`:

```ts
onRegenerate?: (message: ChatMessageRecord) => void;
onMessageFeedback?: (
  message: ChatMessageRecord,
  feedback: {
    rating: 'helpful' | 'unhelpful' | 'none';
    reasonCode?: 'too_shallow' | 'incorrect' | 'missed_point' | 'bad_format' | 'other';
    comment?: string;
  }
) => void;
```

Replace footer for assistant/user with:

```tsx
<div className="chatx-bubble-footer">
  <Button
    size="small"
    type="text"
    className="chatx-message-action"
    icon={<CopyGlyph copied={copiedMessageId === message.id} />}
    onClick={() => onCopy(message)}
    aria-label={copiedMessageId === message.id ? '已复制' : '复制消息'}
  />
  {message.role === 'assistant' ? (
    <>
      <Button
        size="small"
        type="text"
        className="chatx-message-action"
        icon={<ReloadOutlined />}
        onClick={() => onRegenerate?.(message)}
        disabled={activeStatus === 'running' || Boolean(agentThinking)}
        aria-label="重新生成"
      />
      <Button
        size="small"
        type="text"
        className={`chatx-message-action${message.feedback?.rating === 'helpful' ? ' is-active' : ''}`}
        icon={<LikeOutlined />}
        onClick={() =>
          onMessageFeedback?.(message, {
            rating: message.feedback?.rating === 'helpful' ? 'none' : 'helpful'
          })
        }
        aria-label="点赞"
      />
      <Button
        size="small"
        type="text"
        className={`chatx-message-action${message.feedback?.rating === 'unhelpful' ? ' is-active' : ''}`}
        icon={<DislikeOutlined />}
        onClick={() =>
          onMessageFeedback?.(message, {
            rating: message.feedback?.rating === 'unhelpful' ? 'none' : 'unhelpful',
            reasonCode: message.feedback?.rating === 'unhelpful' ? undefined : 'too_shallow'
          })
        }
        aria-label="点踩"
      />
    </>
  ) : null}
</div>
```

- [ ] **Step 7: Add action styles**

Replace or extend `.chatx-copy-button` with a shared action class:

```scss
.chatx-message-action.ant-btn.ant-btn-text,
.chatx-copy-button.ant-btn.ant-btn-text {
  width: 24px;
  min-width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #8b95a1;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.06);

  &:hover,
  &.is-active {
    background: #ffffff;
    color: $color-blue-600;
  }
}
```

- [ ] **Step 8: Implement hook actions**

In `use-chat-session-actions.ts`, import `submitMessageFeedback` and add an action that:

```ts
const submitFeedback = async (
  message: ChatMessageRecord,
  feedback: {
    rating: 'helpful' | 'unhelpful' | 'none';
    reasonCode?: 'too_shallow' | 'incorrect' | 'missed_point' | 'bad_format' | 'other';
    comment?: string;
  }
) => {
  if (!options.activeSessionId || message.role !== 'assistant') {
    return;
  }
  const updated = await runLoading(
    () => submitMessageFeedback(options.activeSessionId, message.id, feedback),
    '反馈提交失败'
  );
  options.setMessages(current => current.map(item => (item.id === message.id ? updated : item)));
};
```

Add a regenerate action that finds the closest prior user message from current messages:

```ts
const regenerateAssistantMessage = async (message: ChatMessageRecord) => {
  if (!options.activeSessionId) {
    return;
  }
  const currentMessages = options.messagesRef.current;
  const messageIndex = currentMessages.findIndex(item => item.id === message.id);
  const previousUser = currentMessages
    .slice(0, messageIndex >= 0 ? messageIndex : currentMessages.length)
    .reverse()
    .find(item => item.role === 'user');
  if (!previousUser) {
    return;
  }
  await sendMessage(previousUser.content);
};
```

Use the existing `CreateChatSessionActionsOptions` fields for active session id, message state, and loading wrapper; the implemented behavior must match the code above.

- [ ] **Step 9: Run frontend tests**

Run:

```bash
pnpm exec vitest apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx apps/frontend/agent-chat/test/api/chat-api.test.ts apps/frontend/agent-chat/test/hooks/chat-session/use-chat-session-actions.test.ts --run
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

Run:

```bash
git add apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx apps/frontend/agent-chat/src/api/chat-api.ts apps/frontend/agent-chat/src/hooks/chat-session/use-chat-session-actions.ts apps/frontend/agent-chat/src/hooks/use-chat-session.ts apps/frontend/agent-chat/src/types/chat-message.ts apps/frontend/agent-chat/src/styles/chat-home-messages.scss apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx apps/frontend/agent-chat/test/api/chat-api.test.ts apps/frontend/agent-chat/test/hooks/chat-session/use-chat-session-actions.test.ts
git commit -m "feat: add assistant message feedback actions"
```

## Task 4: Core Feedback Contract And Backend API

**Files:**

- Modify: `packages/core/src/tasking/schemas/session.ts`
- Modify: `packages/core/src/tasking/types/session.ts`
- Modify: `packages/core/test/core-type-contracts.test.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.controller.ts`
- Modify: `apps/backend/agent-server/src/chat/chat.service.ts`
- Test: `apps/backend/agent-server/test/chat/chat.service.session.spec.ts`

- [ ] **Step 1: Write failing core contract test**

In `core-type-contracts.test.ts`, add:

```ts
it('parses chat message feedback contracts', () => {
  const request = ChatMessageFeedbackRequestSchema.parse({
    sessionId: 'session-1',
    rating: 'unhelpful',
    reasonCode: 'too_shallow',
    comment: '需要对比表'
  });

  expect(request.rating).toBe('unhelpful');

  expect(() =>
    ChatMessageFeedbackRequestSchema.parse({
      sessionId: 'session-1',
      rating: 'unhelpful'
    })
  ).toThrow();
});
```

- [ ] **Step 2: Run core test and verify failure**

Run:

```bash
pnpm exec vitest packages/core/test/core-type-contracts.test.ts --run
```

Expected: FAIL because feedback schemas are not exported.

- [ ] **Step 3: Add schema-first contract**

In `packages/core/src/tasking/schemas/session.ts`, add:

```ts
export const ChatMessageFeedbackRatingSchema = z.enum(['helpful', 'unhelpful', 'none']);
export const ChatMessageFeedbackReasonCodeSchema = z.enum([
  'too_shallow',
  'incorrect',
  'missed_point',
  'bad_format',
  'other'
]);

export const ChatMessageFeedbackRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    rating: ChatMessageFeedbackRatingSchema,
    reasonCode: ChatMessageFeedbackReasonCodeSchema.optional(),
    comment: z.string().trim().max(1000).optional()
  })
  .superRefine((value, ctx) => {
    if (value.rating === 'unhelpful' && !value.reasonCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reasonCode'],
        message: 'reasonCode is required for unhelpful feedback'
      });
    }
    if (value.rating !== 'unhelpful' && value.reasonCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reasonCode'],
        message: 'reasonCode is only allowed for unhelpful feedback'
      });
    }
  });

export const ChatMessageFeedbackRecordSchema = z.object({
  messageId: z.string().min(1),
  sessionId: z.string().min(1),
  rating: ChatMessageFeedbackRatingSchema,
  reasonCode: ChatMessageFeedbackReasonCodeSchema.optional(),
  comment: z.string().max(1000).optional(),
  updatedAt: z.string().min(1)
});
```

In `packages/core/src/tasking/types/session.ts`, export:

```ts
export type ChatMessageFeedbackRating = z.infer<typeof ChatMessageFeedbackRatingSchema>;
export type ChatMessageFeedbackReasonCode = z.infer<typeof ChatMessageFeedbackReasonCodeSchema>;
export type ChatMessageFeedbackRequest = z.infer<typeof ChatMessageFeedbackRequestSchema>;
export type ChatMessageFeedbackRecord = z.infer<typeof ChatMessageFeedbackRecordSchema>;
```

- [ ] **Step 4: Run core contract test**

Run:

```bash
pnpm exec vitest packages/core/test/core-type-contracts.test.ts --run
```

Expected: PASS.

- [ ] **Step 5: Write failing backend feedback test**

In `chat.service.session.spec.ts`, add a service-level test matching existing setup:

```ts
it('stores feedback only for assistant messages in the same session', async () => {
  const session = await service.createSession({ message: 'docker 容器和镜像的区别' });
  const assistant = await service.appendAssistantMessageForTest(session.id, '镜像是模板，容器是实例。');

  const updated = await service.submitMessageFeedback(assistant.id, {
    sessionId: session.id,
    rating: 'unhelpful',
    reasonCode: 'too_shallow',
    comment: '需要更完整结构'
  });

  expect(updated.feedback).toMatchObject({
    rating: 'unhelpful',
    reasonCode: 'too_shallow',
    comment: '需要更完整结构'
  });
});
```

Use `chat.service.test-helpers.ts` to seed the assistant message if the service test setup does not expose a direct append helper.

- [ ] **Step 6: Run backend test and verify failure**

Run:

```bash
pnpm exec vitest apps/backend/agent-server/test/chat/chat.service.session.spec.ts --run
```

Expected: FAIL because feedback service method does not exist.

- [ ] **Step 7: Implement backend service and controller**

At the service boundary, add:

```ts
async submitMessageFeedback(
  messageId: string,
  input: ChatMessageFeedbackRequest
): Promise<ChatMessageRecord> {
  const parsed = ChatMessageFeedbackRequestSchema.parse(input);
  const message = this.store.getMessage(parsed.sessionId, messageId);
  if (!message) {
    throw new NotFoundException('message not found');
  }
  if (message.sessionId !== parsed.sessionId) {
    throw new ConflictException('message does not belong to session');
  }
  if (message.role !== 'assistant') {
    throw new UnprocessableEntityException('feedback is only supported for assistant messages');
  }

  const feedback =
    parsed.rating === 'none'
      ? undefined
      : {
          rating: parsed.rating,
          reasonCode: parsed.reasonCode,
          comment: parsed.comment,
          updatedAt: new Date().toISOString()
        };

  const updated = {
    ...message,
    feedback
  };
  this.store.updateMessage(parsed.sessionId, updated);
  await this.store.persistRuntimeState?.();
  return updated;
}
```

At the controller boundary, add:

```ts
@Post('messages/:messageId/feedback')
submitMessageFeedback(@Param('messageId') messageId: string, @Body() body: unknown) {
  return this.chatService.submitMessageFeedback(messageId, ChatMessageFeedbackRequestSchema.parse(body));
}
```

Use the existing exception and in-memory store helper names from `chat.service.ts`; preserve the same behavior.

- [ ] **Step 8: Run backend and core checks**

Run:

```bash
pnpm exec vitest apps/backend/agent-server/test/chat/chat.service.session.spec.ts packages/core/test/core-type-contracts.test.ts --run
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add packages/core/src/tasking/schemas/session.ts packages/core/src/tasking/types/session.ts packages/core/test/core-type-contracts.test.ts apps/backend/agent-server/src/chat apps/backend/agent-server/test/chat/chat.service.session.spec.ts
git commit -m "feat: persist chat message feedback"
```

## Task 5: Learning Handoff And Direct Reply Quality

**Files:**

- Modify: `agents/supervisor/src/flows/supervisor/prompts/supervisor-plan-prompts.ts`
- Modify: `agents/supervisor/src/flows/delivery/prompts/delivery-summary-prompts.ts`
- Modify: `agents/supervisor/src/utils/prompts/runtime-output-sanitizer.ts`
- Modify: `packages/runtime/src/session/session-coordinator-direct-reply.ts`
- Modify: `packages/runtime/src/session/session-coordinator-turns.ts`
- Test: `packages/runtime/test/session-inline-capability.int-spec.ts`
- Test: `agents/supervisor/test/index.test.ts` or nearest prompt export test

- [ ] **Step 1: Write failing sanitizer test**

Add a test near existing direct reply tests:

```ts
it('removes think blocks from persisted direct reply content', async () => {
  const llmProvider = createLlmProviderStub('<think>先组织答案</think>镜像是模板，容器是运行实例。');
  const coordinator = createSessionCoordinator({ llmProvider });
  const session = await coordinator.createSession({ message: 'docker 容器和镜像的区别' });

  const messages = coordinator.listMessages(session.id);
  expect(messages.at(-1)?.content).toBe('镜像是模板，容器是运行实例。');
  expect(messages.at(-1)?.content).not.toContain('<think>');
});
```

Use existing helper names from `session-inline-capability.int-spec.ts`.

- [ ] **Step 2: Run runtime test and verify failure**

Run:

```bash
pnpm exec vitest packages/runtime/test/session-inline-capability.int-spec.ts --run
```

Expected: FAIL if direct reply currently persists the raw `<think>` content.

- [ ] **Step 3: Extend final reply sanitizer**

In `agents/supervisor/src/flows/delivery/prompts/delivery-summary-prompts.ts`, add a local helper:

```ts
export function stripThinkBlocksFromFinalReply(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trimStart();
}

export function sanitizeFinalUserReply(content: string): string {
  const normalized = stripOperationalBoilerplate(stripThinkBlocksFromFinalReply(content));

  return normalized || stripThinkBlocksFromFinalReply(content).trim();
}
```

If `sanitizeFinalUserReply` already exists, replace its body with the version above while keeping existing exports.

- [ ] **Step 4: Apply sanitizer in runtime direct reply**

In `session-coordinator-direct-reply.ts`, add a local runtime helper named `stripThinkBlocksFromFinalReply` near the direct reply helpers.

Use it before final assistant message persistence:

```ts
const finalContent = stripThinkBlocksFromFinalReply(streamedMessage?.content || content || '').trim();
```

If the streamed message already exists, keep the current assignment pattern:

```ts
if (streamedMessage && streamedMessage.content !== assistantMessage.content) {
  streamedMessage.content = assistantMessage.content;
}
```

- [ ] **Step 5: Improve direct reply prompt**

In `supervisor-plan-prompts.ts`, add to `buildSupervisorDirectReplySystemPrompt` rules:

```ts
'如果用户询问基础技术概念、工具差异或工程术语，优先给一句核心结论，再用对比表、类比、关键机制、最小命令示例和注意事项组织答案。',
'解释两个容易混淆的概念时，不要只给定义；必须说明关系、生命周期、读写状态、常见误区和最小操作例子。',
```

Keep the prompt Chinese, direct, and free of internal workflow mentions.

- [ ] **Step 6: Add learning handoff mapping**

In the message feedback service from Task 4, map unhelpful reasons into preference candidates:

```ts
function buildFeedbackLearningCandidate(feedback: ChatMessageFeedbackRecord): string | undefined {
  if (feedback.rating !== 'unhelpful') {
    return undefined;
  }
  switch (feedback.reasonCode) {
    case 'too_shallow':
      return '基础技术概念题回答时，先给核心结论，再用类比、对比表、关键机制、命令示例和注意事项组织答案。';
    case 'bad_format':
      return '用户点踩格式时，后续回答要使用更清晰的标题、列表或对比表，避免长段落堆叠。';
    case 'missed_point':
      return '用户点踩没答到点时，后续回答要先锁定用户追问对象，再补充背景解释。';
    case 'incorrect':
      return undefined;
    case 'other':
      return feedback.comment?.trim();
    default:
      return undefined;
  }
}
```

Persist the candidate as a chat event named `message_feedback_learning_candidate` with `sessionId`, `messageId`, `reasonCode`, and `candidateText`. The existing learning job can consume this event type after this task; do not invent a second feedback store.

- [ ] **Step 7: Run runtime and supervisor tests**

Run:

```bash
pnpm exec vitest packages/runtime/test/session-inline-capability.int-spec.ts agents/supervisor/test/index.test.ts --run
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 8: Commit Task 5**

Run:

```bash
git add agents/supervisor/src/flows/supervisor/prompts/supervisor-plan-prompts.ts agents/supervisor/src/flows/delivery/prompts/delivery-summary-prompts.ts agents/supervisor/src/utils/prompts/runtime-output-sanitizer.ts packages/runtime/src/session/session-coordinator-direct-reply.ts packages/runtime/src/session/session-coordinator-turns.ts packages/runtime/test/session-inline-capability.int-spec.ts agents/supervisor/test/index.test.ts
git commit -m "feat: improve direct reply feedback quality"
```

## Task 6: Docs And Verification

**Files:**

- Modify: `docs/apps/frontend/agent-chat/README.md`
- Modify: `docs/contracts/api/agent-chat.md`
- Modify: `docs/packages/runtime/README.md`
- Modify: `docs/superpowers/specs/2026-05-03-agent-chat-thinking-feedback-design.md`

- [ ] **Step 1: Update frontend docs**

Add a section to `docs/apps/frontend/agent-chat/README.md`:

```md
## Assistant Thinking And Feedback

Assistant messages render model `<think>` content as a default-expanded thinking panel. The Markdown body receives only cleaned visible content, so raw thinking tags are never displayed as user-facing text.

Assistant message actions are copy, regenerate, thumbs up, and thumbs down. User messages keep copy-only actions. The chat UI intentionally does not render a share button.
```

- [ ] **Step 2: Update API docs**

Add to `docs/contracts/api/agent-chat.md`:

````md
## Submit Message Feedback

`POST /chat/messages/:messageId/feedback`

Request:

```json
{
  "sessionId": "session-1",
  "rating": "unhelpful",
  "reasonCode": "too_shallow",
  "comment": "需要对比表和关键命令"
}
```

`rating` accepts `helpful`, `unhelpful`, or `none`. `reasonCode` is required only for `unhelpful` and accepts `too_shallow`, `incorrect`, `missed_point`, `bad_format`, or `other`.

The endpoint only accepts assistant messages from the same session. The response returns the updated message projection with its current feedback state.
````

- [ ] **Step 3: Update runtime docs**

Add to `docs/packages/runtime/README.md`:

```md
## Chat Feedback Learning

Message feedback is stored as a lightweight assistant-message record. Helpful feedback marks the answer as accepted; unhelpful feedback can create controlled learning candidates. `incorrect` feedback does not auto-promote factual preferences, while `too_shallow`, `bad_format`, and `missed_point` can shape answer-format preferences for later direct replies.
```

- [ ] **Step 4: Update spec status note**

In `docs/superpowers/specs/2026-05-03-agent-chat-thinking-feedback-design.md`, add:

```md
> Implementation note: this design is implemented by `docs/superpowers/plans/2026-05-03-agent-chat-thinking-feedback.md`.
```

- [ ] **Step 5: Run targeted verification**

Run:

```bash
pnpm exec vitest apps/frontend/agent-chat/test/pages/chat/chat-message-adapter-helpers.test.ts apps/frontend/agent-chat/test/pages/chat/chat-message-adapter.test.tsx apps/frontend/agent-chat/test/api/chat-api.test.ts apps/frontend/agent-chat/test/hooks/chat-session/use-chat-session-actions.test.ts --run
pnpm exec vitest apps/backend/agent-server/test/chat/chat.service.session.spec.ts packages/core/test/core-type-contracts.test.ts packages/runtime/test/session-inline-capability.int-spec.ts --run
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
pnpm check:docs
```

Expected: all commands PASS. If a command fails due to existing unrelated worktree changes, record the failing command, exact error summary, and whether the touched files overlap this plan.

- [ ] **Step 6: Commit Task 6**

Run:

```bash
git add docs/apps/frontend/agent-chat/README.md docs/contracts/api/agent-chat.md docs/packages/runtime/README.md docs/superpowers/specs/2026-05-03-agent-chat-thinking-feedback-design.md
git commit -m "docs: document chat thinking feedback"
```

## Plan Self-Review

- Spec coverage: covered default-expanded think display, no share button, assistant actions, feedback API, learning handoff, direct reply quality, sanitizer, docs, and verification.
- Placeholder scan: no unresolved placeholder language is used.
- Type consistency: feedback ratings use `helpful | unhelpful | none`; reason codes use `too_shallow | incorrect | missed_point | bad_format | other`; parser state uses `none | streaming | completed`.
- Scope risk: Task 5 learning handoff records a typed chat event first, so implementation does not need to invent a second feedback store.
