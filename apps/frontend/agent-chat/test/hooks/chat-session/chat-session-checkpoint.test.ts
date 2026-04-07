import { describe, expect, it } from 'vitest';

import {
  deriveSessionStatusFromCheckpoint,
  syncCheckpointMessages
} from '@/hooks/chat-session/chat-session-checkpoint';

// activeInterrupt in these tests is the persisted 司礼监 / InterruptController projection from checkpoints.
describe('chat-session-checkpoint', () => {
  it('syncCheckpointMessages 只会把可引用的网页/文档来源写入 evidence_digest', () => {
    const messages = syncCheckpointMessages(
      [],
      {
        sessionId: 'session-1',
        taskId: 'task-1',
        learningCursor: 0,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        graphState: {
          status: 'completed'
        },
        pendingApprovals: [],
        agentStates: [],
        externalSources: [
          {
            id: 'source-web-1',
            sourceType: 'web',
            sourceUrl: 'https://example.com/article',
            trustClass: 'official',
            summary: '网页来源'
          },
          {
            id: 'source-doc-1',
            sourceType: 'document',
            trustClass: 'internal',
            summary: '文档来源'
          },
          {
            id: 'source-skill-1',
            sourceType: 'skill_search',
            trustClass: 'internal',
            summary: '技能候选'
          },
          {
            id: 'source-search-1',
            sourceType: 'web_search_result',
            sourceUrl: 'https://www.bing.com/search?q=test',
            trustClass: 'official',
            summary: '搜索结果页'
          },
          {
            id: 'source-fresh-1',
            sourceType: 'freshness_meta',
            trustClass: 'internal',
            summary: '信息基准'
          }
        ],
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      } as any,
      'session-1'
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          card: expect.objectContaining({
            type: 'evidence_digest',
            sources: [expect.objectContaining({ id: 'source-web-1' }), expect.objectContaining({ id: 'source-doc-1' })]
          })
        })
      ])
    );
    expect(JSON.stringify(messages)).not.toContain('source-search-1');
  });

  it('syncCheckpointMessages 不会再把 learning_summary 注入主线程消息', () => {
    const messages = syncCheckpointMessages(
      [],
      {
        sessionId: 'session-1',
        taskId: 'task-1',
        learningCursor: 1,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        graphState: {
          status: 'completed'
        },
        pendingApprovals: [],
        agentStates: [],
        learningEvaluation: {
          score: 92,
          confidence: 'high',
          notes: ['检测到稳定偏好，已进入自动学习。'],
          candidateReasons: ['检测到 1 条稳定偏好/约束。'],
          skippedReasons: ['未检测到新的技能抽取条件。'],
          conflictDetected: true,
          conflictTargets: ['mem-existing-1'],
          derivedFromLayers: ['L1-session', 'L5-runtime-snapshot'],
          policyMode: 'profile-inherited',
          expertiseSignals: ['user-preference', 'domain-expert'],
          recommendedCandidateIds: ['candidate-1'],
          autoConfirmCandidateIds: ['candidate-1'],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 1,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      } as any,
      'session-1'
    );

    expect(messages.some(message => message.card?.type === 'learning_summary')).toBe(false);
  });

  it('syncCheckpointMessages 会把运行中 skill 安装审批映射成控制消息而不是建议卡片', () => {
    const messages = syncCheckpointMessages(
      [],
      {
        sessionId: 'session-1',
        taskId: 'task-1',
        learningCursor: 0,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 1,
        graphState: {
          status: 'running',
          currentStep: 'waiting_skill_install_approval'
        },
        pendingApproval: {
          intent: 'install_skill',
          toolName: 'npx skills add',
          requestedBy: 'hubu-search',
          preview: [
            { label: 'Repo', value: 'vercel-labs/skills' },
            { label: 'Skill', value: 'find-skills' }
          ]
        },
        pendingApprovals: [],
        agentStates: [],
        skillSearch: {
          capabilityGapDetected: true,
          status: 'suggested',
          safetyNotes: ['发现远程候选。'],
          suggestions: [
            {
              id: 'remote:vercel-labs/skills:find-skills',
              kind: 'remote-skill',
              displayName: 'find-skills',
              summary: '安装后继续当前轮',
              score: 0.9,
              availability: 'installable-remote',
              reason: '需要补齐专业 skill。',
              requiredCapabilities: [],
              repo: 'vercel-labs/skills',
              skillName: 'find-skills'
            }
          ]
        },
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      } as any,
      'session-1'
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('当前轮已暂停'),
          card: expect.objectContaining({
            type: 'control_notice',
            label: '能力补齐'
          })
        })
      ])
    );
    expect(messages.some(message => message.card?.type === 'skill_suggestions')).toBe(false);
  });

  it('deriveSessionStatusFromCheckpoint 会把 pending activeInterrupt 视为待审批', () => {
    expect(
      deriveSessionStatusFromCheckpoint({
        sessionId: 'session-1',
        taskId: 'task-1',
        learningCursor: 0,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        graphState: {
          status: 'running'
        },
        activeInterrupt: {
          id: 'interrupt-1',
          status: 'pending',
          mode: 'blocking',
          source: 'graph',
          kind: 'skill-install',
          resumeStrategy: 'command',
          createdAt: '2026-03-28T00:00:00.000Z'
        },
        pendingApprovals: [],
        agentStates: [],
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      } as any)
    ).toBe('waiting_approval');
  });

  it('syncCheckpointMessages 会在只有 activeInterrupt 时也生成安装待确认控制消息', () => {
    const messages = syncCheckpointMessages(
      [],
      {
        sessionId: 'session-1',
        taskId: 'task-2',
        learningCursor: 0,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 1,
        graphState: {
          status: 'running',
          currentStep: 'waiting_skill_install_interrupt'
        },
        activeInterrupt: {
          id: 'interrupt-1',
          status: 'pending',
          mode: 'blocking',
          source: 'graph',
          kind: 'skill-install',
          intent: 'install_skill',
          toolName: 'npx skills add',
          resumeStrategy: 'command',
          preview: [
            { label: 'Repo', value: 'vercel-labs/skills' },
            { label: 'Skill', value: 'find-skills' }
          ],
          createdAt: '2026-03-28T00:00:00.000Z'
        },
        pendingApprovals: [],
        agentStates: [],
        skillSearch: {
          capabilityGapDetected: true,
          status: 'suggested',
          safetyNotes: ['发现远程候选。'],
          suggestions: [
            {
              id: 'remote:vercel-labs/skills:find-skills',
              kind: 'remote-skill',
              displayName: 'find-skills',
              summary: '安装后继续当前轮',
              score: 0.9,
              availability: 'installable-remote',
              reason: '需要补齐专业 skill。',
              requiredCapabilities: [],
              repo: 'vercel-labs/skills',
              skillName: 'find-skills'
            }
          ]
        },
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      } as any,
      'session-1'
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('当前轮已暂停'),
          card: expect.objectContaining({
            type: 'control_notice',
            label: '能力补齐'
          })
        })
      ])
    );
  });

  it('syncCheckpointMessages 不会为纯 general 复用单独生成 skill_reuse 卡片', () => {
    const messages = syncCheckpointMessages(
      [],
      {
        sessionId: 'session-1',
        taskId: 'task-3',
        learningCursor: 0,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        graphState: {
          status: 'running'
        },
        reusedSkills: ['general'],
        usedInstalledSkills: [],
        usedCompanyWorkers: [],
        pendingApprovals: [],
        agentStates: [],
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      } as any,
      'session-1'
    );

    expect(messages.some(message => message.card?.type === 'skill_reuse')).toBe(false);
  });

  it('syncCheckpointMessages 会把缺 MCP 的建议改成简短控制消息', () => {
    const messages = syncCheckpointMessages(
      [],
      {
        sessionId: 'session-1',
        taskId: 'task-3a',
        learningCursor: 0,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        graphState: {
          status: 'running'
        },
        pendingApprovals: [],
        agentStates: [],
        skillSearch: {
          capabilityGapDetected: true,
          status: 'suggested',
          safetyNotes: ['当前更缺 Browser MCP。'],
          mcpRecommendation: {
            kind: 'connector',
            summary: '当前更缺 Browser MCP connector，不只是 skill。',
            reason: '当前任务涉及浏览器操作。',
            connectorTemplateId: 'browser-mcp-template'
          },
          suggestions: []
        },
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      } as any,
      'session-1'
    );

    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('当前未接入 Browser MCP'),
          card: expect.objectContaining({
            type: 'control_notice',
            label: '能力状态'
          })
        })
      ])
    );
  });

  it('completed 直答且命中只显示最终答复偏好时，不再显示 learning 和 skill 建议卡', () => {
    const current = [
      {
        id: 'checkpoint_learning_task-4',
        sessionId: 'session-1',
        role: 'system',
        content: '旧 learning 卡',
        createdAt: '2026-03-28T00:00:00.000Z'
      },
      {
        id: 'checkpoint_skill_search_task-4',
        sessionId: 'session-1',
        role: 'system',
        content: '旧 skill 卡',
        createdAt: '2026-03-28T00:00:00.000Z'
      }
    ] as any;

    const messages = syncCheckpointMessages(
      current,
      {
        sessionId: 'session-1',
        taskId: 'task-4',
        learningCursor: 1,
        traceCursor: 0,
        messageCursor: 0,
        approvalCursor: 0,
        graphState: {
          status: 'completed'
        },
        chatRoute: {
          graph: 'workflow',
          flow: 'direct-reply',
          reason: 'general_prompt',
          adapter: 'general-prompt',
          priority: 50
        },
        pendingApprovals: [],
        agentStates: [],
        learningEvaluation: {
          score: 41,
          confidence: 'low',
          notes: ['用户偏好主聊天区只显示最终答复'],
          candidateReasons: ['检测到 1 条稳定偏好/约束。'],
          skippedReasons: [],
          expertiseSignals: ['user-preference'],
          recommendedCandidateIds: [],
          autoConfirmCandidateIds: [],
          sourceSummary: {
            externalSourceCount: 0,
            internalSourceCount: 1,
            reusedMemoryCount: 0,
            reusedRuleCount: 0,
            reusedSkillCount: 0
          }
        },
        skillSearch: {
          capabilityGapDetected: true,
          status: 'suggested',
          safetyNotes: ['发现远程候选。'],
          suggestions: [
            {
              id: 'remote:vercel-labs/skills:find-skills',
              kind: 'remote-skill',
              displayName: 'find-skills',
              summary: '安装后继续当前轮',
              score: 0.9,
              availability: 'installable-remote',
              reason: '需要补齐专业 skill。',
              requiredCapabilities: [],
              repo: 'vercel-labs/skills',
              skillName: 'find-skills'
            }
          ]
        },
        createdAt: '2026-03-28T00:00:00.000Z',
        updatedAt: '2026-03-28T00:00:00.000Z'
      } as any,
      'session-1'
    );

    expect(messages.some(message => message.id === 'checkpoint_learning_task-4')).toBe(false);
    expect(messages.some(message => message.id === 'checkpoint_skill_search_task-4')).toBe(false);
  });
});
