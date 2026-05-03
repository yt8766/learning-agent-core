import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';

import {
  buildQuickActionChips,
  buildWorkspaceFollowUpActions,
  buildWorkspaceShareText,
  buildWorkspaceVaultSignals,
  buildThoughtItems,
  resolveSuggestedDraftSubmission,
  shouldShowMissionControl
} from '@/pages/chat-home/chat-home-workbench';

vi.mock('@ant-design/x', () => ({
  Bubble: () => null,
  Sender: () => null
}));

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

describe('chat-home workspace vault signals', () => {
  it('summarizes workspace evidence, reuse, skill draft readiness and capability gaps outside the chat thread', () => {
    const signals = buildWorkspaceVaultSignals({
      activeSession: {
        id: 'session-1',
        title: '当前会话',
        status: 'waiting_learning_confirmation',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      },
      messages: [],
      pendingApprovals: [],
      checkpoint: {
        externalSources: [{ id: 'source-1' }, { id: 'source-2' }],
        reusedMemories: ['memory-1'],
        reusedRules: ['rule-1'],
        reusedSkills: ['repo-analysis'],
        usedInstalledSkills: ['find-skills'],
        usedCompanyWorkers: ['repo-reviewer'],
        connectorRefs: ['github-mcp'],
        learningEvaluation: {
          score: 0.91,
          confidence: 'high',
          notes: ['已形成可复用经验'],
          recommendedCandidateIds: ['candidate-1', 'candidate-2'],
          autoConfirmCandidateIds: ['candidate-1'],
          sourceSummary: {
            externalSourceCount: 2,
            internalSourceCount: 1,
            reusedMemoryCount: 1,
            reusedRuleCount: 1,
            reusedSkillCount: 1
          }
        },
        skillSearch: {
          capabilityGapDetected: true,
          status: 'suggested',
          safetyNotes: ['需要审批后安装'],
          suggestions: [
            {
              id: 'skill-suggestion-1',
              kind: 'remote-skill',
              displayName: 'repo-inspector',
              summary: '分析仓库结构',
              score: 0.87,
              availability: 'approval-required',
              reason: '需要更强仓库分析能力',
              requiredCapabilities: ['repo.read']
            }
          ],
          mcpRecommendation: {
            kind: 'connector',
            summary: '需要浏览器连接器',
            reason: '当前缺少网页检查能力',
            connectorTemplateId: 'browser-mcp-template'
          }
        }
      }
    } as never);

    expect(signals).toEqual([
      expect.objectContaining({ label: 'Workspace signals', value: '7 项', tone: 'blue' }),
      expect.objectContaining({ label: 'Evidence readiness', value: '2 条来源', detail: 'internal 1' }),
      expect.objectContaining({ label: 'Reuse readiness', value: '5 项复用', detail: '技能 2 · 角色 1 · 连接器 1' }),
      expect.objectContaining({
        label: 'Skill draft readiness',
        value: '2 个候选',
        detail: 'auto 1 · confidence high'
      }),
      expect.objectContaining({ label: 'Capability gap', value: '待补强', detail: '需要浏览器连接器' })
    ]);
    expect(JSON.stringify(signals)).not.toContain('learning_summary');
  });

  it('adds read-only workspace-center projection readiness without exposing install actions', () => {
    const signals = buildWorkspaceVaultSignals(
      {
        activeSession: {
          id: 'session-1',
          title: '当前会话',
          status: 'completed',
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z'
        },
        messages: [],
        pendingApprovals: [],
        checkpoint: undefined
      } as never,
      {
        workspaceId: 'workspace-platform',
        workspaceName: 'Agent Workspace',
        workspaceStatus: 'active',
        updatedAt: '2026-04-26T08:10:00.000Z',
        skillDraftCount: 3,
        activeDraftCount: 2,
        approvedDraftCount: 1,
        installedDraftCount: 1,
        failedDraftCount: 0,
        pendingInstallCount: 1,
        highConfidenceDraftCount: 2,
        reuseRecordCount: 4,
        topDraftTitles: ['Repo Analyzer', 'Review Helper']
      }
    );

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Workspace Center',
          value: '2 ready / 3 drafts',
          detail: 'approved 1 · reuse 4 · top Repo Analyzer, Review Helper',
          tone: 'green'
        })
      ])
    );
    expect(JSON.stringify(signals)).not.toContain('安装');
    expect(JSON.stringify(signals)).not.toContain('approveWorkspaceSkillDraft');
    expect(JSON.stringify(signals)).not.toContain('installRemoteSkill');
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

  it('for direct-reply narrative thought chain, surfaces only mapped cognition steps without runtime stream noise', () => {
    const items = buildThoughtItems({
      events: [
        {
          id: 'evt-node',
          sessionId: 'session-1',
          type: 'node_status',
          at: '2026-05-03T00:00:00.000Z',
          payload: {
            phase: 'end',
            nodeId: 'direct_reply',
            nodeLabel: '直接回复',
            detail: '事件已记录'
          }
        }
      ],
      checkpoint: {
        sessionId: 'session-1',
        taskId: 'task-dr',
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        learningCursor: 0,
        pendingApprovals: [],
        agentStates: [],
        graphState: { status: 'completed', currentStep: 'direct_reply' },
        chatRoute: {
          graph: 'workflow',
          flow: 'direct-reply',
          reason: 'test',
          adapter: 'general-prompt',
          priority: 80
        },
        thinkState: {
          messageId: 'msg-a',
          title: '直接回复',
          content: '推理摘要',
          loading: false
        },
        thoughtChain: [
          {
            key: 'intent',
            messageId: 'msg-a',
            kind: 'reasoning',
            title: '理解问题',
            description: '先对齐问题边界。',
            status: 'success'
          },
          {
            key: 'search',
            messageId: 'msg-a',
            kind: 'web_search',
            title: '搜索网页',
            description: '搜索到 1 个网页',
            status: 'success',
            webSearch: {
              query: 'brew',
              hits: [{ url: 'https://brew.sh', title: 'Homebrew', host: 'brew.sh' }]
            }
          }
        ],
        streamStatus: {
          nodeId: 'direct_reply',
          nodeLabel: '直接回复',
          detail: '流式生成中',
          progressPercent: 50
        },
        createdAt: '2026-05-03T00:00:00.000Z',
        updatedAt: '2026-05-03T00:00:00.000Z'
      }
    } as never);

    expect(items.some(i => i.title === '能力链路')).toBe(false);
    expect(items.some(i => i.title === '直接回复')).toBe(false);
    expect(items.map(i => i.key)).toEqual(['intent', 'search']);
    expect(items[1]?.hits?.length).toBe(1);
    expect(items[1]?.hits?.[0]?.url).toBe('https://brew.sh');
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

  it('marks settled timeline events as success and excludes filtered types from thought log', () => {
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

    expect(items).toEqual([
      expect.objectContaining({ key: 'evt-session-started', title: '会话启动', status: 'success' })
    ]);
    expect(items.some(item => item.key === 'evt-user-message')).toBe(false);
    expect(items.some(item => item.key === 'evt-assistant-message')).toBe(false);
  });

  it('projects task trajectory and trajectory step events into readable thought items', () => {
    const items = buildThoughtItems({
      events: [
        {
          id: 'evt-trajectory',
          sessionId: 'session-1',
          type: 'node_progress',
          at: '2026-04-26T08:10:00.000Z',
          payload: {
            projection: 'task_trajectory',
            taskId: 'task-1',
            taskTrajectory: {
              trajectoryId: 'trajectory-1',
              taskId: 'task-1',
              status: 'succeeded',
              summary: {
                title: '前端轨迹接入',
                outcome: '已把执行轨迹纳入 OpenClaw 工作区。'
              },
              steps: [
                {
                  stepId: 'step-1',
                  taskId: 'task-1',
                  sequence: 1,
                  type: 'tool_requested',
                  title: '请求测试工具',
                  actor: 'runtime',
                  status: 'succeeded',
                  startedAt: '2026-04-26T08:00:00.000Z',
                  inputRefs: [],
                  outputRefs: [],
                  evidenceIds: []
                },
                {
                  stepId: 'step-2',
                  taskId: 'task-1',
                  sequence: 2,
                  type: 'tool_executed',
                  title: '执行测试',
                  summary: '17 个前端测试已通过。',
                  actor: 'execution_node',
                  status: 'succeeded',
                  startedAt: '2026-04-26T08:01:00.000Z',
                  inputRefs: [],
                  outputRefs: ['artifact-1'],
                  evidenceIds: ['evidence-1']
                }
              ]
            }
          }
        },
        {
          id: 'evt-step',
          sessionId: 'session-1',
          type: 'trajectory_step',
          at: '2026-04-26T08:09:00.000Z',
          payload: {
            stepId: 'step-3',
            taskId: 'task-1',
            sequence: 3,
            type: 'finalized',
            title: '整理交付',
            summary: '最终回复准备完成。',
            actor: 'supervisor',
            status: 'running',
            inputRefs: [],
            outputRefs: [],
            evidenceIds: []
          }
        }
      ],
      checkpoint: undefined
    } as never);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: '节点进度',
          description: '前端轨迹接入：已把执行轨迹纳入 OpenClaw 工作区。',
          status: 'success'
        }),
        expect.objectContaining({
          title: '轨迹步骤',
          description: '轨迹步骤 3：整理交付。最终回复准备完成。',
          status: 'loading'
        })
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

  it('excludes assistant_token, assistant_message, final_response_*, session_finished and user_message events from thought log', () => {
    const items = buildThoughtItems({
      events: [
        {
          id: 'evt-1',
          sessionId: 's',
          type: 'assistant_token',
          at: '2026-05-01T00:00:00.000Z',
          payload: { content: '流式片段' }
        },
        {
          id: 'evt-2',
          sessionId: 's',
          type: 'assistant_message',
          at: '2026-05-01T00:00:01.000Z',
          payload: { content: '完整回复' }
        },
        {
          id: 'evt-3',
          sessionId: 's',
          type: 'final_response_completed',
          at: '2026-05-01T00:00:02.000Z',
          payload: { content: '最终回复' }
        },
        {
          id: 'evt-4',
          sessionId: 's',
          type: 'final_response_delta',
          at: '2026-05-01T00:00:03.000Z',
          payload: { content: '增量' }
        },
        { id: 'evt-5', sessionId: 's', type: 'session_finished', at: '2026-05-01T00:00:04.000Z', payload: {} },
        {
          id: 'evt-6',
          sessionId: 's',
          type: 'user_message',
          at: '2026-05-01T00:00:05.000Z',
          payload: { content: '用户消息' }
        },
        {
          id: 'evt-7',
          sessionId: 's',
          type: 'ministry_started',
          at: '2026-05-01T00:00:06.000Z',
          payload: { summary: '工部启动' }
        }
      ],
      checkpoint: undefined
    } as never);

    expect(items.some(item => item.key === 'evt-1')).toBe(false);
    expect(items.some(item => item.key === 'evt-2')).toBe(false);
    expect(items.some(item => item.key === 'evt-3')).toBe(false);
    expect(items.some(item => item.key === 'evt-4')).toBe(false);
    expect(items.some(item => item.key === 'evt-5')).toBe(false);
    expect(items.some(item => item.key === 'evt-6')).toBe(false);
    expect(items.some(item => item.key === 'evt-7')).toBe(true);
  });
});

describe('chat-home-workbench share & quick actions', () => {
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
