import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { MemorySearchResultRow, VersionSnapshotCard } from '@/pages/learning-center/memory-browser-card-components';

describe('MemorySearchResultRow', () => {
  const baseMemory = {
    id: 'mem-1',
    summary: 'Do not auto-commit code',
    status: 'active' as const,
    memoryType: 'constraint' as const,
    scopeType: 'workspace' as const,
    verificationStatus: 'verified' as const,
    sourceEvidenceIds: ['ev-1', 'ev-2'],
    usageMetrics: {
      retrievedCount: 5,
      injectedCount: 3,
      adoptedCount: 2,
      dismissedCount: 1
    }
  };

  it('renders memory badges and summary', () => {
    const html = renderToStaticMarkup(
      <MemorySearchResultRow memory={baseMemory} selected={false} onSelect={async () => {}} />
    );

    expect(html).toContain('constraint');
    expect(html).toContain('workspace');
    expect(html).toContain('active');
    expect(html).toContain('verified');
    expect(html).toContain('Do not auto-commit code');
    expect(html).toContain('evidence 2');
    expect(html).toContain('adopted 2');
  });

  it('renders reason and score when provided', () => {
    const html = renderToStaticMarkup(
      <MemorySearchResultRow
        memory={baseMemory}
        selected={false}
        reason={{
          id: 'mem-1',
          kind: 'memory',
          summary: 'Do not auto-commit',
          score: 0.92,
          reason: 'entity matched; same scope'
        }}
        onSelect={async () => {}}
      />
    );

    expect(html).toContain('score 0.92');
    expect(html).toContain('reason: entity matched; same scope');
  });

  it('applies selected style when selected', () => {
    const html = renderToStaticMarkup(<MemorySearchResultRow memory={baseMemory} selected onSelect={async () => {}} />);

    expect(html).toContain('border-sky-300');
  });

  it('applies unselected style when not selected', () => {
    const html = renderToStaticMarkup(
      <MemorySearchResultRow memory={baseMemory} selected={false} onSelect={async () => {}} />
    );

    expect(html).toContain('border-border/60');
  });

  it('shows retire button for active memory', () => {
    const html = renderToStaticMarkup(
      <MemorySearchResultRow memory={baseMemory} selected={false} onSelect={async () => {}} />
    );

    expect(html).toContain('归档');
    expect(html).toContain('失效');
  });

  it('shows restore button for archived memory', () => {
    const html = renderToStaticMarkup(
      <MemorySearchResultRow
        memory={{ ...baseMemory, status: 'archived' }}
        selected={false}
        onSelect={async () => {}}
      />
    );

    expect(html).toContain('恢复');
  });

  it('shows restore button for stale memory', () => {
    const html = renderToStaticMarkup(
      <MemorySearchResultRow memory={{ ...baseMemory, status: 'stale' }} selected={false} onSelect={async () => {}} />
    );

    expect(html).toContain('恢复');
  });

  it('always renders view snapshot button', () => {
    const html = renderToStaticMarkup(
      <MemorySearchResultRow memory={baseMemory} selected={false} onSelect={async () => {}} />
    );

    expect(html).toContain('查看快照');
  });

  it('renders with missing optional fields', () => {
    const html = renderToStaticMarkup(
      <MemorySearchResultRow
        memory={{
          id: 'mem-2',
          summary: 'Minimal memory'
        }}
        selected={false}
        onSelect={async () => {}}
      />
    );

    expect(html).toContain('unknown');
    expect(html).toContain('Minimal memory');
  });
});

describe('VersionSnapshotCard', () => {
  it('renders snapshot title and summary', () => {
    const html = renderToStaticMarkup(
      <VersionSnapshotCard
        title="Left Version"
        snapshot={{
          summary: 'Snapshot summary',
          content: 'Snapshot content',
          memoryType: 'fact',
          scopeType: 'user',
          status: 'active',
          sourceEvidenceIds: ['ev-1'],
          usageMetrics: {
            retrievedCount: 3,
            injectedCount: 2,
            adoptedCount: 1,
            dismissedCount: 0,
            correctedCount: 0
          }
        }}
      />
    );

    expect(html).toContain('Left Version');
    expect(html).toContain('Snapshot summary');
    expect(html).toContain('Snapshot content');
    expect(html).toContain('fact');
    expect(html).toContain('user');
    expect(html).toContain('active');
    expect(html).toContain('evidence 1');
    expect(html).toContain('adopted 1');
    expect(html).toContain('dismissed 0');
    expect(html).toContain('corrected 0');
  });

  it('renders with minimal data', () => {
    const html = renderToStaticMarkup(
      <VersionSnapshotCard
        title="Right Version"
        snapshot={{
          summary: 'Minimal',
          content: '',
          sourceEvidenceIds: []
        }}
      />
    );

    expect(html).toContain('Right Version');
    expect(html).toContain('Minimal');
    expect(html).toContain('evidence 0');
  });
});
