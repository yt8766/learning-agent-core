import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AgentStateList, AgentStatusPanel } from '@/features/agent-status/agent-status-panel';

vi.mock('@/hooks/use-chat-session', () => ({
  formatSessionTime: (value?: string) => (value ? `formatted:${value}` : '刚刚'),
  getSessionStatusLabel: (status?: string) => status ?? 'idle'
}));

describe('agent-status-panel', () => {
  it('renders active session details, progress and action states', () => {
    const html = renderToStaticMarkup(
      <AgentStatusPanel
        activeSession={
          {
            id: 'session-1',
            status: 'running',
            updatedAt: '2026-04-01T10:00:00.000Z'
          } as any
        }
        checkpoint={
          {
            streamStatus: {
              nodeLabel: 'Executor',
              detail: '正在执行工具',
              progressPercent: 72
            },
            currentSkillExecution: {
              displayName: 'Browser',
              stepIndex: 2,
              totalSteps: 4,
              title: '打开控制台'
            },
            graphState: {
              retryCount: 1,
              maxRetries: 3,
              currentStep: 'executor'
            }
          } as any
        }
        loading={false}
        activeSessionId="session-1"
        onRecover={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    expect(html).toContain('running');
    expect(html).toContain('Executor');
    expect(html).toContain('正在执行工具（72%）');
    expect(html).toContain('Browser · 2/4 · 打开控制台');
    expect(html).toContain('1/3');
    expect(html).toContain('formatted:2026-04-01T10:00:00.000Z');
    expect(html).toContain('恢复会话');
    expect(html).toContain('刷新');
  });

  it('renders empty checkpoint state and disabled actions when there is no active session', () => {
    const html = renderToStaticMarkup(
      <AgentStatusPanel loading activeSessionId="" onRecover={vi.fn()} onRefresh={vi.fn()} />
    );

    expect(html).toContain('未开始');
    expect(html).toContain('尚未开始');
    expect(html).toContain('当前还没有新的节点战报');
    expect(html).toContain('当前未进入 Skill 合同步骤');
    expect(html).toContain('0/0');
    expect(html).toContain('disabled');
  });

  it('renders agent state labels and empty fallback', () => {
    const richHtml = renderToStaticMarkup(
      <AgentStateList
        checkpoint={
          {
            agentStates: [
              { role: 'manager', status: 'running' },
              { role: 'research', status: 'waiting_interrupt' },
              { role: 'reviewer', status: 'completed' },
              { role: 'executor', status: 'blocked' },
              { role: 'other', status: 'unknown' }
            ]
          } as any
        }
      />
    );
    const emptyHtml = renderToStaticMarkup(<AgentStateList />);

    expect(richHtml).toContain('处理中');
    expect(richHtml).toContain('待澄清方案');
    expect(richHtml).toContain('已完成');
    expect(richHtml).toContain('已阻塞');
    expect(richHtml).toContain('待处理');
    expect(emptyHtml).toContain('暂无 Agent 状态');
  });
});
