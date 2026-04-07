import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SessionListPanel } from '@/features/session-list/session-list-panel';

vi.mock('@/hooks/use-chat-session', () => ({
  formatSessionTime: (value?: string) => (value ? `formatted:${value}` : '刚刚'),
  getSessionStatusLabel: (status?: string) => status ?? 'idle'
}));

vi.mock('@/components/icons', () => ({
  SearchIcon: () => <span>search-icon</span>
}));

describe('session-list-panel', () => {
  it('renders empty sidebar state and disables draft creation while loading', () => {
    const html = renderToStaticMarkup(
      <SessionListPanel
        sessions={[]}
        activeSessionId=""
        loading
        draft="   "
        onDraftCreate={vi.fn()}
        onSelectSession={vi.fn()}
        onToggleRightPanel={vi.fn()}
        showRightPanel={false}
      />
    );

    expect(html).toContain('◨');
    expect(html).toContain('新聊天');
    expect(html).toContain('disabled');
    expect(html).toContain('搜索聊天');
    expect(html).toContain('还没有会话，输入问题即可开始。');
    expect(html).toContain('获取为你量身定制的回复');
  });

  it('renders active sessions, labels and right-panel toggle state', () => {
    const html = renderToStaticMarkup(
      <SessionListPanel
        sessions={
          [
            {
              id: 'session-1',
              title: '排查 runtime 任务',
              status: 'running',
              updatedAt: '2026-04-01T09:00:00.000Z'
            },
            {
              id: 'session-2',
              title: '整理 connector 策略',
              status: 'waiting_approval',
              updatedAt: '2026-04-01T08:00:00.000Z'
            }
          ] as any
        }
        activeSessionId="session-2"
        loading={false}
        draft="帮我审查 runtime"
        onDraftCreate={vi.fn()}
        onSelectSession={vi.fn()}
        onToggleRightPanel={vi.fn()}
        showRightPanel
      />
    );

    expect(html).toContain('◧');
    expect(html).toContain('排查 runtime 任务');
    expect(html).toContain('整理 connector 策略');
    expect(html).toContain('running');
    expect(html).toContain('waiting_approval');
    expect(html).toContain('formatted:2026-04-01T08:00:00.000Z');
    expect(html).toContain('session-item active');
  });
});
