import { describe, expect, it } from 'vitest';

import { buildConnectorsCenter } from '../../../src/runtime/centers/runtime-connectors-center';

describe('runtime-connectors-center', () => {
  it('projects global cangjing ingestion summary onto connector records', () => {
    const result = buildConnectorsCenter({
      profile: 'personal' as any,
      snapshot: {
        governance: {
          configuredConnectors: [],
          connectorDiscoveryHistory: [],
          connectorPolicyOverrides: [],
          capabilityPolicyOverrides: []
        },
        governanceAudit: []
      } as any,
      tasks: [],
      connectors: [
        {
          id: 'github-mcp',
          displayName: 'GitHub MCP',
          transport: 'stdio',
          enabled: true,
          source: 'configured',
          trustClass: 'official',
          dataScope: 'repos',
          writeScope: 'issues',
          installationMode: 'configured',
          allowedProfiles: ['personal'],
          capabilityCount: 1,
          implementedCapabilityCount: 1,
          discoveredCapabilityCount: 1,
          capabilities: []
        }
      ] as any,
      knowledgeOverview: {
        sourceCount: 6,
        searchableDocumentCount: 4,
        blockedDocumentCount: 2,
        latestReceipts: [{ id: 'receipt-1' }, { id: 'receipt-2' }]
      }
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        knowledgeIngestion: {
          sourceCount: 6,
          searchableDocumentCount: 4,
          blockedDocumentCount: 2,
          latestReceiptIds: ['receipt-1', 'receipt-2']
        }
      })
    );
  });
});
