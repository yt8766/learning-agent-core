import { vi } from 'vitest';

const governanceStoreMocks = vi.hoisted(() => ({
  appendGovernanceAuditMock: vi.fn(async () => undefined),
  persistConnectorDiscoverySnapshotMock: vi.fn(async () => undefined)
}));

export const appendGovernanceAuditMock = governanceStoreMocks.appendGovernanceAuditMock;
export const persistConnectorDiscoverySnapshotMock = governanceStoreMocks.persistConnectorDiscoverySnapshotMock;

vi.mock('@agent/runtime', async importOriginal => {
  const actual = await importOriginal<typeof import('@agent/runtime')>();
  return {
    ...actual,
    appendGovernanceAudit: appendGovernanceAuditMock,
    persistConnectorDiscoverySnapshot: persistConnectorDiscoverySnapshotMock
  };
});

export function createSnapshot() {
  return {
    governance: {
      disabledConnectorIds: ['legacy-disabled'],
      connectorPolicyOverrides: [{ connectorId: 'connector-old', effect: 'observe' }],
      capabilityPolicyOverrides: [{ capabilityId: 'cap-old', connectorId: 'connector-old', effect: 'allow' }],
      configuredConnectors: [{ connectorId: 'browser-mcp', templateId: 'browser-mcp-template' }]
    }
  };
}
