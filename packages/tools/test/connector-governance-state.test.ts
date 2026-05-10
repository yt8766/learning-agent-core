import { describe, expect, it } from 'vitest';

import {
  clearCapabilityPolicyOverride,
  clearConnectorPolicyOverride,
  resolveConfiguredConnectorId,
  setCapabilityPolicyOverride,
  setConfiguredConnectorRecord,
  setConnectorEnabledState,
  setConnectorPolicyOverride
} from '@agent/runtime';

describe('connector governance state', () => {
  it('toggles disabled connector ids deterministically', () => {
    expect(
      setConnectorEnabledState(
        {
          governance: {
            disabledConnectorIds: ['legacy-disabled', 'connector-1']
          }
        } as never,
        'connector-1',
        true
      ).governance.disabledConnectorIds
    ).toEqual(['legacy-disabled']);

    expect(
      setConnectorEnabledState(
        {
          governance: {
            disabledConnectorIds: ['legacy-disabled']
          }
        } as never,
        'connector-2',
        false
      ).governance.disabledConnectorIds
    ).toEqual(['legacy-disabled', 'connector-2']);
  });

  it('upserts and clears connector/capability approval overrides', () => {
    const snapshot = {
      governance: {
        connectorPolicyOverrides: [{ connectorId: 'connector-old', effect: 'observe' }],
        capabilityPolicyOverrides: [{ capabilityId: 'cap-old', connectorId: 'connector-old', effect: 'allow' }]
      }
    } as never;

    expect(
      setConnectorPolicyOverride(snapshot, {
        connectorId: 'connector-1',
        effect: 'deny',
        actor: 'tester',
        updatedAt: '2026-04-08T10:00:00.000Z'
      }).governance.connectorPolicyOverrides
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ connectorId: 'connector-1', effect: 'deny', updatedBy: 'tester' })
      ])
    );

    expect(
      clearConnectorPolicyOverride(
        {
          governance: {
            connectorPolicyOverrides: [{ connectorId: 'connector-old', effect: 'observe' }]
          }
        } as never,
        'connector-old'
      ).governance.connectorPolicyOverrides
    ).toEqual([]);

    expect(
      setCapabilityPolicyOverride(snapshot, {
        connectorId: 'connector-1',
        capabilityId: 'cap-1',
        effect: 'require-approval',
        actor: 'tester',
        updatedAt: '2026-04-08T10:00:00.000Z'
      }).governance.capabilityPolicyOverrides
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capabilityId: 'cap-1',
          connectorId: 'connector-1',
          effect: 'require-approval'
        })
      ])
    );

    expect(
      clearCapabilityPolicyOverride(
        {
          governance: {
            capabilityPolicyOverrides: [{ capabilityId: 'cap-old', connectorId: 'connector-old', effect: 'allow' }]
          }
        } as never,
        'cap-old'
      ).governance.capabilityPolicyOverrides
    ).toEqual([]);
  });

  it('maps template ids to configured connector ids and upserts configured connector records', () => {
    expect(resolveConfiguredConnectorId('github-mcp-template')).toBe('github-mcp');
    expect(resolveConfiguredConnectorId('browser-mcp-template')).toBe('browser-mcp');
    expect(resolveConfiguredConnectorId('lark-mcp-template')).toBe('lark-mcp');

    const snapshot = {
      governance: {
        configuredConnectors: [{ connectorId: 'browser-mcp', templateId: 'browser-mcp-template' }]
      }
    } as never;

    expect(
      setConfiguredConnectorRecord(snapshot, {
        templateId: 'github-mcp-template',
        actor: 'tester',
        enabled: false
      } as never).governance.configuredConnectors
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectorId: 'github-mcp',
          templateId: 'github-mcp-template',
          enabled: false
        })
      ])
    );
  });
});
