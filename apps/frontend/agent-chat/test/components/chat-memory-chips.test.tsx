import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ChatMemoryChips } from '@/pages/chat-home/chat-memory-chips';

type SourceRecord = {
  id: string;
  sourceType: string;
  summary: string;
  detail?: Record<string, unknown>;
  createdAt: string;
  taskId: string;
  trustClass: string;
};

describe('ChatMemoryChips', () => {
  it('returns null when no sources and no reuse arrays', () => {
    const html = renderToStaticMarkup(<ChatMemoryChips sources={[]} />);
    expect(html).toBe('');
  });

  it('returns null when only empty reuse arrays provided', () => {
    const html = renderToStaticMarkup(
      <ChatMemoryChips sources={[]} reusedMemories={[]} reusedRules={[]} reusedSkills={[]} />
    );
    expect(html).toBe('');
  });

  it('renders memory source chips', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        sourceType: 'memory_reuse',
        summary: '已命中历史记忆：User prefers concise',
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('memory:');
    expect(html).toContain('User prefers conci');
  });

  it('renders rule source chips with purple color', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-2',
        sourceType: 'rule_reuse',
        summary: '已命中历史规则：Always check types',
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('rule:');
    expect(html).toContain('Always check types');
  });

  it('renders reflection source chips', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-3',
        sourceType: 'memory_reuse',
        summary: '已命中历史反思：Previous failure pattern',
        detail: { reflectionId: 'ref-1' },
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('reflection:');
  });

  it('renders reused skill chips', () => {
    const sources: SourceRecord[] = [];
    const html = renderToStaticMarkup(
      <ChatMemoryChips sources={sources} reusedSkills={['github-review', 'code-gen', 'test-runner']} />
    );
    expect(html).toContain('skill:github-review');
    expect(html).toContain('skill:code-gen');
    expect(html).not.toContain('skill:test-runner'); // limited to 2
  });

  it('limits to 4 visible sources', () => {
    const sources: SourceRecord[] = Array.from({ length: 6 }, (_, i) => ({
      id: `src-${i}`,
      sourceType: 'memory_reuse',
      summary: `Memory ${i}`,
      createdAt: new Date().toISOString(),
      taskId: 'task-1',
      trustClass: 'high'
    }));
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('Memory 0');
    expect(html).toContain('Memory 3');
    expect(html).not.toContain('Memory 4');
  });

  it('renders reason and score when present', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        sourceType: 'memory_reuse',
        summary: 'Memory',
        detail: { reason: 'Semantic match', score: 0.95 },
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('Semantic match');
    expect(html).toContain('0.95');
  });

  it('renders scopeType when present', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        sourceType: 'memory_reuse',
        summary: 'Memory',
        detail: { scopeType: 'workspace' },
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('workspace');
  });

  it('renders related entity labels', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        sourceType: 'memory_reuse',
        summary: 'Memory',
        detail: {
          relatedEntities: [
            { entityType: 'user', entityId: 'u1' },
            { entityType: 'project', entityId: 'p1' }
          ]
        },
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('user:u1');
    expect(html).toContain('project:p1');
  });

  it('handles relatedEntities with non-object entries', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        sourceType: 'memory_reuse',
        summary: 'Memory',
        detail: {
          relatedEntities: [null, 'string', { entityType: 'user', entityId: 'u1' }]
        },
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('user:u1');
  });

  it('handles relatedEntities with empty entityType or entityId', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        sourceType: 'memory_reuse',
        summary: 'Memory',
        detail: {
          relatedEntities: [
            { entityType: '', entityId: 'u1' },
            { entityType: 'user', entityId: '' }
          ]
        },
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).not.toContain('user:u1');
  });

  it('limits related entity labels to 2 per source', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        sourceType: 'memory_reuse',
        summary: 'Memory',
        detail: {
          reason: 'match',
          relatedEntities: [
            { entityType: 'user', entityId: 'u1' },
            { entityType: 'project', entityId: 'p1' },
            { entityType: 'workspace', entityId: 'w1' }
          ]
        },
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('user:u1');
    expect(html).toContain('project:p1');
    expect(html).not.toContain('workspace:w1');
  });

  it('shows fallback reason when no reason provided', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        sourceType: 'memory_reuse',
        summary: 'Memory',
        detail: { score: 0.8 },
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    expect(html).toContain('matched structured memory context');
  });

  it('returns null for source with no reason, score, scopeType, or entities', () => {
    const sources: SourceRecord[] = [
      {
        id: 'src-1',
        sourceType: 'memory_reuse',
        summary: 'Memory',
        detail: {},
        createdAt: new Date().toISOString(),
        taskId: 'task-1',
        trustClass: 'high'
      }
    ];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} />);
    // Should not have the "Why this memory was used" text for this source
    expect(html).not.toContain('Why this memory was used');
  });

  it('renders reused rules when provided', () => {
    const sources: SourceRecord[] = [];
    const html = renderToStaticMarkup(<ChatMemoryChips sources={sources} reusedRules={['rule-1']} />);
    // With reusedRules, component should not return null
    expect(html).not.toBe('');
  });
});
