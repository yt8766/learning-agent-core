import { describe, expect, it } from 'vitest';

import {
  buildEventCard,
  buildVisibleEventMessage,
  syncMessageFromEvent,
  syncProcessMessageFromEvent,
  syncSessionFromEvent
} from '@/hooks/chat-session/chat-session-events';
import { syncCheckpointFromStreamEvent } from '@/hooks/chat-session/chat-session-stream';
import type { ChatMessageRecord, ChatSessionRecord } from '@/types/chat';

describe('chat-session-events', () => {
  it('buildEventCard 会把 interrupt_pending 的 reasonCode 和 preview 映射到审批卡片', () => {
    const card = buildEventCard({
      id: 'evt-1',
      sessionId: 'session-1',
      type: 'interrupt_pending',
      at: '2026-03-28T00:00:00.000Z',
      payload: {
        intent: 'write_file',
        toolName: 'write_local_file',
        reason: '路径属于敏感位置，需要审批。',
        reasonCode: 'requires_approval_destructive',
        riskLevel: 'high',
        requestedBy: 'gongbu-code',
        interruptId: 'interrupt-1',
        interruptSource: 'graph',
        interruptMode: 'blocking',
        resumeStrategy: 'command',
        preview: [{ label: 'Path', value: '.env.local' }]
      }
    });

    expect(card).toEqual(
      expect.objectContaining({
        type: 'approval_request',
        intent: 'write_file',
        toolName: 'write_local_file',
        reason: '路径属于敏感位置，需要审批。',
        reasonCode: 'requires_approval_destructive',
        riskLevel: 'high',
        requestedBy: 'gongbu-code',
        interruptId: 'interrupt-1',
        interruptSource: 'graph',
        interruptMode: 'blocking',
        resumeStrategy: 'command',
        status: 'pending',
        displayStatus: 'pending',
        isPrimaryActionAvailable: true,
        serverId: undefined,
        capabilityId: undefined,
        preview: [{ label: 'Path', value: '.env.local' }]
      })
    );
  });

  it('buildVisibleEventMessage 会把 approval_required 翻译成阻塞式中断确认文案', () => {
    const content = buildVisibleEventMessage({
      id: 'evt-interrupt-1',
      sessionId: 'session-1',
      type: 'interrupt_pending',
      at: '2026-03-28T00:00:00.000Z',
      payload: {
        intent: 'install_skill',
        toolName: 'npx skills add',
        requestedBy: 'hubu-search',
        reason: '需要先安装 find-skills。',
        interruptSource: 'graph',
        interruptMode: 'blocking'
      }
    } as any);

    expect(content).toContain('阻塞式中断确认');
    expect(content).toContain('npx skills add');
    expect(content).toContain('由 hubu-search 发起');
    expect(content).toContain('由图内中断触发');
  });

  it('buildVisibleEventMessage 会把 planning_readonly_guard 翻译成计划只读提示', () => {
    const content = buildVisibleEventMessage({
      id: 'evt-guard-1',
      sessionId: 'session-1',
      type: 'research_progress',
      at: '2026-03-28T00:00:00.000Z',
      payload: {
        node: 'planning_readonly_guard',
        summary: '规划阶段已启用只读研究边界。'
      }
    } as any);

    expect(content).toContain('计划只读保护已启用');
    expect(content).toContain('open-web');
    expect(content).toContain('终端');
  });

  it('buildVisibleEventMessage 会把 conversation_compacted 翻译成轻量压缩提示', () => {
    const content = buildVisibleEventMessage({
      id: 'evt-compact-1',
      sessionId: 'session-1',
      type: 'conversation_compacted',
      at: '2026-03-28T00:00:00.000Z',
      payload: {
        condensedMessageCount: 12,
        previewMessages: [
          { role: 'user', content: '先说计划模式。' },
          { role: 'assistant', content: '再说技能安装。' }
        ],
        summary: '我们先讨论了计划模式和中断设计，随后收敛到技能安装与前端可见性。'
      }
    } as any);

    expect(content).toBe('正在自动压缩背景信息');
  });

  it('buildVisibleEventMessage 会把 node_progress 翻译成当前节点战报', () => {
    const content = buildVisibleEventMessage({
      id: 'evt-node-1',
      sessionId: 'session-1',
      type: 'node_progress',
      at: '2026-03-28T00:00:00.000Z',
      payload: {
        ministry: 'gongbu-code',
        nodeLabel: '工部执行',
        phase: 'progress',
        detail: '正在修复 plugin.ts',
        progressPercent: 60
      }
    } as any);

    expect(content).toBe('gongbu-code · 工部执行 进行中：正在修复 plugin.ts（60%）');
  });

  it('buildEventCard 会把 plan-question interrupt 映射成计划问题卡片', () => {
    const card = buildEventCard({
      id: 'evt-plan-1',
      sessionId: 'session-1',
      type: 'interrupt_pending',
      at: '2026-03-28T00:00:00.000Z',
      payload: {
        intent: 'plan_question',
        interruptId: 'interrupt-plan-1',
        interactionKind: 'plan-question',
        questionSet: {
          title: '方案确认',
          summary: '存在几个会影响方案走向的关键未知项。'
        },
        questions: [
          {
            id: 'delivery_mode',
            question: '这一轮更希望我输出哪种方案结果？',
            questionType: 'direction',
            options: [
              { id: 'plan_only', label: '只出方案', description: '仅收敛计划，不实现。' },
              { id: 'implement_now', label: '直接实现', description: '跳过计划直接执行。' }
            ],
            recommendedOptionId: 'plan_only',
            allowFreeform: true,
            defaultAssumption: '默认只出方案。'
          }
        ]
      }
    } as any);

    expect(card).toEqual({
      type: 'plan_question',
      title: '方案确认',
      summary: '存在几个会影响方案走向的关键未知项。',
      status: 'pending',
      interruptId: 'interrupt-plan-1',
      questions: [
        {
          id: 'delivery_mode',
          question: '这一轮更希望我输出哪种方案结果？',
          questionType: 'direction',
          options: [
            { id: 'plan_only', label: '只出方案', description: '仅收敛计划，不实现。' },
            { id: 'implement_now', label: '直接实现', description: '跳过计划直接执行。' }
          ],
          recommendedOptionId: 'plan_only',
          allowFreeform: true,
          defaultAssumption: '默认只出方案。',
          whyAsked: undefined,
          impactOnPlan: undefined
        }
      ]
    });
  });

  it('buildEventCard 会忽略 previewMessages 里的非法项并保留合法会话预览', () => {
    const card = buildEventCard({
      id: 'evt-compact-2',
      sessionId: 'session-1',
      type: 'conversation_compacted',
      at: '2026-03-28T00:00:00.000Z',
      payload: {
        summary: '压缩摘要',
        previewMessages: [
          { role: 'user', content: '保留这一条' },
          { role: 'assistant', content: '也保留这一条' },
          { role: 'tool', content: '这条应该被过滤' },
          { role: 'system' },
          null
        ]
      }
    } as any);

    expect(card).toEqual(
      expect.objectContaining({
        type: 'compression_summary',
        previewMessages: [
          { role: 'user', content: '保留这一条' },
          { role: 'assistant', content: '也保留这一条' }
        ]
      })
    );
  });

  it('syncSessionFromEvent 会把 plan-question interrupt 标成 waiting_interrupt', () => {
    const sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '新会话',
        status: 'idle',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];

    const next = syncSessionFromEvent(sessions, {
      id: 'evt-plan-2',
      sessionId: 'session-1',
      type: 'interrupt_pending',
      at: '2026-03-28T00:00:01.000Z',
      payload: {
        interactionKind: 'plan-question'
      }
    } as any);

    expect(next[0]?.status).toBe('waiting_interrupt');
  });

  it('approval_resolved 会就地更新原审批卡片，而不是直接移除', () => {
    const messages = syncProcessMessageFromEvent(
      [
        {
          id: 'event_evt-approval-1',
          sessionId: 'session-1',
          role: 'system',
          taskId: 'task-1',
          content: '等待审批',
          card: {
            type: 'approval_request',
            intent: 'write_file',
            status: 'pending',
            displayStatus: 'pending',
            isPrimaryActionAvailable: true
          },
          createdAt: '2026-03-28T00:00:00.000Z'
        }
      ],
      {
        id: 'evt-approval-2',
        sessionId: 'session-1',
        type: 'approval_resolved',
        at: '2026-03-28T00:00:01.000Z',
        payload: {
          taskId: 'task-1',
          intent: 'write_file'
        }
      } as any
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'event_evt-approval-1',
          card: expect.objectContaining({
            status: 'approved',
            displayStatus: 'allowed',
            isPrimaryActionAvailable: false
          })
        }),
        expect.objectContaining({
          id: 'event_evt-approval-2',
          content: '已允许继续',
          card: expect.objectContaining({
            type: 'control_notice',
            tone: 'success',
            label: '已允许继续'
          })
        })
      ])
    );
  });

  it('syncProcessMessageFromEvent 不再把 conversation_compacted 插入主线程消息数组', () => {
    const messages = syncProcessMessageFromEvent(
      [
        {
          id: 'event_evt-compact-1',
          sessionId: 'session-1',
          role: 'system',
          content: '正在自动压缩背景信息',
          card: {
            type: 'compression_summary',
            summary: '更早的一版压缩摘要',
            condensedMessageCount: 3
          },
          createdAt: '2026-03-28T00:00:00.000Z'
        }
      ],
      {
        id: 'evt-compact-2',
        sessionId: 'session-1',
        type: 'conversation_compacted',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          condensedMessageCount: 6,
          previewMessages: [{ role: 'user', content: '我们先看了多轮对话。' }],
          summary: '这轮先讨论了多轮回顾问题，后面又处理了 skill 安装治理。'
        }
      } as any
    );

    expect(messages.filter(message => message.card?.type === 'compression_summary')).toHaveLength(0);
  });

  it('syncProcessMessageFromEvent 会复用同一条 node status 系统消息，而不是不断追加', () => {
    let messages: ChatMessageRecord[] = [];

    messages = syncProcessMessageFromEvent(messages, {
      id: 'evt-node-1',
      sessionId: 'session-1',
      type: 'node_status',
      at: '2026-03-28T00:00:00.000Z',
      payload: {
        nodeLabel: '文书科压缩',
        phase: 'start',
        detail: '开始压缩较早消息'
      }
    } as any);

    messages = syncProcessMessageFromEvent(messages, {
      id: 'evt-node-2',
      sessionId: 'session-1',
      type: 'node_progress',
      at: '2026-03-28T00:00:02.000Z',
      payload: {
        nodeLabel: '文书科压缩',
        phase: 'progress',
        detail: '正在整理关键决策'
      }
    } as any);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(
      expect.objectContaining({
        id: 'event_stream_status_session-1',
        content: '文书科压缩 进行中：正在整理关键决策'
      })
    );
  });

  it('syncSessionFromEvent 会用事件里的 title 刷新左侧会话标题', () => {
    const sessions: ChatSessionRecord[] = [
      {
        id: 'session-1',
        title: '新会话',
        status: 'idle',
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      }
    ];

    const next = syncSessionFromEvent(sessions, {
      id: 'evt-2',
      sessionId: 'session-1',
      type: 'user_message',
      at: '2026-03-28T00:00:01.000Z',
      payload: {
        messageId: 'msg-1',
        content: '这个产品规划怎么样',
        title: '这个产品规划怎么样'
      }
    });

    expect(next[0]).toEqual(
      expect.objectContaining({
        title: '这个产品规划怎么样',
        updatedAt: '2026-03-28T00:00:01.000Z'
      })
    );
  });

  it('syncCheckpointFromStreamEvent 会把 node_progress 写入 streamStatus', () => {
    const next = syncCheckpointFromStreamEvent(
      {
        sessionId: 'session-1',
        taskId: 'task-1',
        checkpointId: 'checkpoint-1',
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        learningCursor: 0,
        pendingApprovals: [],
        agentStates: [],
        graphState: { status: 'running' as any },
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      } as any,
      {
        id: 'evt-node-3',
        sessionId: 'session-1',
        type: 'node_progress',
        at: '2026-03-28T00:00:03.000Z',
        payload: {
          nodeId: 'execute',
          nodeLabel: '工部执行',
          detail: '正在跑测试',
          progressPercent: 80
        }
      } as any
    );

    expect(next?.streamStatus).toEqual({
      nodeId: 'execute',
      nodeLabel: '工部执行',
      detail: '正在跑测试',
      progressPercent: 80,
      updatedAt: '2026-03-28T00:00:03.000Z'
    });
  });

  it('syncMessageFromEvent 会连续追加 token，并在最终 assistant_message 到达时校正正文', () => {
    let messages: ChatMessageRecord[] = [];

    messages = syncMessageFromEvent(messages, {
      id: 'evt-token-1',
      sessionId: 'session-1',
      type: 'assistant_token',
      at: '2026-03-28T00:00:01.000Z',
      payload: {
        messageId: 'assistant-1',
        content: '你好',
        taskId: 'task-1',
        from: 'manager'
      }
    });

    messages = syncMessageFromEvent(messages, {
      id: 'evt-token-2',
      sessionId: 'session-1',
      type: 'assistant_token',
      at: '2026-03-28T00:00:02.000Z',
      payload: {
        messageId: 'assistant-1',
        content: '，世界',
        taskId: 'task-1',
        from: 'manager'
      }
    });

    expect(messages).toEqual([
      expect.objectContaining({
        id: 'assistant-1',
        content: '你好，世界'
      })
    ]);

    messages = syncMessageFromEvent(messages, {
      id: 'evt-final',
      sessionId: 'session-1',
      type: 'assistant_message',
      at: '2026-03-28T00:00:03.000Z',
      payload: {
        messageId: 'assistant-1',
        content: '你好，世界。',
        taskId: 'task-1',
        from: 'manager'
      }
    });

    expect(messages).toEqual([
      expect.objectContaining({
        id: 'assistant-1',
        content: '你好，世界。'
      })
    ]);
  });

  it('syncMessageFromEvent 在最终快照重放 assistant_token 时不会把已持久化正文再追加一遍', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'assistant-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。',
        createdAt: '2026-03-28T00:00:03.000Z'
      }
    ];

    const next = syncMessageFromEvent(messages, {
      id: 'evt-token-replay',
      sessionId: 'session-1',
      type: 'assistant_token',
      at: '2026-03-28T00:00:04.000Z',
      payload: {
        messageId: 'assistant-1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。',
        taskId: 'task-1',
        from: 'manager'
      }
    });

    expect(next).toEqual([
      expect.objectContaining({
        id: 'assistant-1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。'
      })
    ]);
  });

  it('syncMessageFromEvent 在已存在 committed assistant 时会忽略 direct reply 历史 token 重放', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'assistant-final-1',
        sessionId: 'session-1',
        role: 'assistant',
        taskId: 'task-1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手。',
        createdAt: '2026-04-07T00:00:01.000Z'
      }
    ];

    const next = syncMessageFromEvent(messages, {
      id: 'evt-token-replay-direct',
      sessionId: 'session-1',
      type: 'assistant_token',
      at: '2026-04-07T00:00:02.000Z',
      payload: {
        messageId: 'direct_reply_task-1',
        content: '我是内阁首辅，一个基于大语言模型的智能助手',
        taskId: 'task-1',
        from: 'manager'
      }
    });

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: 'assistant-final-1',
      content: '我是内阁首辅，一个基于大语言模型的智能助手。'
    });
  });

  it('历史 replay 的 assistant 事件不会劫持当前轮刚创建的 pending assistant 占位', () => {
    const messages: ChatMessageRecord[] = [
      {
        id: 'assistant-prev',
        sessionId: 'session-1',
        role: 'assistant',
        content: '上一轮最终回复',
        createdAt: '2026-03-28T00:00:05.000Z'
      },
      {
        id: 'pending_assistant_session-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '',
        createdAt: '2026-03-28T00:00:10.000Z'
      }
    ];

    const next = syncMessageFromEvent(messages, {
      id: 'evt-replay-old',
      sessionId: 'session-1',
      type: 'assistant_message',
      at: '2026-03-28T00:00:05.000Z',
      payload: {
        messageId: 'assistant-prev',
        content: '上一轮最终回复',
        taskId: 'task-prev',
        from: 'manager'
      }
    });

    expect(next.map(message => message.id)).toEqual(['assistant-prev', 'pending_assistant_session-1']);
    expect(next.find(message => message.id === 'pending_assistant_session-1')?.content).toBe('');
  });

  it('syncProcessMessageFromEvent 会把 run_cancelled 变成线程中的系统消息', () => {
    const messages = syncProcessMessageFromEvent([], {
      id: 'evt-cancel-1',
      sessionId: 'session-1',
      type: 'run_cancelled',
      at: '2026-03-28T00:00:04.000Z',
      payload: {
        reason: '用户终止本轮'
      }
    } as any);

    expect(messages).toEqual([
      expect.objectContaining({
        id: 'event_evt-cancel-1',
        role: 'system',
        content: '本轮已终止：用户终止本轮',
        card: expect.objectContaining({
          type: 'control_notice',
          tone: 'warning',
          label: '本轮已终止'
        })
      })
    ]);
  });

  it('syncProcessMessageFromEvent 会把 approval_rejected_with_feedback 变成轻量状态卡', () => {
    const messages = syncProcessMessageFromEvent([], {
      id: 'evt-approval-reject-1',
      sessionId: 'session-1',
      type: 'approval_rejected_with_feedback',
      at: '2026-03-28T00:00:05.000Z',
      payload: {
        intent: 'write_file',
        feedback: '请先缩小写入范围'
      }
    } as any);

    expect(messages).toEqual([
      expect.objectContaining({
        id: 'event_evt-approval-reject-1',
        role: 'system',
        content: '已拒绝并附说明：请先缩小写入范围',
        card: expect.objectContaining({
          type: 'control_notice',
          tone: 'warning',
          label: '已拒绝并附说明'
        })
      })
    ]);
  });

  it('run_resumed 会带上恢复到的 skill step 文案', () => {
    const messages = syncProcessMessageFromEvent([], {
      id: 'evt-resume-1',
      sessionId: 'session-1',
      type: 'run_resumed',
      at: '2026-03-29T00:00:06.000Z',
      payload: {
        currentSkillExecution: {
          displayName: 'Lark notify skill',
          title: 'Send Lark notification',
          stepIndex: 2,
          totalSteps: 3
        }
      }
    } as any);

    expect(messages).toEqual([
      expect.objectContaining({
        id: 'event_evt-resume-1',
        role: 'system',
        content: '已恢复执行，继续 Lark notify skill 的 Send Lark notification（2/3）',
        card: expect.objectContaining({
          type: 'control_notice',
          tone: 'success',
          label: '已恢复到 Send Lark notification'
        })
      })
    ]);
  });
});
