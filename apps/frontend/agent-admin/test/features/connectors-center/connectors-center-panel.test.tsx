import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ConnectorsCenterPanel } from '@/features/connectors-center/connectors-center-panel';

describe('ConnectorsCenterPanel render smoke', () => {
  it('renders shell title and connector cards', () => {
    const html = renderToStaticMarkup(
      <ConnectorsCenterPanel
        connectors={[
          {
            id: 'github-mcp',
            displayName: 'GitHub MCP',
            enabled: true,
            transport: 'stdio',
            capabilityCount: 3,
            knowledgeIngestion: {
              sourceCount: 5,
              searchableDocumentCount: 4,
              blockedDocumentCount: 1,
              latestReceiptIds: ['receipt-1']
            },
            capabilities: [],
            policyOverrides: [],
            sessions: []
          } as any
        ]}
        onSelectTask={vi.fn()}
        onCloseSession={vi.fn()}
        onRefreshConnectorDiscovery={vi.fn()}
        onEnableConnector={vi.fn()}
        onDisableConnector={vi.fn()}
        onSetConnectorPolicy={vi.fn()}
        onClearConnectorPolicy={vi.fn()}
        onSetCapabilityPolicy={vi.fn()}
        onClearCapabilityPolicy={vi.fn()}
        onConfigureConnector={vi.fn()}
      />
    );

    expect(html).toContain('Connector &amp; Policy Center');
    expect(html).toContain('GitHub MCP');
    expect(html).toContain('Manifest Ingestion');
    expect(html).toContain('Searchable Docs');
  });
});
