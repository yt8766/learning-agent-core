import { describe, expect, it, vi } from 'vitest';

import { compressConversationIfNeeded } from '../../src/session/session-coordinator-compression';

function createMessages(count: number, contentFactory?: (index: number) => string) {
  return Array.from({ length: count }, (_, index) => ({
    id: `msg-${index + 1}`,
    role: index % 2 === 0 ? 'user' : 'assistant',
    content:
      contentFactory?.(index) ??
      `第 ${index + 1} 条消息：这是为了触发会话压缩而准备的较长上下文内容，包含多个执行细节与后续动作。`,
    createdAt: `2026-04-01T00:${String(index).padStart(2, '0')}:00.000Z`
  }));
}

describe('compressConversationIfNeeded', () => {
  it('skips compression when the feature is disabled', async () => {
    const session = { id: 'session-1', updatedAt: '2026-04-01T00:00:00.000Z' } as any;
    const llm = { isConfigured: vi.fn(() => false) } as any;
    const onCompacted = vi.fn();

    await expect(
      compressConversationIfNeeded(llm, { compressionEnabled: false } as any, session, createMessages(20), onCompacted)
    ).resolves.toBe(false);
    expect(session.compression).toBeUndefined();
    expect(onCompacted).not.toHaveBeenCalled();
  });

  it('compresses earlier messages sooner for long-flow requests and emits metadata', async () => {
    const session = { id: 'session-2', updatedAt: '2026-04-01T00:00:00.000Z' } as any;
    const llm = { isConfigured: vi.fn(() => false) } as any;
    const onCompacted = vi.fn();

    const compacted = await compressConversationIfNeeded(
      llm,
      undefined,
      session,
      createMessages(12, index =>
        index === 0
          ? '4/01-4/07 周报复盘'
          : `第 ${index + 1} 条：继续推进 review、测试、发布与风险排查动作，记录后续 TODO。`
      ),
      onCompacted,
      '请继续 review 并补测试'
    );

    expect(compacted).toBe(true);
    expect(session.compression).toEqual(
      expect.objectContaining({
        source: 'heuristic',
        trigger: 'message_count',
        compressionProfile: 'long-flow',
        effectiveThreshold: 11
      })
    );
    expect(session.compression.summary).toContain('主题：4/01-4/07');
    expect(session.compression.openLoops?.join('；')).toContain('TODO');
    expect(onCompacted).toHaveBeenCalledWith(
      expect.objectContaining({
        compressionProfile: 'long-flow',
        heuristicFallback: true
      })
    );
  });

  it('does not compress light chat when message count stays below the relaxed threshold', async () => {
    const session = { id: 'session-3', updatedAt: '2026-04-01T00:00:00.000Z' } as any;
    const llm = { isConfigured: vi.fn(() => false) } as any;

    await expect(
      compressConversationIfNeeded(
        llm,
        undefined,
        session,
        createMessages(16, index => `简短聊天 ${index + 1}：一句话直接回答即可。`),
        vi.fn(),
        '请给我一个 quick brief'
      )
    ).resolves.toBe(false);
    expect(session.compression).toBeUndefined();
  });

  it('uses llm structured json summary when available', async () => {
    const session = { id: 'session-4', updatedAt: '2026-04-01T00:00:00.000Z' } as any;
    const llm = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(async () =>
        JSON.stringify({
          period_or_topic: '架构评审',
          primary_focuses: ['运行时治理', '审批恢复'],
          key_deliverables: ['完成技术方案评审'],
          risks_and_gaps: ['测试覆盖率不足'],
          next_actions: ['补齐高风险回归测试'],
          raw_supporting_points: ['需要同步前后端上下文约束'],
          decision_summary: '默认优先补测试',
          confirmed_preferences: ['先做高收益模块'],
          open_loops: ['admin dashboard hook 仍待补测'],
          summary: '主题：架构评审\n一级重点：运行时治理；审批恢复'
        })
      )
    } as any;

    const compacted = await compressConversationIfNeeded(
      llm,
      undefined,
      session,
      createMessages(18),
      vi.fn(),
      '请继续研究架构方案'
    );

    expect(compacted).toBe(true);
    expect(session.compression).toEqual(
      expect.objectContaining({
        source: 'llm',
        periodOrTopic: '架构评审',
        decisionSummary: '默认优先补测试',
        confirmedPreferences: ['先做高收益模块']
      })
    );
  });

  it('falls back to character-count heuristic and trims preview messages', async () => {
    const session = { id: 'session-5', updatedAt: '2026-04-01T00:00:00.000Z' } as any;
    const llm = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => '   ')
    } as any;
    const onCompacted = vi.fn();

    const compacted = await compressConversationIfNeeded(
      llm,
      {
        compressionMessageThreshold: 99,
        compressionKeepLeadingMessages: 0,
        compressionKeepRecentMessages: 2,
        compressionMaxSummaryChars: 80
      } as any,
      session,
      createMessages(12, index =>
        `第 ${index + 1} 条消息：这是非常长的上下文内容，包含多个风险、后续动作、确认决策和用户偏好，`.repeat(20)
      ),
      onCompacted,
      '继续研究'
    );

    expect(compacted).toBe(true);
    expect(session.compression).toEqual(
      expect.objectContaining({
        trigger: 'character_count',
        source: 'heuristic',
        condensedMessageCount: 10,
        previewMessages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringMatching(/\.\.\.$/)
          })
        ])
      })
    );
    expect(onCompacted).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: 'character_count',
        heuristicFallback: true
      })
    );
  });

  it('parses fenced json summaries and synthesizes summary text when summary is omitted', async () => {
    const session = { id: 'session-6', updatedAt: '2026-04-01T00:00:00.000Z' } as any;
    const llm = {
      isConfigured: vi.fn(() => true),
      generateText: vi.fn(async () =>
        [
          '```json',
          JSON.stringify({
            period_or_topic: '4/01-4/07',
            primary_focuses: ['推进 Runtime Center', 7, '补 coverage'],
            key_deliverables: ['完成 dashboard', '完成 dashboard'],
            risks_and_gaps: ['仍有 branch gap'],
            next_actions: ['继续补 agent-core'],
            raw_supporting_points: ['审批流已收敛'],
            decision_summary: '默认先清高收益模块',
            confirmed_preferences: ['不要大改实现'],
            open_loops: ['session coordinator 分支待补']
          }),
          '```'
        ].join('\n')
      )
    } as any;

    const compacted = await compressConversationIfNeeded(
      llm,
      undefined,
      session,
      createMessages(18),
      vi.fn(),
      '请继续 review'
    );

    expect(compacted).toBe(true);
    expect(session.compression).toEqual(
      expect.objectContaining({
        source: 'llm',
        periodOrTopic: '4/01-4/07',
        focuses: ['推进 Runtime Center', '补 coverage'],
        keyDeliverables: ['完成 dashboard', '完成 dashboard'],
        summary: expect.stringContaining('主题：4/01-4/07')
      })
    );
  });
});
