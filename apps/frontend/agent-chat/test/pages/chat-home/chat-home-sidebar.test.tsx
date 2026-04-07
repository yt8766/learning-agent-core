import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ChatHomeSidebar } from '@/pages/chat-home/chat-home-sidebar';

describe('ChatHomeSidebar', () => {
  it('renders single-session summary instead of multi-session list', () => {
    const html = renderToStaticMarkup(
      <ChatHomeSidebar
        chat={
          {
            activeSession: {
              id: 'session-1',
              title: '当前作战会话',
              status: 'running',
              createdAt: '2026-03-28T00:00:00.000Z',
              updatedAt: '2026-03-28T00:00:00.000Z'
            },
            activeSessionId: 'session-1',
            checkpoint: {
              sessionId: 'session-1',
              taskId: 'task-1',
              traceCursor: 0,
              messageCursor: 0,
              approvalCursor: 0,
              learningCursor: 0,
              pendingApprovals: [],
              agentStates: [],
              graphState: { status: 'running' },
              createdAt: '2026-03-28T00:00:00.000Z',
              updatedAt: '2026-03-28T00:00:00.000Z',
              chatRoute: {
                graph: 'workflow',
                flow: 'supervisor',
                reason: 'complex task',
                adapter: 'general-prompt',
                priority: 1
              },
              currentMinistry: 'gongbu-code'
            },
            createNewSession: () => Promise.resolve(),
            refreshSessionDetail: () => Promise.resolve(undefined),
            setShowRightPanel: () => undefined
          } as never
        }
      />
    );

    expect(html).toContain('Single frontline session');
    expect(html).toContain('当前会话');
    expect(html).toContain('开启新的当前会话');
    expect(html).not.toContain('刷新当前会话');
    expect(html).not.toContain('查看运行总览');
    expect(html).not.toContain('搜索会话标题');
  });
});
