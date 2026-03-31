import { describe, expect, it } from 'vitest';

import {
  buildQuickActionChips,
  buildWorkspaceFollowUpActions,
  buildWorkspaceShareText,
  buildThoughtItems,
  resolveSuggestedDraftSubmission,
  shouldShowMissionControl
} from '@/pages/chat-home/chat-home-workbench';

describe('chat-home-workbench suggestion submission', () => {
  it('keeps the internal workflow payload when submitting an untouched suggestion draft', () => {
    expect(
      resolveSuggestedDraftSubmission('请审查我当前会话里的改动和风险', '/review 请审查我当前会话里的改动和风险')
    ).toEqual({
      display: '请审查我当前会话里的改动和风险',
      payload: '/review 请审查我当前会话里的改动和风险'
    });
  });

  it('falls back to default direct-chat submission after the suggestion draft is edited', () => {
    expect(
      resolveSuggestedDraftSubmission(
        '请审查我当前会话里的改动和风险，并重点看回归点',
        '/review 请审查我当前会话里的改动和风险'
      )
    ).toEqual({
      display: '请审查我当前会话里的改动和风险，并重点看回归点',
      payload: '请审查我当前会话里的改动和风险，并重点看回归点'
    });
  });

  it('leaves plan-mode prefixed payload generation to buildSubmitMessage instead of suggestion resolver', () => {
    expect(resolveSuggestedDraftSubmission('给我一个实现方案', null)).toEqual({
      display: '给我一个实现方案',
      payload: '给我一个实现方案'
    });
  });

  it('offers result follow-up actions after the assistant has produced a settled reply', () => {
    const chat = {
      messages: [
        {
          id: 'assistant-1',
          sessionId: 'session-1',
          role: 'assistant',
          content: '这是已经完成的上一轮回复',
          createdAt: '2026-03-28T00:00:00.000Z'
        }
      ],
      activeSession: {
        id: 'session-1',
        title: '当前会话',
        status: 'completed',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      },
      checkpoint: undefined
    } as never;
    const chips = buildQuickActionChips(chat);
    const followUps = buildWorkspaceFollowUpActions(chat);

    expect(chips.map(item => item.label)).toContain('继续深挖');
    expect(chips.map(item => item.label)).toContain('改成计划');
    expect(followUps.map(item => item.label)).toEqual(
      expect.arrayContaining(['继续深挖', '改成计划', '生成执行任务', '输出检查单'])
    );
  });
});

describe('chat-home-workbench empty session chrome', () => {
  it('hides operational chrome for a fresh idle session', () => {
    expect(
      shouldShowMissionControl({
        messages: [],
        pendingApprovals: [],
        activeSession: {
          id: 'session-1',
          title: '新会话',
          status: 'idle',
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z'
        },
        checkpoint: undefined
      } as never)
    ).toBe(false);
  });

  it('hides mission control once dialogue has started so the thread stays primary', () => {
    expect(
      shouldShowMissionControl({
        messages: [
          {
            id: 'msg-1',
            sessionId: 'session-1',
            role: 'user',
            content: '帮我处理一个问题',
            createdAt: '2026-03-28T00:00:00.000Z'
          }
        ],
        pendingApprovals: [],
        activeSession: {
          id: 'session-1',
          title: '当前会话',
          status: 'idle',
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z'
        },
        checkpoint: undefined
      } as never)
    ).toBe(false);
  });

  it('shows mission control for a running session before any message is visible', () => {
    expect(
      shouldShowMissionControl({
        messages: [],
        pendingApprovals: [],
        activeSession: {
          id: 'session-1',
          title: '当前会话',
          status: 'running',
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z'
        },
        checkpoint: {
          sessionId: 'session-1',
          taskId: 'optimistic_session-1',
          traceCursor: 0,
          messageCursor: 0,
          approvalCursor: 0,
          learningCursor: 0,
          pendingApprovals: [],
          agentStates: [],
          graphState: {
            status: 'running'
          },
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z'
        }
      } as never)
    ).toBe(true);
  });
});

describe('chat-home-workbench thought items', () => {
  it('adds capability usage summary into thought items instead of relying on skill cards', () => {
    const items = buildThoughtItems({
      events: [],
      checkpoint: {
        sessionId: 'session-1',
        taskId: 'task-1',
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        learningCursor: 0,
        pendingApprovals: [],
        agentStates: [],
        graphState: {
          status: 'running'
        },
        usedInstalledSkills: ['find-skills'],
        usedCompanyWorkers: ['repo-reviewer'],
        connectorRefs: ['github-mcp'],
        currentWorker: 'code-worker',
        currentMinistry: '工部',
        updatedAt: '2026-03-28T00:00:00.000Z',
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    } as never);

    expect(items[0]).toEqual(
      expect.objectContaining({
        title: '能力链路',
        description: expect.stringContaining('已复用 find-skills')
      })
    );
    expect(String(items[0]?.description)).toContain('已接入 github-mcp');
    expect(String(items[0]?.description)).toContain('当前由 code-worker 推进');
  });

  it('shows only the new optimistic thought item when a fresh turn starts', () => {
    const items = buildThoughtItems({
      events: [
        {
          id: 'evt-old',
          sessionId: 'session-1',
          type: 'ministry_started',
          at: '2026-03-28T00:00:00.000Z',
          payload: {
            summary: '上一轮的旧进度'
          }
        }
      ],
      checkpoint: {
        sessionId: 'session-1',
        taskId: 'optimistic_session-1',
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        learningCursor: 0,
        pendingApprovals: [],
        agentStates: [],
        graphState: {
          status: 'running',
          currentStep: 'drafting_reply'
        },
        thinkState: {
          messageId: 'pending_assistant_session-1',
          title: '正在准备回复',
          content: '正在梳理你刚刚的消息，整理最合适的回复和下一步动作。',
          loading: true,
          blink: true
        },
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    } as never);

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        title: '正在准备回复',
        footer: '正在准备这轮回复'
      })
    );
  });

  it('builds workspace share text from the current snapshot', () => {
    const content = buildWorkspaceShareText({
      messages: [
        {
          id: 'user-1',
          sessionId: 'session-1',
          role: 'user',
          content: '请继续完善当前实现计划',
          createdAt: '2026-03-28T00:00:00.000Z'
        },
        {
          id: 'assistant-1',
          sessionId: 'session-1',
          role: 'assistant',
          content: '建议先修多轮状态，再补项目上下文。',
          createdAt: '2026-03-28T00:00:01.000Z'
        }
      ],
      pendingApprovals: [],
      activeSession: {
        id: 'session-1',
        title: '当前会话',
        status: 'running',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      },
      checkpoint: {
        sessionId: 'session-1',
        taskId: 'task-1',
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        learningCursor: 0,
        pendingApprovals: [],
        agentStates: [],
        graphState: {
          status: 'running'
        },
        usedInstalledSkills: ['find-skills'],
        connectorRefs: ['github-mcp'],
        currentWorker: 'code-worker',
        currentMinistry: '工部',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    } as never);

    expect(content).toContain('当前目标：请继续完善当前实现计划');
    expect(content).toContain('最新结论：建议先修多轮状态，再补项目上下文。');
    expect(content).toContain('技能数：1');
    expect(content).toContain('连接器数：1');
  });
});
