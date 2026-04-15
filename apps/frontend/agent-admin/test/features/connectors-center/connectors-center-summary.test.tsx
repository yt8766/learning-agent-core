import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>
}));

import { ConnectorsCenterSummary } from '@/features/connectors-center/connectors-center-summary';

describe('ConnectorsCenterSummary', () => {
  it('renders aggregate metrics, performers, and attention lists', () => {
    const html = renderToStaticMarkup(
      <ConnectorsCenterSummary
        connectors={
          [
            {
              id: 'a',
              displayName: 'Connector A',
              successRate: 0.95,
              capabilityCount: 3,
              totalTaskCount: 8,
              healthState: 'healthy',
              recentFailureReason: null,
              capabilities: [{ effectiveApprovalMode: 'require-approval' }],
              knowledgeIngestion: { sourceCount: 5, searchableDocumentCount: 3, blockedDocumentCount: 2 }
            },
            {
              id: 'b',
              displayName: 'Connector B',
              successRate: 0.4,
              capabilityCount: 2,
              totalTaskCount: 4,
              healthState: 'degraded',
              recentFailureReason: 'timeout',
              capabilities: [{ effectiveApprovalMode: 'default' }]
            }
          ] as any
        }
      />
    );

    expect(html).toContain('Connector Effectiveness');
    expect(html).toContain('68%');
    expect(html).toContain('Capability Governance');
    expect(html).toContain('Connector Usage');
    expect(html).toContain('Manifest Ingestion');
    expect(html).toContain('Searchable Docs');
    expect(html).toContain('Blocked Docs');
    expect(html).toContain('Top Performers');
    expect(html).toContain('Needs Attention');
    expect(html).toContain('Connector A');
    expect(html).toContain('Connector B');
    expect(html).toContain('timeout');
  });

  it('renders fallback content when no performance data is available', () => {
    const html = renderToStaticMarkup(
      <ConnectorsCenterSummary
        connectors={[{ id: 'a', displayName: 'Connector A', capabilities: [], healthState: 'healthy' } as any]}
      />
    );

    expect(html).toContain('N/A');
    expect(html).not.toContain('Top Performers');
    expect(html).not.toContain('Needs Attention');
  });
});
