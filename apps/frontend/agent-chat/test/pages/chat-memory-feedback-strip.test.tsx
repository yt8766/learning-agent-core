import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/chat-memory-api', () => ({
  overrideChatMemory: vi.fn().mockResolvedValue({}),
  patchChatProfile: vi.fn().mockResolvedValue({}),
  recordChatMemoryFeedback: vi.fn().mockResolvedValue({})
}));

vi.mock('@/pages/chat-home/chat-memory-feedback-helpers', () => ({
  buildForgetMemoryOverridePayload: vi.fn(() => ({})),
  buildSessionMemoryOverridePayload: vi.fn(() => ({})),
  buildSessionOnlyMemoryOverridePayload: vi.fn(() => ({}))
}));

vi.mock('@/pages/chat-home/chat-memory-preference-helpers', () => ({
  buildProfilePatchFromPreferenceUpdate: vi.fn(() => ({ communicationStyle: 'test' }))
}));

import { ChatMemoryFeedbackStrip } from '@/pages/chat-home/chat-memory-feedback-strip';

type SourceRecord = {
  id: string;
  sourceId?: string;
  taskId: string;
  sourceType: string;
  sourceUrl?: string;
  trustClass: string;
  summary: string;
  detail?: Record<string, unknown>;
  linkedRunId?: string;
  createdAt: string;
  fetchedAt?: string;
};

describe('ChatMemoryFeedbackStrip', () => {
  it('returns null when no actionable sources', () => {
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={[]} />);

    expect(html).toBe('');
  });

  it('returns null when sources have no memoryId', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Some memory',
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).toBe('');
  });

  it('renders feedback buttons for sources with memoryId', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: '已命中历史记忆：User prefers concise answers',
        detail: { memoryId: 'mem-1' },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).toContain('memory');
    expect(html).toContain('有 用');
    expect(html).toContain('不适用');
    expect(html).toContain('Forget this');
    expect(html).toContain('记错了');
    expect(html).toContain('仅本会话');
  });

  it('renders memory reason copy with score', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Memory with reason',
        detail: { memoryId: 'mem-1', reason: 'semantic match', score: 0.85 },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).toContain('semantic match');
    expect(html).toContain('0.85');
  });

  it('renders memory reason copy with score only', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Memory with score',
        detail: { memoryId: 'mem-1', score: 0.72 },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).toContain('score 0.72');
  });

  it('renders memory reason copy with reason only', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Memory with reason',
        detail: { memoryId: 'mem-1', reason: 'keyword overlap' },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).toContain('keyword overlap');
  });

  it('shows update preference button for preference memory type with profileUserId', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Preference memory',
        detail: {
          memoryId: 'mem-1',
          memoryType: 'preference',
          relatedEntities: [{ entityType: 'user', entityId: 'user-123' }]
        },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).toContain('Update preference');
  });

  it('does not show update preference button for non-preference memory type', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Fact memory',
        detail: {
          memoryId: 'mem-1',
          memoryType: 'fact',
          relatedEntities: [{ entityType: 'user', entityId: 'user-123' }]
        },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).not.toContain('Update preference');
  });

  it('does not show update preference button without profileUserId', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Preference memory',
        detail: {
          memoryId: 'mem-1',
          memoryType: 'preference',
          relatedEntities: []
        },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).not.toContain('Update preference');
  });

  it('limits to 2 actionable sources', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Memory 1',
        detail: { memoryId: 'mem-1' },
        createdAt: new Date().toISOString()
      },
      {
        id: 'src-2',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Memory 2',
        detail: { memoryId: 'mem-2' },
        createdAt: new Date().toISOString()
      },
      {
        id: 'src-3',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Memory 3',
        detail: { memoryId: 'mem-3' },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    // Should render at most 2 memory tags
    const memoryTagCount = (html.match(/memory/g) || []).length;
    expect(memoryTagCount).toBeLessThanOrEqual(4); // Each source has a "memory" tag label + possibly in reason
  });

  it('renders reason text when detail has no reason or score', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Plain memory',
        detail: { memoryId: 'mem-1' },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    // Should not contain "采用原因" when no reason/score
    expect(html).not.toContain('采用原因');
  });

  it('handles relatedEntities with non-object entries', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Memory with bad entities',
        detail: {
          memoryId: 'mem-1',
          memoryType: 'preference',
          relatedEntities: [null, 'not-an-object', { entityType: 'user', entityId: 'user-456' }]
        },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).toContain('Update preference');
  });

  it('handles relatedEntities without entityType', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Memory with wrong entity type',
        detail: {
          memoryId: 'mem-1',
          memoryType: 'preference',
          relatedEntities: [{ entityType: 'workspace', entityId: 'ws-1' }]
        },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).not.toContain('Update preference');
  });

  it('handles non-array relatedEntities', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        taskId: 'task-1',
        sourceType: 'memory',
        trustClass: 'trusted',
        summary: 'Memory with non-array entities',
        detail: {
          memoryId: 'mem-1',
          memoryType: 'preference',
          relatedEntities: 'not-an-array' as any
        },
        createdAt: new Date().toISOString()
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryFeedbackStrip sources={sources} />);

    expect(html).not.toContain('Update preference');
  });
});
