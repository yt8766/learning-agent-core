import { describe, expect, it } from 'vitest';

import {
  defaultConnectorSessionState,
  groupConnectorDiscoveryHistory,
  groupGovernanceAuditByTarget
} from '../src/centers/runtime-connector-governance-records';

describe('runtime connector governance records', () => {
  it('groups connector history and governance audit records by connector target', () => {
    expect(defaultConnectorSessionState('stdio')).toBe('disconnected');

    expect(
      groupConnectorDiscoveryHistory([
        { connectorId: 'github', discoveredAt: '2026-03-27T10:00:00.000Z' } as any,
        { connectorId: 'github', discoveredAt: '2026-03-27T09:00:00.000Z' } as any
      ]).get('github')
    ).toHaveLength(2);

    expect(
      groupGovernanceAuditByTarget([
        { scope: 'connector', targetId: 'github' } as any,
        { scope: 'skill-install', targetId: 'skill-1' } as any
      ]).get('github')
    ).toHaveLength(1);
  });
});
