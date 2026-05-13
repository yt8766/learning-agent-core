import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/memory/active-memory-tools', () => ({
  archivalMemorySearchByParams: vi.fn().mockResolvedValue({
    coreMemories: [],
    archivalMemories: [],
    rules: [],
    reflections: [],
    reasons: []
  })
}));

vi.mock('../src/memory/runtime-memory-search', () => ({
  flattenStructuredMemories: vi.fn().mockReturnValue([])
}));

vi.mock('../src/utils/context-compression-pipeline', () => ({
  applyReactiveCompactRetry: vi.fn().mockReturnValue({ summary: 'compressed', compactedCharacterCount: 100 }),
  buildContextCompressionResult: vi.fn().mockReturnValue({ summary: 'task context', compactedCharacterCount: 100 })
}));

vi.mock('../src/utils/prompts/runtime-output-sanitizer', () => ({
  sanitizeTaskContextForModel: vi.fn().mockImplementation((ctx: any) => ctx)
}));

import { buildSessionConversationContext } from '../src/session/coordinator/session-coordinator-thinking-context';
import { archivalMemorySearchByParams } from '../src/memory/active-memory-tools';
import { flattenStructuredMemories } from '../src/memory/runtime-memory-search';

function makeSession(overrides: Record<string, unknown> = {}): any {
  return { id: 'session-1', compression: undefined, channelIdentity: undefined, ...overrides };
}

function makeCheckpoint(overrides: Record<string, unknown> = {}): any {
  return {
    checkpointId: 'cp-1',
    sessionId: 'session-1',
    taskId: 'task-1',
    context: undefined,
    externalSources: [],
    thoughtGraph: undefined,
    reusedSkills: undefined,
    learningEvaluation: undefined,
    channelIdentity: undefined,
    ...overrides
  };
}

describe('buildSessionConversationContext (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds context with recent messages', async () => {
    const messages = [
      { id: 'm1', role: 'user', content: 'Hello', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm2', role: 'assistant', content: 'Hi there', createdAt: '2026-01-01T00:01:00Z' }
    ];
    const result = await buildSessionConversationContext(
      makeSession(),
      makeCheckpoint(),
      messages as any,
      'Hello',
      undefined,
      undefined
    );
    expect(result).toContain('Hello');
  });

  it('includes compression summary when available', async () => {
    const session = makeSession({
      compression: { summary: 'Previous summary', periodOrTopic: 'topic', focuses: ['f1'] }
    });
    const result = await buildSessionConversationContext(session, makeCheckpoint(), [], 'test', undefined, undefined);
    expect(result).toContain('压缩摘要');
  });

  it('includes task context when checkpoint has context', async () => {
    const result = await buildSessionConversationContext(
      makeSession(),
      makeCheckpoint({ context: 'structured data' }),
      [],
      'test',
      undefined,
      undefined
    );
    expect(result).toContain('结构化上下文');
  });

  it('includes memory reuse evidence', async () => {
    const checkpoint = makeCheckpoint({
      externalSources: [{ sourceType: 'memory_reuse', summary: '已命中历史记忆：remember' }]
    });
    const result = await buildSessionConversationContext(makeSession(), checkpoint, [], 'test', undefined, undefined);
    expect(result).toContain('历史经验');
  });

  it('includes rule reuse evidence', async () => {
    const checkpoint = makeCheckpoint({
      externalSources: [{ sourceType: 'rule_reuse', summary: '已命中历史规则：rule' }]
    });
    const result = await buildSessionConversationContext(makeSession(), checkpoint, [], 'test', undefined, undefined);
    expect(result).toContain('规则');
  });

  it('includes skill reuse block', async () => {
    const checkpoint = makeCheckpoint({ reusedSkills: ['skill-1'] });
    const result = await buildSessionConversationContext(makeSession(), checkpoint, [], 'test', undefined, undefined);
    expect(result).toContain('技能');
  });

  it('includes evidence block', async () => {
    const checkpoint = makeCheckpoint({
      externalSources: [{ sourceType: 'web', trustClass: 'official', summary: 'Web', sourceUrl: 'https://example.com' }]
    });
    const result = await buildSessionConversationContext(makeSession(), checkpoint, [], 'test', undefined, undefined);
    expect(result).toContain('历史证据');
  });

  it('includes learning evaluation block', async () => {
    const checkpoint = makeCheckpoint({ learningEvaluation: { score: 0.8, confidence: 0.9, notes: ['note1'] } });
    const result = await buildSessionConversationContext(makeSession(), checkpoint, [], 'test', undefined, undefined);
    expect(result).toContain('learning 评估');
  });

  it('detects meta-conversation recall pattern', async () => {
    const result = await buildSessionConversationContext(
      makeSession(),
      makeCheckpoint(),
      [],
      '我们刚刚聊了什么',
      undefined,
      undefined
    );
    expect(result).toContain('刚才的对话内容');
  });

  it('detects English meta-conversation pattern', async () => {
    const result = await buildSessionConversationContext(
      makeSession(),
      makeCheckpoint(),
      [],
      'recap what we just talked about',
      undefined,
      undefined
    );
    expect(result).toContain('刚才的对话内容');
  });

  it('filters out system messages', async () => {
    const messages = [
      { id: 'm1', role: 'system', content: 'System', createdAt: '2026-01-01T00:00:00Z' },
      { id: 'm2', role: 'user', content: 'User msg', createdAt: '2026-01-01T00:01:00Z' }
    ];
    const result = await buildSessionConversationContext(
      makeSession(),
      makeCheckpoint(),
      messages as any,
      'test',
      undefined,
      undefined
    );
    expect(result).toContain('User msg');
  });

  it('truncates long messages', async () => {
    const messages = [{ id: 'm1', role: 'user', content: 'a'.repeat(500), createdAt: '2026-01-01T00:00:00Z' }];
    const result = await buildSessionConversationContext(
      makeSession(),
      makeCheckpoint(),
      messages as any,
      'test',
      undefined,
      undefined
    );
    expect(result).toContain('truncated');
  });

  it('includes retrieved memories', async () => {
    vi.mocked(archivalMemorySearchByParams).mockResolvedValue({
      coreMemories: [],
      archivalMemories: [],
      rules: [{ id: 'r1', summary: 'Retrieved rule' }],
      reflections: [{ summary: 'Reflection', nextAttemptAdvice: ['advice1'] }],
      reasons: []
    } as any);
    vi.mocked(flattenStructuredMemories).mockReturnValue([{ id: 'm1', summary: 'Retrieved memory' }]);
    const result = await buildSessionConversationContext(
      makeSession(),
      makeCheckpoint(),
      [],
      'test query',
      undefined,
      {} as any
    );
    expect(result).toContain('检索');
  });

  it('handles reflections with no advice', async () => {
    vi.mocked(archivalMemorySearchByParams).mockResolvedValue({
      coreMemories: [],
      archivalMemories: [],
      rules: [],
      reflections: [{ summary: 'Just a reflection', nextAttemptAdvice: [] }],
      reasons: []
    } as any);
    const result = await buildSessionConversationContext(
      makeSession(),
      makeCheckpoint(),
      [],
      'test query',
      undefined,
      {} as any
    );
    expect(result).toBeDefined();
  });

  it('uses custom context strategy', async () => {
    const result = await buildSessionConversationContext(
      makeSession(),
      makeCheckpoint(),
      [],
      'test',
      { recentTurns: 3, ragTopK: 2 } as any,
      undefined
    );
    expect(result).toBeDefined();
  });

  it('handles compression with empty optional fields', async () => {
    const session = makeSession({ compression: { summary: 'just summary' } });
    const result = await buildSessionConversationContext(session, makeCheckpoint(), [], 'test', undefined, undefined);
    expect(result).toBeDefined();
  });
});
