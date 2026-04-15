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

  it('shows mission control when there are pending approvals even before dialogue starts', () => {
    expect(
      shouldShowMissionControl({
        messages: [],
        pendingApprovals: [{ intent: 'run_command' }],
        activeSession: {
          id: 'session-1',
          title: '当前会话',
          status: 'idle',
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z'
        },
        checkpoint: undefined
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
        streamStatus: {
          nodeId: 'context_filter',
          nodeLabel: '文书科',
          detail: '正在压缩历史上下文并整理给工部的摘要',
          progressPercent: 45,
          updatedAt: '2026-03-28T00:00:00.000Z'
        },
        updatedAt: '2026-03-28T00:00:00.000Z',
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    } as never);

    expect(items[0]).toEqual(
      expect.objectContaining({
        title: '文书科',
        description: expect.stringContaining('正在压缩历史上下文并整理给工部的摘要')
      })
    );
    expect(items[1]).toEqual(
      expect.objectContaining({
        title: '能力链路',
        description: expect.stringContaining('已复用 find-skills')
      })
    );
    expect(String(items[1]?.description)).toContain('已接入 github-mcp');
    expect(String(items[1]?.description)).toContain('当前由 code-worker 推进');
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

  it('marks settled timeline events as success instead of leaving them in loading state', () => {
    const items = buildThoughtItems({
      events: [
        {
          id: 'evt-session-started',
          sessionId: 'session-1',
          type: 'session_started',
          at: '2026-04-07T10:07:49.865Z',
          payload: {}
        },
        {
          id: 'evt-user-message',
          sessionId: 'session-1',
          type: 'user_message',
          at: '2026-04-07T10:07:51.512Z',
          payload: { content: '我现在有什么技能' }
        },
        {
          id: 'evt-assistant-message',
          sessionId: 'session-1',
          type: 'assistant_message',
          at: '2026-04-07T10:07:51.512Z',
          payload: { content: '当前可见 2 个运行时 skill。' }
        }
      ],
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
          status: 'completed'
        },
        createdAt: '2026-04-07T10:07:49.865Z',
        updatedAt: '2026-04-07T10:07:51.512Z'
      }
    } as never);

    expect(items.slice(0, 3)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Agent 回复', status: 'success' }),
        expect.objectContaining({ title: '用户消息', status: 'success' }),
        expect.objectContaining({ title: '会话启动', status: 'success' })
      ])
    );
  });

  it('prefers active-message scoped thought chain and surfaces pending skill / missing connector capability state', () => {
    const items = buildThoughtItems({
      activeSessionId: 'session-1',
      events: [
        {
          id: 'evt-node-end-1',
          sessionId: 'session-1',
          type: 'node_status',
          at: '2026-04-07T10:07:50.000Z',
          payload: {
            phase: 'end',
            nodeId: 'planning',
            nodeLabel: '规划节点',
            detail: '已完成任务规划'
          }
        },
        {
          id: 'evt-node-end-2',
          sessionId: 'session-1',
          type: 'node_status',
          at: '2026-04-07T10:07:51.000Z',
          payload: {
            phase: 'end',
            nodeId: 'execution',
            nodeLabel: '执行节点',
            detail: '已完成执行'
          }
        }
      ],
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
          status: 'running',
          currentStep: 'execute'
        },
        thinkState: {
          messageId: 'assistant-msg-1',
          title: '当前思考',
          content: '正在执行',
          loading: false,
          blink: false
        },
        thoughtChain: [
          {
            key: 'thought-1',
            title: '针对当前消息',
            description: '只保留当前消息相关 thought',
            messageId: 'assistant-msg-1'
          },
          {
            key: 'thought-2',
            title: '历史消息',
            description: '不应该出现',
            messageId: 'assistant-msg-2'
          }
        ],
        pendingApproval: {
          toolName: 'skill-installer',
          intent: 'install_skill',
          requestedBy: 'gongbu',
          preview: [{ label: 'Skill', value: 'repo-inspector' }]
        },
        skillSearch: {
          capabilityGapDetected: true,
          suggestions: [],
          mcpRecommendation: {
            kind: 'connector',
            summary: 'need browser',
            reason: 'missing connector',
            connectorTemplateId: 'browser-mcp-template'
          }
        },
        createdAt: '2026-04-07T10:07:49.865Z',
        updatedAt: '2026-04-07T10:07:51.512Z'
      }
    } as never);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: '规划节点', status: 'success' }),
        expect.objectContaining({
          title: '能力链路',
          description: expect.stringContaining('等待安装 repo-inspector')
        }),
        expect.objectContaining({
          key: 'thought-1',
          title: '针对当前消息'
        })
      ])
    );
    expect(items.some(item => item.key === 'thought-2')).toBe(false);
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

  it('builds execute-stage quick actions and keeps labels deduped to five items', () => {
    const chips = buildQuickActionChips({
      messages: [],
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
          status: 'running',
          currentStep: 'execute'
        },
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    } as never);

    expect(chips).toHaveLength(5);
    expect(chips.map(item => item.label)).toContain('给出下一步改动');
    expect(chips.map(item => item.label)).toContain('代码修改');
    expect(new Set(chips.map(item => item.label)).size).toBe(chips.length);
  });
});
