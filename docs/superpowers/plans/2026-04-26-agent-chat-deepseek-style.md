# Agent Chat DeepSeek-Style Frontline Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/agent-chat`
最后核对：2026-04-26

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a DeepSeek-style lightweight `agent-chat` frontend shell with a collapsible multi-session sidebar, quick/expert empty state, inline governance summaries, and a right-side current-conversation anchor rail.

**Architecture:** Keep backend contracts unchanged and reuse `useChatSession()`, existing composer helpers, `Bubble.List`, and message-card projections. Split the chat home surface into focused page-local components and helpers under `apps/frontend/agent-chat/src/pages/chat-home/`, while preserving existing approval, evidence, learning, plan-question, and skill-suggestion message behavior.

**Tech Stack:** React, TypeScript, Ant Design, `@ant-design/x`, SCSS, Vitest, React DOM server render tests.

---

## File Structure

- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`
  - Own page-level state for sidebar collapse, chat mode, workbench panel visibility, and anchor selection.
  - Pass new props into sidebar and workbench components.
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-sidebar.tsx`
  - Replace the single-session summary with a multi-session sidebar.
  - Render expanded and collapsed states from the same public component.
- Create: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-sidebar-helpers.ts`
  - Group sessions by time bucket and map session status to visual tone.
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`
  - Introduce quick/expert mode props.
  - Replace the old empty frontline entry with DeepSeek-style `ChatEmptyState`.
  - Render `ConversationAnchorRail` for active threads.
  - Keep the existing optional workbench side column behind `showWorkbench`.
- Create: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-anchor-rail.tsx`
  - Render right-side current-session anchor dots and hover card.
- Create: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-anchor-rail-helpers.ts`
  - Derive anchor records from messages and checkpoint/card data.
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench-composer-helpers.ts`
  - Add a typed `ChatMode` wrapper helper so quick/expert mode maps to existing plan mode behavior.
- Modify: `apps/frontend/agent-chat/src/styles/_chat-home-shell.scss`
  - Remove the current card-heavy shell feel and support the new page grid.
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-sidebar.scss`
  - Style expanded and collapsed sidebars.
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-workbench.scss`
  - Style empty state, chat surface, composer, advanced panel placement, and anchor rail layout.
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-messages.scss`
  - Tune message spacing and inline governance summary styles.
- Modify: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-sidebar.test.tsx`
  - Replace the old single-session expectation with multi-session and collapsed-state coverage.
- Modify: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench.render.test.tsx`
  - Cover empty-state mode UI, expert submission behavior, and anchor rail rendering.
- Create: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-sidebar-helpers.test.ts`
  - Unit-test time grouping and status tone derivation.
- Create: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-anchor-rail-helpers.test.ts`
  - Unit-test anchor derivation from messages/cards/checkpoint.
- Modify: `docs/apps/frontend/agent-chat/overview.md`
  - Document the new lightweight shell, multi-session sidebar, expert mode, inline governance summaries, and anchor rail.

## Task 1: Sidebar Helpers

**Files:**

- Create: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-sidebar-helpers.ts`
- Create: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-sidebar-helpers.test.ts`

- [ ] **Step 1: Write failing tests for session grouping and status tone**

Add this test file:

```ts
import { describe, expect, it } from 'vitest';

import { buildSessionGroups, getSessionStatusTone } from '@/pages/chat-home/chat-home-sidebar-helpers';
import type { ChatSessionRecord } from '@/types/chat';

function session(id: string, title: string, updatedAt: string, status: ChatSessionRecord['status']): ChatSessionRecord {
  return {
    id,
    title,
    status,
    createdAt: updatedAt,
    updatedAt
  };
}

describe('chat-home-sidebar-helpers', () => {
  it('groups sessions by today, seven days, thirty days, and month buckets', () => {
    const groups = buildSessionGroups(
      [
        session('today', '今天任务', '2026-04-26T09:00:00.000Z', 'running'),
        session('week', '七天内任务', '2026-04-22T09:00:00.000Z', 'completed'),
        session('month', '三十天内任务', '2026-04-02T09:00:00.000Z', 'waiting_approval'),
        session('march', '三月任务', '2026-03-18T09:00:00.000Z', 'completed')
      ],
      new Date('2026-04-26T12:00:00.000Z')
    );

    expect(groups.map(group => group.label)).toEqual(['今天', '7 天内', '30 天内', '2026-03']);
    expect(groups.map(group => group.sessions.map(item => item.id))).toEqual([
      ['today'],
      ['week'],
      ['month'],
      ['march']
    ]);
  });

  it('maps important session states to sidebar tones', () => {
    expect(getSessionStatusTone('running')).toEqual({ tone: 'running', label: '运行中' });
    expect(getSessionStatusTone('waiting_approval')).toEqual({ tone: 'warning', label: '待审批' });
    expect(getSessionStatusTone('waiting_interrupt')).toEqual({ tone: 'warning', label: '待确认' });
    expect(getSessionStatusTone('failed')).toEqual({ tone: 'danger', label: '失败' });
    expect(getSessionStatusTone('completed')).toEqual({ tone: 'done', label: '已完成' });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-sidebar-helpers.test.ts
```

Expected: FAIL because `chat-home-sidebar-helpers.ts` does not exist.

- [ ] **Step 3: Implement the helper**

Create `apps/frontend/agent-chat/src/pages/chat-home/chat-home-sidebar-helpers.ts`:

```ts
import type { ChatSessionRecord } from '@/types/chat';
import { getSessionStatusLabel } from '@/hooks/use-chat-session';

export interface ChatSessionGroup {
  label: string;
  sessions: ChatSessionRecord[];
}

export type ChatSessionStatusTone = 'running' | 'warning' | 'danger' | 'done' | 'idle';

export interface ChatSessionStatusDisplay {
  tone: ChatSessionStatusTone;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildSessionGroups(sessions: ChatSessionRecord[], now = new Date()): ChatSessionGroup[] {
  const sorted = [...sessions].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
  const groups = new Map<string, ChatSessionRecord[]>();

  for (const item of sorted) {
    const label = getSessionGroupLabel(item.updatedAt, now);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([label, groupSessions]) => ({
    label,
    sessions: groupSessions
  }));
}

export function getSessionGroupLabel(updatedAt: string, now = new Date()): string {
  const updated = new Date(updatedAt);
  const ageMs = startOfLocalDay(now).getTime() - startOfLocalDay(updated).getTime();
  const ageDays = Math.max(0, Math.floor(ageMs / DAY_MS));

  if (ageDays === 0) {
    return '今天';
  }

  if (ageDays <= 7) {
    return '7 天内';
  }

  if (ageDays <= 30) {
    return '30 天内';
  }

  const year = updated.getFullYear();
  const month = String(updated.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getSessionStatusTone(status: ChatSessionRecord['status']): ChatSessionStatusDisplay {
  switch (status) {
    case 'running':
      return { tone: 'running', label: getSessionStatusLabel(status) };
    case 'waiting_approval':
      return { tone: 'warning', label: getSessionStatusLabel(status) };
    case 'waiting_interrupt':
      return { tone: 'warning', label: getSessionStatusLabel(status) };
    case 'failed':
      return { tone: 'danger', label: getSessionStatusLabel(status) };
    case 'completed':
      return { tone: 'done', label: getSessionStatusLabel(status) };
    default:
      return { tone: 'idle', label: getSessionStatusLabel(status) };
  }
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-sidebar-helpers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/frontend/agent-chat/src/pages/chat-home/chat-home-sidebar-helpers.ts apps/frontend/agent-chat/test/pages/chat-home/chat-home-sidebar-helpers.test.ts
git commit -m "feat: add chat sidebar grouping helpers"
```

## Task 2: Multi-Session Sidebar

**Files:**

- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-sidebar.tsx`
- Modify: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-sidebar.test.tsx`
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-sidebar.scss`

- [ ] **Step 1: Replace the old sidebar test with expanded and collapsed expectations**

Update `apps/frontend/agent-chat/test/pages/chat-home/chat-home-sidebar.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ChatHomeSidebar } from '@/pages/chat-home/chat-home-sidebar';
import type { ChatSessionRecord } from '@/types/chat';

const sessions: ChatSessionRecord[] = [
  {
    id: 'session-running',
    title: 'Agent目录结构优化建议',
    status: 'running',
    createdAt: '2026-04-26T08:00:00.000Z',
    updatedAt: '2026-04-26T09:00:00.000Z'
  },
  {
    id: 'session-approval',
    title: '流程图生成与解读',
    status: 'waiting_approval',
    createdAt: '2026-04-20T08:00:00.000Z',
    updatedAt: '2026-04-20T09:00:00.000Z'
  },
  {
    id: 'session-old',
    title: 'gstack中skills概念解析',
    status: 'completed',
    createdAt: '2026-03-12T08:00:00.000Z',
    updatedAt: '2026-03-12T09:00:00.000Z'
  }
];

function renderSidebar(collapsed = false) {
  return renderToStaticMarkup(
    <ChatHomeSidebar
      chat={
        {
          sessions,
          activeSessionId: 'session-running',
          createNewSession: vi.fn(),
          selectSession: vi.fn()
        } as never
      }
      collapsed={collapsed}
      onToggleCollapsed={() => undefined}
    />
  );
}

describe('ChatHomeSidebar', () => {
  it('renders grouped multi-session navigation in expanded state', () => {
    const html = renderSidebar(false);

    expect(html).toContain('Agent Chat');
    expect(html).toContain('开启新对话');
    expect(html).toContain('今天');
    expect(html).toContain('7 天内');
    expect(html).toContain('2026-03');
    expect(html).toContain('Agent目录结构优化建议');
    expect(html).toContain('流程图生成与解读');
    expect(html).toContain('待审批');
    expect(html).toContain('176******93');
    expect(html).not.toContain('Single frontline session');
    expect(html).not.toContain('正在准备会话');
  });

  it('renders narrow controls without session history when collapsed', () => {
    const html = renderSidebar(true);

    expect(html).toContain('aria-label="展开侧边栏"');
    expect(html).toContain('aria-label="开启新对话"');
    expect(html).toContain('chatx-sidebar-rail');
    expect(html).not.toContain('Agent目录结构优化建议');
    expect(html).not.toContain('7 天内');
    expect(html).not.toContain('176******93');
  });
});
```

- [ ] **Step 2: Run the sidebar test and verify it fails**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-sidebar.test.tsx
```

Expected: FAIL because `ChatHomeSidebar` does not accept `collapsed` and still renders the single-session summary.

- [ ] **Step 3: Implement expanded and collapsed sidebar rendering**

Replace `apps/frontend/agent-chat/src/pages/chat-home/chat-home-sidebar.tsx` with:

```tsx
import { Typography } from 'antd';

import type { useChatSession } from '@/hooks/use-chat-session';
import { buildSessionGroups, getSessionStatusTone } from './chat-home-sidebar-helpers';

const { Text } = Typography;

interface ChatHomeSidebarProps {
  chat: ReturnType<typeof useChatSession>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function ChatHomeSidebar({ chat, collapsed, onToggleCollapsed }: ChatHomeSidebarProps) {
  if (collapsed) {
    return (
      <aside className="chatx-sidebar-rail" aria-label="收起的会话侧栏">
        <div className="chatx-sidebar-rail__brand" aria-hidden="true">
          AC
        </div>
        <div className="chatx-sidebar-rail__controls">
          <button type="button" aria-label="展开侧边栏" onClick={onToggleCollapsed}>
            <span className="chatx-sidebar-icon is-panel" aria-hidden="true" />
          </button>
          <button type="button" aria-label="开启新对话" onClick={() => void chat.createNewSession()}>
            <span className="chatx-sidebar-icon is-plus" aria-hidden="true" />
          </button>
        </div>
      </aside>
    );
  }

  const groups = buildSessionGroups(chat.sessions ?? []);

  return (
    <aside className="chatx-sidebar" aria-label="会话侧栏">
      <div className="chatx-sidebar__brand-row">
        <div className="chatx-sidebar__brand-mark" aria-hidden="true">
          AC
        </div>
        <Text className="chatx-sidebar__brand-name">Agent Chat</Text>
        <button type="button" className="chatx-sidebar__collapse" aria-label="收起侧边栏" onClick={onToggleCollapsed}>
          <span className="chatx-sidebar-icon is-panel" aria-hidden="true" />
        </button>
      </div>

      <button type="button" className="chatx-new-chat" onClick={() => void chat.createNewSession()}>
        <span className="chatx-new-chat__icon" aria-hidden="true" />
        <span className="chatx-new-chat__label">开启新对话</span>
      </button>

      <nav className="chatx-session-groups" aria-label="历史会话">
        {groups.length ? (
          groups.map(group => (
            <section key={group.label} className="chatx-session-group">
              <Text className="chatx-session-group__label">{group.label}</Text>
              <div className="chatx-session-group__list">
                {group.sessions.map(session => {
                  const status = getSessionStatusTone(session.status);
                  const active = session.id === chat.activeSessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      className={`chatx-session-item ${active ? 'is-active' : ''}`}
                      onClick={() => void chat.selectSession(session.id)}
                    >
                      <span className={`chatx-session-item__dot is-${status.tone}`} aria-hidden="true" />
                      <span className="chatx-session-item__title">{session.title}</span>
                      {status.tone === 'idle' || status.tone === 'done' ? null : (
                        <span className="chatx-session-item__status">{status.label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <p className="chatx-sidebar__empty">还没有会话，输入问题即可开始。</p>
        )}
      </nav>

      <div className="chatx-sidebar__footer">
        <span className="chatx-sidebar__avatar" aria-hidden="true" />
        <span className="chatx-sidebar__account">176******93</span>
        <button type="button" className="chatx-sidebar__more" aria-label="更多账户操作">
          ...
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Add sidebar styles**

Update `apps/frontend/agent-chat/src/styles/chat-home-sidebar.scss` by replacing the old single-session card rules with the new expanded/collapsed classes. Keep existing conversation-menu rules only if still referenced elsewhere.

```scss
.chatx-sidebar,
.chatx-sidebar-rail {
  height: 100vh;
  box-sizing: border-box;
  background: #fbfcff;
}

.chatx-sidebar {
  display: flex;
  flex-direction: column;
  padding: 24px 18px 16px;
  border-right: 1px solid rgba(17, 24, 39, 0.08);
}

.chatx-sidebar__brand-row,
.chatx-sidebar__footer,
.chatx-sidebar-rail__controls {
  display: flex;
  align-items: center;
}

.chatx-sidebar__brand-row {
  gap: 12px;
  margin-bottom: 26px;
}

.chatx-sidebar__brand-mark,
.chatx-sidebar-rail__brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: #3867ff;
  color: #fff;
  font-weight: 800;
}

.chatx-sidebar__brand-name.ant-typography {
  flex: 1 1 auto;
  color: #3867ff;
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
}

.chatx-sidebar__collapse,
.chatx-sidebar__more,
.chatx-sidebar-rail__controls button {
  border: 0;
  background: transparent;
  color: #111827;
  cursor: pointer;
}

.chatx-new-chat {
  display: inline-flex;
  width: 100%;
  height: 56px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 28px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
  color: #111827;
  font-size: 17px;
  font-weight: 700;
}

.chatx-new-chat__icon,
.chatx-sidebar-icon.is-plus {
  position: relative;
  width: 20px;
  height: 20px;
  border: 2px solid currentColor;
  border-radius: 999px;
}

.chatx-new-chat__icon::before,
.chatx-new-chat__icon::after,
.chatx-sidebar-icon.is-plus::before,
.chatx-sidebar-icon.is-plus::after {
  position: absolute;
  content: '';
  inset: 50% auto auto 50%;
  width: 10px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  transform: translate(-50%, -50%);
}

.chatx-new-chat__icon::after,
.chatx-sidebar-icon.is-plus::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.chatx-session-groups {
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  padding-right: 4px;
}

.chatx-session-group + .chatx-session-group {
  margin-top: 26px;
}

.chatx-session-group__label.ant-typography {
  display: block;
  margin-bottom: 14px;
  color: #8b929f;
  font-size: 18px;
  font-weight: 700;
}

.chatx-session-group__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chatx-session-item {
  display: grid;
  width: 100%;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  padding: 10px;
  text-align: left;
  cursor: pointer;
}

.chatx-session-item:hover,
.chatx-session-item.is-active {
  background: rgba(56, 103, 255, 0.08);
}

.chatx-session-item__dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #cfd3db;
}

.chatx-session-item__dot.is-running {
  background: #3867ff;
}

.chatx-session-item__dot.is-warning {
  background: #f59e0b;
}

.chatx-session-item__dot.is-danger {
  background: #ef4444;
}

.chatx-session-item__dot.is-done {
  background: #cfd3db;
}

.chatx-session-item__title {
  overflow: hidden;
  color: #171b24;
  font-size: 16px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chatx-session-item__status {
  color: #8b929f;
  font-size: 12px;
  white-space: nowrap;
}

.chatx-sidebar__footer {
  gap: 12px;
  padding-top: 16px;
  color: #6b7280;
  font-size: 16px;
}

.chatx-sidebar__avatar {
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: #eef0f4;
}

.chatx-sidebar__account {
  flex: 1 1 auto;
}

.chatx-sidebar-rail {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 22px 14px;
}

.chatx-sidebar-rail__brand {
  margin-bottom: 14px;
}

.chatx-sidebar-rail__controls {
  gap: 14px;
  padding: 10px 14px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 14px 32px rgba(15, 23, 42, 0.08);
}

.chatx-sidebar-icon.is-panel {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid currentColor;
  border-radius: 6px;
  box-shadow: inset 6px 0 0 transparent;
}
```

- [ ] **Step 5: Run the sidebar tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-sidebar.test.tsx test/pages/chat-home/chat-home-sidebar-helpers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add apps/frontend/agent-chat/src/pages/chat-home/chat-home-sidebar.tsx apps/frontend/agent-chat/src/styles/chat-home-sidebar.scss apps/frontend/agent-chat/test/pages/chat-home/chat-home-sidebar.test.tsx
git commit -m "feat: add lightweight chat session sidebar"
```

## Task 3: Page Shell State and Layout

**Files:**

- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`
- Modify: `apps/frontend/agent-chat/src/styles/_chat-home-shell.scss`

- [ ] **Step 1: Write failing render coverage for collapsed shell class**

Add this assertion to an existing `chat-home-page` render test in `apps/frontend/agent-chat/test/pages/chat-home/chat-home-page.test.tsx` or create a focused test if the current file is easier to extend:

```tsx
expect(html).toContain('chatx-layout is-sidebar-expanded');
expect(html).toContain('Agent Chat');
```

Add a second test that mocks `useState` for the initial `sidebarCollapsed` value and expects:

```tsx
expect(html).toContain('chatx-layout is-sidebar-collapsed');
expect(html).toContain('chatx-sidebar-rail');
```

- [ ] **Step 2: Run the page test and verify it fails**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-page.test.tsx
```

Expected: FAIL because the shell does not expose the new expanded/collapsed classes or sidebar props.

- [ ] **Step 3: Wire sidebar collapse and chat mode in `ChatHomePage`**

In `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`:

1. Add state near the existing `showWorkbench` state:

```ts
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [chatMode, setChatMode] = useState<'quick' | 'expert'>('quick');
```

2. Change the outer layout class:

```tsx
<Layout className={`chatx-layout ${sidebarCollapsed ? 'is-sidebar-collapsed' : 'is-sidebar-expanded'}`}>
```

3. Change the sider width:

```tsx
<Sider width={sidebarCollapsed ? 108 : 312} theme="light" className="chatx-sider" collapsedWidth={108}>
  <ChatHomeSidebar
    chat={chat}
    collapsed={sidebarCollapsed}
    onToggleCollapsed={() => setSidebarCollapsed(current => !current)}
  />
</Sider>
```

4. Pass `chatMode` into `ChatHomeWorkbench`:

```tsx
<ChatHomeWorkbench
  chat={chat}
  showWorkbench={showWorkbench}
  chatMode={chatMode}
  onChatModeChange={setChatMode}
  bubbleItems={bubbleItems}
  streamEvents={streamEvents}
/>
```

- [ ] **Step 4: Update shell styles**

In `apps/frontend/agent-chat/src/styles/_chat-home-shell.scss`, make the page cleaner and remove the heavy card background:

```scss
.chatx-layout {
  min-height: 100vh;
  background: #fff;
}

.chatx-sider.ant-layout-sider {
  overflow: hidden;
  background: #fbfcff;
  transition:
    width 0.2s ease,
    max-width 0.2s ease,
    min-width 0.2s ease;
}

.chatx-header.ant-layout-header {
  display: none;
}

.chatx-content {
  min-height: 100vh;
  padding: 0;
  background: #fff;
}

.chatx-main-card {
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: #fff;
  box-shadow: none;
}
```

Keep the existing responsive rules that hide the sider under mobile, but adjust them so `.chatx-main-card` remains full-height.

- [ ] **Step 5: Run the page and sidebar tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-page.test.tsx test/pages/chat-home/chat-home-sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx apps/frontend/agent-chat/src/styles/_chat-home-shell.scss apps/frontend/agent-chat/test/pages/chat-home/chat-home-page.test.tsx
git commit -m "feat: add lightweight chat home shell"
```

## Task 4: Empty State and Chat Mode Composer Behavior

**Files:**

- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench-composer-helpers.ts`
- Modify: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench.render.test.tsx`
- Modify: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench-composer-helpers.test.ts`
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-workbench.scss`

- [ ] **Step 1: Add failing composer helper tests for chat mode**

In `apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench-composer-helpers.test.ts`, add:

```ts
import { resolveComposerSubmitForMode } from '@/pages/chat-home/chat-home-workbench-composer-helpers';

it('submits quick mode as a direct message', () => {
  expect(resolveComposerSubmitForMode('你好', null, 'quick')).toEqual({
    display: '你好',
    payload: '你好'
  });
});

it('submits expert mode through the plan command path', () => {
  expect(resolveComposerSubmitForMode('拆解需求', null, 'expert')).toEqual({
    display: '拆解需求',
    payload: '/plan 拆解需求'
  });
});
```

- [ ] **Step 2: Add failing render expectations for empty state**

In `apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench.render.test.tsx`, update the empty-state test expectations:

```tsx
expect(html).toContain('使用快速模式开始对话');
expect(html).toContain('快速模式');
expect(html).toContain('专家模式');
expect(html).toContain('给 Agent Chat 发送消息');
expect(html).toContain('深度思考');
expect(html).toContain('智能搜索');
expect(html).not.toContain('Frontline Workspace');
```

Also update the render invocation:

```tsx
<ChatHomeWorkbench
  chat={chat as any}
  showWorkbench={false}
  chatMode="quick"
  onChatModeChange={vi.fn()}
  bubbleItems={[]}
  streamEvents={[]}
/>
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-workbench-composer-helpers.test.ts test/pages/chat-home/chat-home-workbench.render.test.tsx
```

Expected: FAIL because `resolveComposerSubmitForMode` and the new empty UI do not exist.

- [ ] **Step 4: Add typed chat mode helper**

Modify `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench-composer-helpers.ts`:

```ts
export type ChatMode = 'quick' | 'expert';

export function resolveComposerSubmitForMode(value: string, suggestedPayload: string | null, chatMode: ChatMode) {
  return resolveComposerSubmit(value, suggestedPayload, chatMode === 'expert');
}
```

- [ ] **Step 5: Update workbench props, empty state, and composer**

In `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`:

1. Import `Segmented` if Ant Design is used for mode switching:

```ts
import {
  Alert,
  Button,
  Collapse,
  Dropdown,
  Flex,
  Segmented,
  Space,
  Switch,
  Tag,
  Typography,
  type MenuProps
} from 'antd';
```

2. Update props:

```ts
import type { ChatMode } from './chat-home-workbench-composer-helpers';

interface ChatHomeWorkbenchProps {
  chat: ReturnType<typeof useChatSession>;
  showWorkbench: boolean;
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
  bubbleItems: BubbleItemType[];
  streamEvents: StreamEventRecord[];
}
```

3. Replace the old empty entry call:

```tsx
{
  !props.chat.hasMessages ? (
    <ChatEmptyState chatMode={props.chatMode} onChatModeChange={props.onChatModeChange} />
  ) : null;
}
```

4. Pass chat mode into composer:

```tsx
<ChatComposer chat={props.chat} chatMode={props.chatMode} quickActionChips={quickActionChips} />
```

5. Replace `EmptyFrontlineEntry`:

```tsx
function ChatEmptyState({
  chatMode,
  onChatModeChange
}: {
  chatMode: ChatMode;
  onChatModeChange: (mode: ChatMode) => void;
}) {
  return (
    <div className="chatx-empty-entry">
      <div className="chatx-empty-entry__copy">
        <div className="chatx-empty-entry__brand" aria-hidden="true">
          AC
        </div>
        <Typography.Title level={1}>使用快速模式开始对话</Typography.Title>
        <Segmented
          value={chatMode}
          onChange={value => onChatModeChange(value as ChatMode)}
          options={[
            { label: '快速模式', value: 'quick' },
            { label: '专家模式', value: 'expert' }
          ]}
          className="chatx-mode-switch"
        />
      </div>
    </div>
  );
}
```

6. Update `ChatComposer` signature:

```tsx
function ChatComposer({
  chat,
  chatMode,
  quickActionChips
}: {
  chat: ReturnType<typeof useChatSession>;
  chatMode: ChatMode;
  quickActionChips: QuickActionChip[];
}) {
```

7. Submit with the new helper:

```tsx
const outbound = resolveComposerSubmitForMode(value, suggestedPayload, chatMode);
```

8. Change placeholder:

```tsx
placeholder = '给 Agent Chat 发送消息';
```

9. Replace visible `计划模式` switch with mode-driven styling. If retaining the switch for compatibility, label it `专家模式` and bind it to `chatMode === 'expert'` through `onChatModeChange`.

- [ ] **Step 6: Add empty-state and composer styles**

In `apps/frontend/agent-chat/src/styles/chat-home-workbench.scss`, add:

```scss
.chatx-workbench {
  position: relative;
  height: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  background: #fff;
}

.chatx-chat-column {
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chatx-chat-surface {
  min-height: 0;
  flex: 1 1 auto;
  overflow: auto;
  padding: 64px max(32px, 12vw) 190px;
}

.chatx-empty-entry {
  min-height: calc(100vh - 280px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.chatx-empty-entry__copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  text-align: center;
}

.chatx-empty-entry__brand {
  width: 42px;
  height: 42px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #3867ff;
  color: #fff;
  font-weight: 800;
}

.chatx-empty-entry__copy h1.ant-typography {
  margin: 0;
  color: #151922;
  font-size: 30px;
  line-height: 1.25;
  letter-spacing: 0;
}

.chatx-mode-switch.ant-segmented {
  border-radius: 999px;
  background: #fff;
  box-shadow: inset 0 0 0 1px rgba(17, 24, 39, 0.1);
}

.chatx-composer-shell {
  position: absolute;
  left: 50%;
  bottom: 48px;
  width: min(760px, calc(100% - 96px));
  transform: translateX(-50%);
  border: 1px solid rgba(17, 24, 39, 0.1);
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.1);
}
```

- [ ] **Step 7: Run focused tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-workbench-composer-helpers.test.ts test/pages/chat-home/chat-home-workbench.render.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench-composer-helpers.ts apps/frontend/agent-chat/src/styles/chat-home-workbench.scss apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench.render.test.tsx apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench-composer-helpers.test.ts
git commit -m "feat: add quick and expert chat entry"
```

## Task 5: Conversation Anchor Rail

**Files:**

- Create: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-anchor-rail-helpers.ts`
- Create: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-anchor-rail.tsx`
- Create: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-anchor-rail-helpers.test.ts`
- Modify: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`
- Modify: `apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench.render.test.tsx`
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-workbench.scss`

- [ ] **Step 1: Write failing anchor helper tests**

Create `apps/frontend/agent-chat/test/pages/chat-home/chat-home-anchor-rail-helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildConversationAnchors } from '@/pages/chat-home/chat-home-anchor-rail-helpers';

describe('chat-home-anchor-rail-helpers', () => {
  it('builds anchors for user, assistant, approval, and evidence messages', () => {
    const anchors = buildConversationAnchors([
      { id: 'user-1', role: 'user', content: '你是谁' },
      { id: 'assistant-1', role: 'assistant', content: '我是 Agent Chat' },
      {
        id: 'approval-1',
        role: 'assistant',
        content: '需要审批',
        card: { type: 'approval_request', title: '运行命令审批' }
      },
      {
        id: 'evidence-1',
        role: 'assistant',
        content: '来源摘要',
        card: { type: 'evidence_digest', title: '3 条来源' }
      }
    ] as any);

    expect(anchors).toEqual([
      { id: 'chat-anchor-user-1', messageId: 'user-1', label: '你是谁', tone: 'user' },
      { id: 'chat-anchor-assistant-1', messageId: 'assistant-1', label: '我是 Agent Chat', tone: 'assistant' },
      { id: 'chat-anchor-approval-1', messageId: 'approval-1', label: '运行命令审批', tone: 'approval' },
      { id: 'chat-anchor-evidence-1', messageId: 'evidence-1', label: '3 条来源', tone: 'evidence' }
    ]);
  });

  it('returns no anchors when the current conversation is too short', () => {
    expect(buildConversationAnchors([{ id: 'user-1', role: 'user', content: '短问题' }] as any)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the anchor helper test and verify it fails**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-anchor-rail-helpers.test.ts
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement anchor helper**

Create `apps/frontend/agent-chat/src/pages/chat-home/chat-home-anchor-rail-helpers.ts`:

```ts
import type { ChatMessageRecord } from '@/types/chat-message';

export type ConversationAnchorTone = 'user' | 'assistant' | 'approval' | 'evidence' | 'governance';

export interface ConversationAnchor {
  id: string;
  messageId: string;
  label: string;
  tone: ConversationAnchorTone;
}

export function buildConversationAnchors(messages: ChatMessageRecord[]): ConversationAnchor[] {
  const anchors = messages
    .map(message => {
      const tone = getAnchorTone(message);
      const label = getAnchorLabel(message);

      if (!label) {
        return null;
      }

      return {
        id: `chat-anchor-${message.id}`,
        messageId: message.id,
        label,
        tone
      } satisfies ConversationAnchor;
    })
    .filter((anchor): anchor is ConversationAnchor => Boolean(anchor));

  return anchors.length >= 2 ? anchors : [];
}

function getAnchorTone(message: ChatMessageRecord): ConversationAnchorTone {
  if (message.card?.type === 'approval_request') {
    return 'approval';
  }

  if (message.card?.type === 'evidence_digest') {
    return 'evidence';
  }

  if (message.card?.type === 'learning_summary' || message.card?.type === 'skill_suggestions') {
    return 'governance';
  }

  return message.role === 'user' ? 'user' : 'assistant';
}

function getAnchorLabel(message: ChatMessageRecord): string {
  const cardTitle = typeof message.card?.title === 'string' ? message.card.title.trim() : '';
  const raw = cardTitle || message.content.trim();
  return raw.length > 18 ? `${raw.slice(0, 18)}...` : raw;
}
```

- [ ] **Step 4: Implement anchor rail component**

Create `apps/frontend/agent-chat/src/pages/chat-home/chat-home-anchor-rail.tsx`:

```tsx
import type { ConversationAnchor } from './chat-home-anchor-rail-helpers';

interface ConversationAnchorRailProps {
  anchors: ConversationAnchor[];
  activeAnchorId?: string;
  onSelectAnchor: (anchor: ConversationAnchor) => void;
}

export function ConversationAnchorRail({ anchors, activeAnchorId, onSelectAnchor }: ConversationAnchorRailProps) {
  if (!anchors.length) {
    return null;
  }

  return (
    <aside className="chatx-anchor-rail" aria-label="当前对话定位">
      <div className="chatx-anchor-rail__dots" aria-hidden="true">
        {anchors.slice(0, 4).map(anchor => (
          <span
            key={anchor.id}
            className={`chatx-anchor-rail__dot ${anchor.id === activeAnchorId ? 'is-active' : ''}`}
          />
        ))}
      </div>
      <div className="chatx-anchor-rail__card">
        {anchors.map(anchor => (
          <button
            key={anchor.id}
            type="button"
            className={`chatx-anchor-rail__item is-${anchor.tone} ${anchor.id === activeAnchorId ? 'is-active' : ''}`}
            onClick={() => onSelectAnchor(anchor)}
          >
            <span className="chatx-anchor-rail__label">{anchor.label}</span>
            <span className="chatx-anchor-rail__marker" aria-hidden="true" />
          </button>
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Wire anchors into workbench**

In `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`:

1. Import:

```ts
import { ConversationAnchorRail } from './chat-home-anchor-rail';
import { buildConversationAnchors, type ConversationAnchor } from './chat-home-anchor-rail-helpers';
```

2. Build anchors:

```ts
const conversationAnchors = useMemo(() => buildConversationAnchors(props.chat.messages), [props.chat.messages]);
const [activeAnchorId, setActiveAnchorId] = useState<string | undefined>(undefined);
```

3. Add select handler:

```ts
const handleSelectAnchor = (anchor: ConversationAnchor) => {
  setActiveAnchorId(anchor.id);
  document.getElementById(anchor.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
};
```

4. Render rail inside `.chatx-chat-column`:

```tsx
<ConversationAnchorRail
  anchors={conversationAnchors}
  activeAnchorId={activeAnchorId ?? conversationAnchors[conversationAnchors.length - 1]?.id}
  onSelectAnchor={handleSelectAnchor}
/>
```

5. Ensure each message can receive a DOM id. If `Bubble.List` cannot set per-message wrapper ids directly, wrap it in a container and use anchor ids on lightweight invisible markers before custom message rendering in a later task. For this task, keep helper and rail rendering testable; Task 6 will align actual message wrappers if needed.

- [ ] **Step 6: Add anchor rail render expectations**

In `apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench.render.test.tsx`, add a render case with at least two messages and expect:

```tsx
expect(html).toContain('当前对话定位');
expect(html).toContain('你是谁');
expect(html).toContain('我是 Agent Chat');
expect(html).toContain('chatx-anchor-rail__dot');
```

- [ ] **Step 7: Add anchor rail styles**

Append to `apps/frontend/agent-chat/src/styles/chat-home-workbench.scss`:

```scss
.chatx-anchor-rail {
  position: absolute;
  top: 34%;
  right: 22px;
  z-index: 3;
}

.chatx-anchor-rail__dots {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding: 8px 0;
}

.chatx-anchor-rail__dot,
.chatx-anchor-rail__marker {
  display: inline-block;
  width: 18px;
  height: 4px;
  border-radius: 999px;
  background: #d6d8dd;
}

.chatx-anchor-rail__dot.is-active,
.chatx-anchor-rail__item.is-active .chatx-anchor-rail__marker {
  width: 28px;
  background: #3867ff;
}

.chatx-anchor-rail__card {
  position: absolute;
  top: 50%;
  right: 0;
  min-width: 260px;
  display: none;
  flex-direction: column;
  gap: 6px;
  padding: 18px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
  transform: translateY(-50%);
}

.chatx-anchor-rail:hover .chatx-anchor-rail__dots {
  opacity: 0;
}

.chatx-anchor-rail:hover .chatx-anchor-rail__card {
  display: flex;
}

.chatx-anchor-rail__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  border: 0;
  background: transparent;
  color: #8b929f;
  font-size: 15px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}

.chatx-anchor-rail__item.is-active {
  color: #3867ff;
  font-weight: 700;
}

.chatx-anchor-rail__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home/chat-home-anchor-rail-helpers.test.ts test/pages/chat-home/chat-home-workbench.render.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 5**

```bash
git add apps/frontend/agent-chat/src/pages/chat-home/chat-home-anchor-rail.tsx apps/frontend/agent-chat/src/pages/chat-home/chat-home-anchor-rail-helpers.ts apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx apps/frontend/agent-chat/src/styles/chat-home-workbench.scss apps/frontend/agent-chat/test/pages/chat-home/chat-home-anchor-rail-helpers.test.ts apps/frontend/agent-chat/test/pages/chat-home/chat-home-workbench.render.test.tsx
git commit -m "feat: add conversation anchor rail"
```

## Task 6: Inline Governance Summary and Message Surface Polish

**Files:**

- Modify: `apps/frontend/agent-chat/src/features/chat/chat-message-adapter.tsx`
- Modify: `apps/frontend/agent-chat/src/features/chat/chat-message-adapter-helpers.ts`
- Modify: `apps/frontend/agent-chat/src/styles/chat-home-messages.scss`
- Modify: `apps/frontend/agent-chat/test/features/chat/chat-message-adapter.test.tsx`
- Modify: `apps/frontend/agent-chat/test/features/chat/chat-message-adapter-helpers.test.ts`

- [ ] **Step 1: Add failing test for folded governance copy**

In `apps/frontend/agent-chat/test/features/chat/chat-message-adapter.test.tsx`, add or update a case where `thoughtItems` and `thinkState` exist:

```tsx
expect(html).toContain('已思考');
expect(html).toContain('用时');
expect(html).not.toContain('ThoughtChain timeline');
```

For an evidence card message, assert:

```tsx
expect(html).toContain('来源');
expect(html).toContain('展开详情');
```

- [ ] **Step 2: Run the adapter tests and verify they fail if current copy is still workbench-heavy**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/features/chat/chat-message-adapter.test.tsx test/features/chat/chat-message-adapter-helpers.test.ts
```

Expected: FAIL only for missing new copy/classes. If existing tests fail for unrelated fixture drift, fix fixtures without changing behavior.

- [ ] **Step 3: Keep existing card behavior and tune only summary rendering**

Modify `apps/frontend/agent-chat/src/features/chat/chat-message-adapter.tsx` so assistant messages render a compact summary row before details:

```tsx
<div className="chatx-governance-summary">
  <button type="button" className="chatx-governance-summary__toggle">
    <span className="chatx-governance-summary__icon" aria-hidden="true" />
    <span>已思考{durationLabel ? `（${durationLabel}）` : ''}</span>
    <span aria-hidden="true">⌄</span>
  </button>
  {children}
</div>
```

Use existing `cognitionDurationLabel`, `cognitionCountLabel`, and `onToggleCognition` props. Do not remove `ApprovalRequestCard`, `PlanQuestionCard`, `EvidenceCard`, `SkillSuggestionsCard`, or `LearningSummaryCard`.

- [ ] **Step 4: Add message surface styles**

In `apps/frontend/agent-chat/src/styles/chat-home-messages.scss`, tune for the reference layout:

```scss
.chatx-bubble-list {
  padding: 0;
}

.chatx-bubble-list .ant-bubble {
  max-width: min(880px, calc(100% - 40px));
}

.chatx-bubble-list .ant-bubble-end .ant-bubble-content-filled {
  border-radius: 28px;
  background: #edf4ff;
  color: #151922;
  box-shadow: none;
}

.chatx-bubble-list .ant-bubble-start .ant-bubble-content-shadow,
.chatx-bubble-list .ant-bubble-start .ant-bubble-content-outlined {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.chatx-governance-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chatx-governance-summary__toggle {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  color: #6b7280;
  font-size: 16px;
  cursor: pointer;
}

.chatx-governance-summary__icon {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #3867ff;
}
```

- [ ] **Step 5: Run adapter tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/features/chat/chat-message-adapter.test.tsx test/features/chat/chat-message-adapter-helpers.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add apps/frontend/agent-chat/src/features/chat/chat-message-adapter.tsx apps/frontend/agent-chat/src/features/chat/chat-message-adapter-helpers.ts apps/frontend/agent-chat/src/styles/chat-home-messages.scss apps/frontend/agent-chat/test/features/chat/chat-message-adapter.test.tsx apps/frontend/agent-chat/test/features/chat/chat-message-adapter-helpers.test.ts
git commit -m "feat: fold governance status into chat messages"
```

## Task 7: Documentation and Cleanup

**Files:**

- Modify: `docs/apps/frontend/agent-chat/overview.md`
- Modify: `docs/apps/frontend/agent-chat/README.md` if it still implies a single-session sidebar or default right-side workbench.
- Check: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-sidebar.tsx`
- Check: `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`

- [ ] **Step 1: Update overview documentation**

In `docs/apps/frontend/agent-chat/overview.md`, update the “当前主要承载” list to include:

```md
- DeepSeek-style lightweight frontline shell
- Collapsible multi-session sidebar with time grouping and status indicators
- Quick / expert chat entry mode
- Current-conversation anchor rail for long-thread navigation
- Inline folded governance summaries for Think / ThoughtChain / Evidence / Approval / Learning
```

Replace the old `Agent Workspace Vault 当前实现` wording with:

```md
## 轻量聊天壳与治理能力

`pages/chat-home` 默认呈现轻量聊天壳。左侧是多会话导航，按时间分组并用状态点表达运行中、待审批、失败与完成状态。中间主区域在无消息时展示快速/专家模式入口；快速模式走直接回答，专家模式复用计划/调度提交路径。

右侧默认不占用完整工作台空间。长线程通过当前会话锚点浮条定位用户问题、助手回答、审批点、Evidence 段落与关键治理节点。Think、ThoughtChain、Evidence、Approval、Learning 与 Skill reuse 保留为消息内折叠摘要或高级面板详情，不回退成普通聊天机器人。
```

- [ ] **Step 2: Remove stale single-session language**

Search:

```bash
rg -n "Single frontline session|单会话入口|当前会话卡片|开启新的当前会话|Workspace 默认" docs/apps/frontend/agent-chat apps/frontend/agent-chat/src/pages/chat-home apps/frontend/agent-chat/test/pages/chat-home
```

Expected: No stale references except historical test names that were intentionally updated in previous tasks.

- [ ] **Step 3: Run docs check for docs changes**

Run:

```bash
pnpm check:docs
```

Expected: PASS. If this command is unavailable in the local package scripts, run `pnpm exec prettier --check docs/apps/frontend/agent-chat/overview.md docs/apps/frontend/agent-chat/README.md` and record the substitution in the final delivery notes.

- [ ] **Step 4: Commit Task 7**

```bash
git add docs/apps/frontend/agent-chat/overview.md docs/apps/frontend/agent-chat/README.md
git commit -m "docs: document lightweight agent chat shell"
```

## Task 8: Final Verification

**Files:**

- Verify all files modified by Tasks 1-7.

- [ ] **Step 1: Run focused agent-chat tests**

Run:

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home test/features/chat
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 4: Optional browser visual check**

Start the app:

```bash
pnpm --dir apps/frontend/agent-chat dev
```

Use the in-app browser to inspect:

- Expanded sidebar with grouped sessions.
- Collapsed sidebar rail.
- Empty state with quick/expert switch.
- Active message thread with folded governance summary.
- Right-side anchor rail default and hover states.

Expected: No overlapping text, no card-inside-card shell, no one-note gradient/orb background, and the composer fits at desktop and mobile widths.

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short
```

Expected: Only intended implementation and documentation files are modified or staged. Existing unrelated dirty files from the shared workspace must not be reverted or included.

## Self-Review

- Spec coverage: The plan covers the lightweight shell, brand treatment, collapsible multi-session sidebar, quick/expert modes, message-thread state, right-side anchor rail, governance summaries, tests, verification, and docs cleanup.
- Placeholder scan: No unresolved placeholder markers or hand-wavy deferred implementation steps are present.
- Type consistency: `ChatMode`, `ConversationAnchor`, session grouping helpers, and component props are introduced before use in later tasks.
