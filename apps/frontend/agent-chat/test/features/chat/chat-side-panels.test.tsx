import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AgentStateList, AgentStatusPanel } from '@/features/agent-status/agent-status-panel';
import { ApprovalPanel } from '@/features/approvals/approval-panel';
import { ChatThread } from '@/features/chat-thread/chat-thread';
import { EventTimelinePanel } from '@/features/event-timeline/event-timeline-panel';
import { LearningPanel } from '@/features/learning/learning-panel';
import { SessionListPanel } from '@/features/session-list/session-list-panel';

describe('chat side panels render coverage', () => {
  it('renders agent status, learning state, approvals and event timeline summaries', () => {
    const statusHtml = renderToStaticMarkup(
      <AgentStatusPanel
        activeSession={
          {
            id: 'session-1',
            title: '当前会话',
            status: 'running',
            createdAt: '2026-04-01T12:00:00.000Z',
            updatedAt: '2026-04-01T12:03:00.000Z'
          } as any
        }
        checkpoint={
          {
            streamStatus: {
              nodeLabel: '文书科',
              detail: '正在压缩历史上下文',
              progressPercent: 45
            },
            graphState: {
              currentStep: 'context_filter',
              retryCount: 1,
              maxRetries: 3
            },
            currentSkillExecution: {
              displayName: 'Skill 安装',
              stepIndex: 2,
              totalSteps: 5,
              title: '校验清单'
            }
          } as any
        }
        loading={false}
        activeSessionId="session-1"
        onRecover={vi.fn()}
        onRefresh={vi.fn()}
      />
    );

    const approvalsHtml = renderToStaticMarkup(
      <ApprovalPanel
        approvals={[
          {
            intent: 'enable_connector',
            decision: 'pending',
            reason: '需要人工确认生产连接器'
          } as any
        ]}
        onDecision={vi.fn()}
      />
    );

    const learningHtml = renderToStaticMarkup(
      <LearningPanel status="waiting_learning_confirmation" loading={false} onConfirm={vi.fn()} />
    );

    const eventsHtml = renderToStaticMarkup(
      <EventTimelinePanel
        events={[
          {
            id: 'evt-1',
            sessionId: 'session-1',
            type: 'interrupt_pending',
            at: '2026-04-01T12:03:00.000Z',
            payload: {
              interactionKind: 'plan-question',
              interruptMode: 'blocking',
              summary: '需要补充计划细节',
              from: 'manager',
              node: 'planning'
            }
          } as any,
          {
            id: 'evt-2',
            sessionId: 'session-1',
            type: 'conversation_compacted',
            at: '2026-04-01T12:02:00.000Z',
            payload: {
              condensedMessageCount: 12
            }
          } as any,
          {
            id: 'evt-3',
            sessionId: 'session-1',
            type: 'tool_stream_dispatched',
            at: '2026-04-01T12:01:00.000Z',
            payload: {
              toolName: 'read_local_file',
              scheduling: 'concurrent'
            }
          } as any,
          {
            id: 'evt-4',
            sessionId: 'session-1',
            type: 'context_compaction_retried',
            at: '2026-04-01T12:00:30.000Z',
            payload: {
              reactiveRetryCount: 1,
              stage: 'conversation-summary'
            }
          } as any,
          {
            id: 'evt-5',
            sessionId: 'session-1',
            type: 'approval_required',
            at: '2026-04-01T12:00:00.000Z',
            payload: {
              interactionKind: 'supplemental-input',
              watchdog: true,
              runtimeGovernanceReasonCode: 'watchdog_timeout',
              interruptSource: 'tool'
            }
          } as any
        ]}
      />
    );

    expect(statusHtml).toContain('当前会话');
    expect(statusHtml).toContain('文书科');
    expect(statusHtml).toContain('Skill 安装');
    expect(statusHtml).toContain('1/3');
    expect(approvalsHtml).toContain('enable_connector');
    expect(approvalsHtml).toContain('需要人工确认生产连接器');
    expect(learningHtml).toContain('待确认');
    expect(learningHtml).toContain('确认学习沉淀');
    expect(eventsHtml).toContain('等待方案澄清');
    expect(eventsHtml).toContain('已压缩 12 条较早消息');
    expect(eventsHtml).toContain('read_local_file 已派发执行');
    expect(eventsHtml).toContain('触发应急压缩并重试');
    expect(eventsHtml).toContain('运行时治理中断');
    expect(eventsHtml).toContain('来源：主 Agent');
  });

  it('renders thread, session list, and agent state fallback branches', () => {
    const threadHtml = renderToStaticMarkup(
      <ChatThread
        messages={[
          {
            id: 'msg-1',
            sessionId: 'session-1',
            role: 'assistant',
            linkedAgent: 'reviewer',
            content: '这是回复',
            createdAt: '2026-04-01T12:03:00.000Z'
          } as any
        ]}
      />
    );

    const sessionsHtml = renderToStaticMarkup(
      <SessionListPanel
        sessions={[
          {
            id: 'session-1',
            title: '诊断 runtime',
            status: 'completed',
            updatedAt: '2026-04-01T12:03:00.000Z'
          } as any
        ]}
        activeSessionId="session-1"
        loading={false}
        draft="请帮我排查问题"
        onDraftCreate={vi.fn()}
        onSelectSession={vi.fn()}
        onToggleRightPanel={vi.fn()}
        showRightPanel
      />
    );

    const statesHtml = renderToStaticMarkup(
      <AgentStateList
        checkpoint={
          {
            agentStates: [
              { role: 'manager', status: 'running' },
              { role: 'reviewer', status: 'waiting_interrupt' },
              { role: 'executor', status: 'failed' }
            ]
          } as any
        }
      />
    );

    const emptyThreadHtml = renderToStaticMarkup(<ChatThread messages={[]} />);
    const emptyStateHtml = renderToStaticMarkup(<AgentStateList checkpoint={{ agentStates: [] } as any} />);

    expect(threadHtml).toContain('Reviewer Agent');
    expect(threadHtml).toContain('这是回复');
    expect(sessionsHtml).toContain('新聊天');
    expect(sessionsHtml).toContain('最近会话');
    expect(sessionsHtml).toContain('Ctrl + Shift + O');
    expect(sessionsHtml).toContain('诊断 runtime');
    expect(statesHtml).toContain('处理中');
    expect(statesHtml).toContain('待澄清方案');
    expect(statesHtml).toContain('异常');
    expect(emptyThreadHtml).toContain('提出问题');
    expect(emptyStateHtml).toContain('暂无 Agent 状态');
  });
});
