import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/session/session-compression-helpers', () => ({
  createHeuristicConversationSummary: vi.fn().mockReturnValue({ summary: 'Heuristic summary', source: 'heuristic' }),
  formatCompressionSummaryText: vi.fn().mockReturnValue('formatted'),
  normalizeMessageSnippet: vi.fn().mockImplementation((content: string) => content.slice(0, 50)),
  parseStructuredCompressionSummary: vi.fn().mockReturnValue(null),
  truncateSummary: vi.fn().mockImplementation((s: string) => s)
}));

vi.mock('../src/utils/llm-retry', () => ({
  generateTextWithRetry: vi
    .fn()
    .mockResolvedValue('{"summary":"LLM summary","period_or_topic":"topic","primary_focuses":["focus1"]}')
}));

import { compressConversationIfNeeded } from '../src/session/coordinator/session-coordinator-compression';

function makeLlm(overrides: Record<string, unknown> = {}): any {
  return {
    isConfigured: vi.fn().mockReturnValue(false),
    ...overrides
  };
}

function makeSession(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'session-1',
    compression: undefined,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeMessages(count: number, contentPrefix = 'message'): any[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `${contentPrefix} ${i}`,
    createdAt: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`
  }));
}

describe('compressConversationIfNeeded (direct)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when compression disabled', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    const result = await compressConversationIfNeeded(
      makeLlm(),
      { compressionEnabled: false } as any,
      session,
      messages,
      vi.fn()
    );
    expect(result).toBe(false);
  });

  it('returns false when message count below threshold', async () => {
    const session = makeSession();
    const messages = makeMessages(5);
    const result = await compressConversationIfNeeded(makeLlm(), undefined, session, messages, vi.fn());
    expect(result).toBe(false);
  });

  it('compresses when message count exceeds threshold', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    const onCompacted = vi.fn();
    const result = await compressConversationIfNeeded(makeLlm(), undefined, session, messages, onCompacted);
    expect(result).toBe(true);
    expect(session.compression).toBeDefined();
    expect(onCompacted).toHaveBeenCalled();
  });

  it('compresses when character count exceeds threshold', async () => {
    const session = makeSession();
    const messages = makeMessages(8, 'a'.repeat(600));
    const onCompacted = vi.fn();
    const result = await compressConversationIfNeeded(makeLlm(), undefined, session, messages, onCompacted);
    expect(result).toBe(true);
  });

  it('returns false when nextCondensedCount <= condensedCount', async () => {
    const session = makeSession({ compression: { condensedMessageCount: 20 } });
    const messages = makeMessages(20);
    const result = await compressConversationIfNeeded(makeLlm(), undefined, session, messages, vi.fn());
    expect(result).toBe(false);
  });

  it('uses heuristic summary when LLM not configured', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    await compressConversationIfNeeded(
      makeLlm({ isConfigured: vi.fn().mockReturnValue(false) }),
      undefined,
      session,
      messages,
      vi.fn()
    );
    const { createHeuristicConversationSummary } = await import('../src/session/session-compression-helpers');
    expect(createHeuristicConversationSummary).toHaveBeenCalled();
  });

  it('uses LLM summary when configured', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    const llm = makeLlm({ isConfigured: vi.fn().mockReturnValue(true) });
    await compressConversationIfNeeded(llm, undefined, session, messages, vi.fn());
    const { generateTextWithRetry } = await import('../src/utils/llm-retry');
    expect(generateTextWithRetry).toHaveBeenCalled();
  });

  it('falls back to heuristic when LLM returns empty', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    const llm = makeLlm({ isConfigured: vi.fn().mockReturnValue(true) });
    const { generateTextWithRetry } = await import('../src/utils/llm-retry');
    vi.mocked(generateTextWithRetry).mockResolvedValueOnce('   ');
    await compressConversationIfNeeded(llm, undefined, session, messages, vi.fn());
    const { createHeuristicConversationSummary } = await import('../src/session/session-compression-helpers');
    expect(createHeuristicConversationSummary).toHaveBeenCalled();
  });

  it('falls back to heuristic when parse fails', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    const llm = makeLlm({ isConfigured: vi.fn().mockReturnValue(true) });
    const { parseStructuredCompressionSummary } = await import('../src/session/session-compression-helpers');
    vi.mocked(parseStructuredCompressionSummary).mockReturnValueOnce(null);
    await compressConversationIfNeeded(llm, undefined, session, messages, vi.fn());
    const { createHeuristicConversationSummary } = await import('../src/session/session-compression-helpers');
    expect(createHeuristicConversationSummary).toHaveBeenCalled();
  });

  it('falls back to heuristic when LLM throws', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    const llm = makeLlm({ isConfigured: vi.fn().mockReturnValue(true) });
    const { generateTextWithRetry } = await import('../src/utils/llm-retry');
    vi.mocked(generateTextWithRetry).mockRejectedValueOnce(new Error('LLM error'));
    await compressConversationIfNeeded(llm, undefined, session, messages, vi.fn());
    const { createHeuristicConversationSummary } = await import('../src/session/session-compression-helpers');
    expect(createHeuristicConversationSummary).toHaveBeenCalled();
  });

  it('uses custom context strategy values', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    const strategy = {
      compressionKeepRecentMessages: 3,
      compressionKeepLeadingMessages: 5,
      compressionMessageThreshold: 10,
      compressionMaxSummaryChars: 500
    } as any;
    const result = await compressConversationIfNeeded(makeLlm(), strategy, session, messages, vi.fn());
    expect(result).toBe(true);
  });

  it('derives long-flow compression profile for review input', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    await compressConversationIfNeeded(makeLlm(), undefined, session, messages, vi.fn(), '请帮我审查这段代码');
    expect(session.compression).toBeDefined();
    expect(session.compression.compressionProfile).toBe('long-flow');
  });

  it('derives light-chat compression profile for quick input', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    await compressConversationIfNeeded(makeLlm(), undefined, session, messages, vi.fn(), '简单问答一下');
    expect(session.compression.compressionProfile).toBe('light-chat');
  });

  it('derives default compression profile for normal input', async () => {
    const session = makeSession();
    const messages = makeMessages(20);
    await compressConversationIfNeeded(makeLlm(), undefined, session, messages, vi.fn(), 'normal question');
    expect(session.compression.compressionProfile).toBe('default');
  });
});
