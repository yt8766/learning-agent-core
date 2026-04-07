import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/adapters/llm/zhipu-provider', () => ({
  ZhipuLlmProvider: class {
    isConfigured() {
      return false;
    }

    async generateText() {
      return '';
    }
  }
}));

import { SessionCoordinator } from '../src/session/session-coordinator';
import { TaskStatus } from '@agent/shared';
import {
  createLlmProvider,
  createOrchestrator,
  createRuntimeRepository,
  flushAsyncWork
} from './session-coordinator.test.utils';

describe('SessionCoordinator context and compression', () => {
  it('聊天记录过长时会自动压缩旧消息并保留最近上下文', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '自动压缩', message: '第一条消息：请记住我是中文用户。' });
    await flushAsyncWork();

    for (let index = 0; index < 18; index += 1) {
      await coordinator.appendMessage(session.id, {
        message: `后续消息 ${index + 1}：这是为了触发自动压缩的测试内容。`
      });
      await flushAsyncWork();
    }

    await flushAsyncWork(8);

    const currentSession = coordinator.getSession(session.id);
    expect(currentSession?.compression).toEqual(expect.objectContaining({ source: 'heuristic' }));
    expect(currentSession?.compression?.condensedMessageCount).toBeGreaterThan(0);
    expect(currentSession?.compression?.summaryLength).toBeGreaterThan(0);
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'conversation_compacted',
          payload: expect.objectContaining({
            heuristicFallback: true,
            effectiveThreshold: expect.any(Number),
            compressionProfile: expect.any(String)
          })
        })
      ])
    );

    const compactedContext = await (coordinator as any).buildConversationContext(session.id, '继续总结当前会话');
    expect(compactedContext).toContain('以下是较早聊天记录的压缩摘要：');
    expect(compactedContext).toContain('以下是最近的原始消息：');
  });

  it('buildConversationContext 会注入 checkpoint 中的 evidence、memory、learning 和上轮上下文', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'context-slice', message: '请继续刚才的研究' });
    await flushAsyncWork();

    const checkpoint = coordinator.getCheckpoint(session.id)!;
    checkpoint.context = '上轮已经确认要优先参考内部文档，再补充官方资料。';
    checkpoint.reusedMemories = ['mem_internal_guideline'];
    checkpoint.reusedRules = ['rule_safe_release'];
    checkpoint.reusedSkills = ['skill_release_check'];
    checkpoint.externalSources = [
      {
        id: 'mem-ev-1',
        taskId: 'task-1',
        sourceType: 'memory_reuse',
        trustClass: 'internal',
        summary: '已命中历史记忆：发布前优先复核关键配置与环境变量。',
        linkedRunId: 'run-1',
        createdAt: '2026-03-25T00:00:00.000Z'
      },
      {
        id: 'rule-ev-1',
        taskId: 'task-1',
        sourceType: 'rule_reuse',
        trustClass: 'internal',
        summary: '已命中历史规则：发布前先过安全检查再执行上线。',
        linkedRunId: 'run-1',
        createdAt: '2026-03-25T00:00:00.000Z'
      },
      {
        id: 'ev-1',
        taskId: 'task-1',
        sourceType: 'web',
        trustClass: 'official',
        summary: 'React 官方文档对流式渲染的说明',
        sourceUrl: 'https://react.dev',
        linkedRunId: 'run-1',
        createdAt: '2026-03-25T00:00:00.000Z'
      }
    ];
    checkpoint.learningEvaluation = {
      score: 0.92,
      confidence: 'high',
      notes: ['上轮内部资料命中率较高，应优先复用。'],
      recommendedCandidateIds: [],
      autoConfirmCandidateIds: [],
      sourceSummary: {
        externalSourceCount: 1,
        internalSourceCount: 1,
        reusedMemoryCount: 1,
        reusedRuleCount: 1,
        reusedSkillCount: 1
      }
    };

    const builtContext = await (coordinator as any).buildConversationContext(session.id, '请继续刚才的研究');
    expect(builtContext).toContain('以下是上一轮任务留下的结构化上下文：');
    expect(builtContext).toContain('发布前优先复核关键配置与环境变量。');
    expect(builtContext).toContain('发布前先过安全检查再执行上线。');
    expect(builtContext).toContain('skill_release_check');
    expect(builtContext).toContain('React 官方文档对流式渲染的说明');
    expect(builtContext).toContain('learning 评估');
    expect(builtContext).toContain('当前用户最新问题：\n请继续刚才的研究');
  });

  it('buildConversationContext 会过滤 task context 里的运行态战报，只保留给模型有用的上下文', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'context-cleanup', message: '继续优化输出' });
    await flushAsyncWork();

    const checkpoint = coordinator.getCheckpoint(session.id)!;
    checkpoint.context = [
      '首辅已在本地技能库中命中 5 个可复用候选。',
      '户部战报：当前最值得复用的是上一轮的业务诊断。',
      '兵部已接到任务，正在执行方案。',
      '真正应该留给模型的上下文：用户上一轮认为回复不够专业，希望继续补专业建议。'
    ].join('\n');

    const builtContext = await (coordinator as any).buildConversationContext(session.id, '上面的还有什么优化的地方');
    expect(builtContext).toContain('真正应该留给模型的上下文：用户上一轮认为回复不够专业，希望继续补专业建议。');
    expect(builtContext).not.toContain('首辅已在本地技能库中命中');
    expect(builtContext).not.toContain('户部战报');
    expect(builtContext).not.toContain('兵部已接到任务');
  });

  it('buildConversationContext 会把当前问题收在末尾，强化本轮追问焦点', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'context-order', message: '第一轮：先看 VIP 问题。' });
    await flushAsyncWork();
    await coordinator.appendMessage(session.id, { message: '第二轮：再看支付和 ROI。' });
    await flushAsyncWork();

    const currentSession = coordinator.getSession(session.id)!;
    currentSession.compression = {
      summary: '更早对话主要在看 VIP 承接。',
      periodOrTopic: '3/23-3/29 周报复盘',
      focuses: ['包网交付', '3.6.4 版本发布窗口', 'VIP 承接问题'],
      keyDeliverables: ['完成独立开播包与 3 个代理包交付'],
      risks: ['VIP 上线后没有很好承接住'],
      nextActions: ['修复 VIP 数值并强化宣发'],
      supportingFacts: ['游戏头部亏损补贴效果显著'],
      condensedMessageCount: 2,
      condensedCharacterCount: 18,
      totalCharacterCount: 48,
      trigger: 'message_count',
      source: 'heuristic',
      updatedAt: '2026-03-28T00:00:00.000Z'
    };

    const builtContext = await (coordinator as any).buildConversationContext(session.id, '上面的还有什么优化的地方');
    const summaryIndex = builtContext.indexOf('以下是较早聊天记录的压缩摘要：');
    const recentIndex = builtContext.indexOf('以下是最近的原始消息：');
    const currentQueryIndex = builtContext.indexOf('当前用户最新问题：');

    expect(summaryIndex).toBeGreaterThanOrEqual(0);
    expect(builtContext).toContain('主题 / 时段：3/23-3/29 周报复盘');
    expect(builtContext).toContain('一级重点：');
    expect(builtContext).toContain('- 包网交付');
    expect(builtContext).toContain('风险与缺口：');
    expect(builtContext).toContain('- VIP 上线后没有很好承接住');
    expect(recentIndex).toBeGreaterThan(summaryIndex);
    expect(currentQueryIndex).toBeGreaterThan(recentIndex);
    expect(builtContext.trim().endsWith('上面的还有什么优化的地方')).toBe(true);
  });

  it('runTurn 会把压缩摘要、最近两轮和强相关历史传给 createTask', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'context-hints', message: '第一轮：先分析 VIP 承接。' });
    await flushAsyncWork();
    await coordinator.appendMessage(session.id, { message: '第二轮：再看投放 ROI。' });
    await flushAsyncWork();
    await coordinator.appendMessage(session.id, { message: '第三轮：结合代理和支付一起判断。' });
    await flushAsyncWork();

    const currentSession = coordinator.getSession(session.id)!;
    currentSession.compression = {
      summary: '更早的讨论聚焦 VIP 承接与高价值用户留存。',
      decisionSummary: '统一按代理、支付、ROI 三线一起评估。',
      confirmedPreferences: ['希望最终直接给建议'],
      openLoops: ['还需要收敛最终建议'],
      condensedMessageCount: 3,
      condensedCharacterCount: 40,
      totalCharacterCount: 120,
      trigger: 'message_count',
      source: 'heuristic',
      updatedAt: '2026-03-28T00:00:00.000Z'
    };
    const checkpoint = coordinator.getCheckpoint(session.id)!;
    checkpoint.context = '上一轮确定要一起评估代理、支付与 ROI。';
    checkpoint.learningEvaluation = {
      score: 0.88,
      confidence: 'medium',
      notes: ['代理渠道曾出现高转化但投诉偏多。'],
      recommendedCandidateIds: [],
      autoConfirmCandidateIds: [],
      sourceSummary: {
        externalSourceCount: 0,
        internalSourceCount: 1,
        reusedMemoryCount: 0,
        reusedRuleCount: 0,
        reusedSkillCount: 0
      }
    };

    await coordinator.appendMessage(session.id, { message: '第四轮：给我最终建议。' });
    await flushAsyncWork();

    expect(orchestrator.createTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionId: session.id,
        conversationSummary: '更早的讨论聚焦 VIP 承接与高价值用户留存。',
        conversationCompression: expect.objectContaining({
          summary: '更早的讨论聚焦 VIP 承接与高价值用户留存。',
          decisionSummary: '统一按代理、支付、ROI 三线一起评估。',
          confirmedPreferences: ['希望最终直接给建议'],
          openLoops: ['还需要收敛最终建议']
        }),
        recentTurns: expect.arrayContaining([
          { role: 'user', content: '第三轮：结合代理和支付一起判断。' },
          { role: 'user', content: '第四轮：给我最终建议。' }
        ]),
        relatedHistory: expect.arrayContaining([
          '上一轮确定要一起评估代理、支付与 ROI。',
          '代理渠道曾出现高转化但投诉偏多。'
        ])
      })
    );
  });

  it('长流程语义会更早触发压缩配置档位', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'compression-profile', message: '先做一次 review。' });
    await flushAsyncWork();

    for (let index = 0; index < 12; index += 1) {
      await coordinator.appendMessage(session.id, {
        message: `第 ${index + 1} 轮：继续 review、测试、排查和修复。`
      });
      await flushAsyncWork();
    }

    const compactedEvent = coordinator.getEvents(session.id).find(event => event.type === 'conversation_compacted');
    expect(compactedEvent?.payload).toEqual(
      expect.objectContaining({
        compressionProfile: 'long-flow',
        effectiveThreshold: 11
      })
    );
  });

  it('buildConversationContext 在回顾刚刚对话时会忽略 system 卡并避免复读整段上一轮回复', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({
      title: 'recall-turns',
      message: '先聊 OpenAI Codex 和 Claude Code 的区别。'
    });
    await flushAsyncWork();

    await coordinator.appendInlineCapabilityResponse(
      session.id,
      { message: '先聊 OpenAI Codex 和 Claude Code 的区别。' },
      {
        role: 'assistant',
        content: '我们刚刚讨论了 OpenAI Codex 的功能，以及它与 Claude Code 的优势对比。'.repeat(20)
      }
    );

    const checkpoint = coordinator.getCheckpoint(session.id)!;
    checkpoint.skillSearch = {
      capabilityGapDetected: true,
      status: 'suggested',
      safetyNotes: ['远程候选仅供参考。'],
      suggestions: []
    } as any;

    const builtContext = await (coordinator as any).buildConversationContext(session.id, '我们刚刚聊了什么？');
    expect(builtContext).toContain('当前用户在询问刚才的对话内容。');
    expect(builtContext).toContain('不要直接复读上一轮完整回答');
    expect(builtContext).not.toContain('role: system');
    expect(builtContext).toContain('...(truncated)');
  });

  it('runTurn 的 recentTurns 只保留真实对话，不混入 system 卡片', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'recent-turn-filter', message: '第一轮：先看 Codex。' });
    await flushAsyncWork();

    await coordinator.appendInlineCapabilityResponse(
      session.id,
      { message: '第一轮：先看 Codex。' },
      {
        role: 'system',
        content: 'Capability Gap',
        card: {
          type: 'skill_suggestions',
          capabilityGapDetected: true,
          status: 'suggested',
          safetyNotes: [],
          suggestions: []
        } as any
      }
    );

    await coordinator.appendMessage(session.id, { message: '第二轮：我们刚刚聊了什么？' });
    await flushAsyncWork();

    expect(orchestrator.createTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        recentTurns: expect.not.arrayContaining([expect.objectContaining({ role: 'system' })])
      })
    );
  });

  it('runTurn 会把 session 附加 skill 的 contract 一起带入 createTask', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: 'skill-contract-hints', message: '先创建一个 skill。' });
    await flushAsyncWork();

    const checkpoint = coordinator.getCheckpoint(session.id)!;
    checkpoint.capabilityAttachments = [
      {
        id: 'user-skill:lark-skill',
        displayName: 'Lark notify skill',
        kind: 'skill',
        owner: {
          ownerType: 'user-attached',
          ownerId: `session:${session.id}`,
          capabilityType: 'skill',
          scope: 'workspace',
          trigger: 'user_requested'
        },
        enabled: true,
        metadata: {
          requiredTools: ['lark.send_message'],
          requiredConnectors: ['lark-mcp-template']
        },
        createdAt: '2026-03-29T00:00:00.000Z',
        updatedAt: '2026-03-29T00:00:00.000Z'
      }
    ];

    await coordinator.appendMessage(session.id, { message: '继续用刚才那个 skill 发消息' });
    await flushAsyncWork();

    expect(orchestrator.createTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sessionId: session.id,
        capabilityAttachments: expect.arrayContaining([
          expect.objectContaining({
            id: 'user-skill:lark-skill',
            metadata: expect.objectContaining({
              requiredConnectors: ['lark-mcp-template']
            })
          })
        ]),
        requestedHints: expect.objectContaining({
          requestedSkill: 'Lark notify skill',
          requestedConnectorTemplate: 'lark-mcp-template'
        })
      })
    );
  });

  it('学习确认会把选中的候选写入 memory、rule 和 skill lab', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );
    const session = await coordinator.createSession({ title: '学习确认', message: '请学习本轮经验' });

    await flushAsyncWork();

    const task = {
      id: 'task-1',
      status: TaskStatus.COMPLETED,
      learningCandidates: [
        {
          id: 'memory-1',
          taskId: 'task-1',
          type: 'memory',
          summary: 'memory',
          status: 'pending_confirmation',
          payload: { id: 'memory-record' },
          createdAt: '2026-03-22T00:00:00.000Z'
        },
        {
          id: 'rule-1',
          taskId: 'task-1',
          type: 'rule',
          summary: 'rule',
          status: 'pending_confirmation',
          payload: { id: 'rule-record' },
          createdAt: '2026-03-22T00:00:00.000Z'
        },
        {
          id: 'skill-1',
          taskId: 'task-1',
          type: 'skill',
          summary: 'skill',
          status: 'pending_confirmation',
          payload: { id: 'skill-record' },
          createdAt: '2026-03-22T00:00:00.000Z'
        }
      ]
    };
    orchestrator.getTask.mockReturnValue(task);

    const result = await coordinator.confirmLearning(session.id, {
      actor: 'tester',
      sessionId: session.id,
      candidateIds: ['memory-1', 'rule-1', 'skill-1']
    });

    expect(result.status).toBe('completed');
    expect(orchestrator.confirmLearning).toHaveBeenCalledWith('task-1', ['memory-1', 'rule-1', 'skill-1']);
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'learning_confirmed' })])
    );
    expect(task.learningCandidates.every((candidate: any) => candidate.status === 'confirmed')).toBe(true);
  });

  it('syncTask 会把审批 reasonCode 同步到 session 事件中', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '审批原因码', message: '请继续执行' });
    await flushAsyncWork();

    const task: any = {
      id: 'task-approval-1',
      goal: '执行安全写入',
      sessionId: session.id,
      status: TaskStatus.WAITING_APPROVAL,
      trace: [],
      approvals: [
        {
          taskId: 'task-approval-1',
          intent: 'write_file',
          decision: 'pending',
          decidedAt: '2026-03-22T00:00:00.000Z',
          reason: '路径属于敏感位置，需要审批。'
        }
      ],
      pendingApproval: {
        toolName: 'write_local_file',
        intent: 'write_file',
        requestedBy: 'gongbu-code',
        riskLevel: 'high',
        reason: '路径属于敏感位置，需要审批。',
        reasonCode: 'requires_approval_destructive',
        preview: [{ label: 'Path', value: '.env.local' }]
      },
      agentStates: [],
      messages: [],
      currentStep: 'execute',
      retryCount: 0,
      maxRetries: 1,
      createdAt: '2026-03-22T00:00:00.000Z',
      updatedAt: '2026-03-22T00:00:00.000Z'
    };

    (coordinator as any).syncTask(session.id, task);

    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'approval_required',
          payload: expect.objectContaining({
            reasonCode: 'requires_approval_destructive'
          })
        })
      ])
    );
  });

  it('自动确认学习候选后会写入 learning_confirmed 事件并保持 session completed', async () => {
    const runtimeRepository = createRuntimeRepository();
    const orchestrator = createOrchestrator();
    orchestrator.createTask.mockImplementation(async dto => {
      const task = {
        id: 'task-auto-learn-1',
        goal: dto.goal,
        sessionId: dto.sessionId,
        status: TaskStatus.COMPLETED,
        trace: [],
        approvals: [],
        agentStates: [],
        messages: [
          {
            id: 'task-msg-auto-1',
            taskId: 'task-auto-learn-1',
            from: 'manager',
            to: 'manager',
            type: 'summary',
            content: '已按你的长期偏好完成设置。',
            createdAt: '2026-03-22T00:00:01.000Z'
          }
        ],
        learningCandidates: [
          {
            id: 'pref-1',
            taskId: 'task-auto-learn-1',
            type: 'memory',
            summary: '用户偏好主聊天区只显示最终答复',
            status: 'pending_confirmation',
            autoConfirmEligible: true,
            payload: { id: 'mem-pref-1' },
            createdAt: '2026-03-22T00:00:00.000Z'
          }
        ],
        learningEvaluation: {
          score: 88,
          confidence: 'high',
          notes: ['检测到稳定偏好，已进入自动学习。'],
          candidateReasons: ['检测到 1 条稳定偏好/约束。'],
          recommendedCandidateIds: ['pref-1'],
          autoConfirmCandidateIds: ['pref-1'],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 1,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        result: '已按你的长期偏好完成设置。',
        createdAt: '2026-03-22T00:00:00.000Z',
        updatedAt: '2026-03-22T00:00:00.000Z',
        currentStep: 'finish',
        retryCount: 0,
        maxRetries: 1
      };
      orchestrator.getTask.mockReturnValue(task);
      return task;
    });

    const coordinator = new SessionCoordinator(
      orchestrator as never,
      runtimeRepository as never,
      createLlmProvider() as never
    );

    const session = await coordinator.createSession({ title: '自动学习', message: '主聊天区只看最终答复' });
    await flushAsyncWork(8);

    expect(orchestrator.confirmLearning).toHaveBeenCalledWith('task-auto-learn-1', ['pref-1']);
    expect(coordinator.getSession(session.id)?.status).toBe('completed');
    expect(coordinator.getEvents(session.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'learning_confirmed',
          payload: expect.objectContaining({
            autoConfirmed: true,
            candidateIds: ['pref-1']
          })
        })
      ])
    );
  });
});
