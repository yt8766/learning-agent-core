import { describe, expect, it } from 'vitest';

import {
  setConnectorEnabledState,
  setConnectorPolicyOverride,
  clearConnectorPolicyOverride,
  setCapabilityPolicyOverride,
  clearCapabilityPolicyOverride,
  resolveConfiguredConnectorId,
  setConfiguredConnectorRecord
} from '../../../src/governance/runtime-governance/connector-governance-state';

function makeSnapshot(overrides: Record<string, unknown> = {}): any {
  return { governance: undefined, ...overrides };
}

describe('connector-governance-state (direct)', () => {
  describe('setConnectorEnabledState', () => {
    it('disables a connector', () => {
      const result = setConnectorEnabledState(makeSnapshot(), 'github-mcp', false);
      expect(result.governance.disabledConnectorIds).toContain('github-mcp');
    });

    it('enables a previously disabled connector', () => {
      const snapshot = makeSnapshot({ governance: { disabledConnectorIds: ['github-mcp'] } });
      const result = setConnectorEnabledState(snapshot, 'github-mcp', true);
      expect(result.governance.disabledConnectorIds).not.toContain('github-mcp');
    });

    it('handles undefined governance', () => {
      const result = setConnectorEnabledState(makeSnapshot(), 'test', false);
      expect(result.governance.disabledConnectorIds).toContain('test');
    });

    it('does not duplicate disabled ids', () => {
      const snapshot = makeSnapshot({ governance: { disabledConnectorIds: ['test'] } });
      const result = setConnectorEnabledState(snapshot, 'test', false);
      expect(result.governance.disabledConnectorIds.filter((id: string) => id === 'test')).toHaveLength(1);
    });
  });

  describe('setConnectorPolicyOverride', () => {
    it('adds policy override', () => {
      const result = setConnectorPolicyOverride(makeSnapshot(), {
        connectorId: 'github-mcp',
        effect: 'deny',
        actor: 'admin',
        updatedAt: '2026-01-01T00:00:00Z'
      });
      expect(result.governance.connectorPolicyOverrides).toHaveLength(1);
      expect(result.governance.connectorPolicyOverrides[0].effect).toBe('deny');
    });

    it('replaces existing override for same connector', () => {
      const snapshot = makeSnapshot({
        governance: { connectorPolicyOverrides: [{ connectorId: 'github-mcp', effect: 'allow' }] }
      });
      const result = setConnectorPolicyOverride(snapshot, {
        connectorId: 'github-mcp',
        effect: 'deny',
        actor: 'admin',
        updatedAt: '2026-01-01T00:00:00Z'
      });
      expect(result.governance.connectorPolicyOverrides).toHaveLength(1);
      expect(result.governance.connectorPolicyOverrides[0].effect).toBe('deny');
    });
  });

  describe('clearConnectorPolicyOverride', () => {
    it('removes override for specified connector', () => {
      const snapshot = makeSnapshot({
        governance: { connectorPolicyOverrides: [{ connectorId: 'github-mcp' }, { connectorId: 'lark-mcp' }] }
      });
      const result = clearConnectorPolicyOverride(snapshot, 'github-mcp');
      expect(result.governance.connectorPolicyOverrides).toHaveLength(1);
      expect(result.governance.connectorPolicyOverrides[0].connectorId).toBe('lark-mcp');
    });
  });

  describe('setCapabilityPolicyOverride', () => {
    it('adds capability policy override', () => {
      const result = setCapabilityPolicyOverride(makeSnapshot(), {
        connectorId: 'github-mcp',
        capabilityId: 'cap-1',
        effect: 'require-approval',
        actor: 'admin',
        updatedAt: '2026-01-01T00:00:00Z'
      });
      expect(result.governance.capabilityPolicyOverrides).toHaveLength(1);
    });

    it('replaces existing override for same capability', () => {
      const snapshot = makeSnapshot({
        governance: { capabilityPolicyOverrides: [{ capabilityId: 'cap-1', effect: 'allow' }] }
      });
      const result = setCapabilityPolicyOverride(snapshot, {
        connectorId: 'github-mcp',
        capabilityId: 'cap-1',
        effect: 'deny',
        actor: 'admin',
        updatedAt: '2026-01-01T00:00:00Z'
      });
      expect(result.governance.capabilityPolicyOverrides).toHaveLength(1);
      expect(result.governance.capabilityPolicyOverrides[0].effect).toBe('deny');
    });
  });

  describe('clearCapabilityPolicyOverride', () => {
    it('removes capability override', () => {
      const snapshot = makeSnapshot({
        governance: { capabilityPolicyOverrides: [{ capabilityId: 'cap-1' }, { capabilityId: 'cap-2' }] }
      });
      const result = clearCapabilityPolicyOverride(snapshot, 'cap-1');
      expect(result.governance.capabilityPolicyOverrides).toHaveLength(1);
      expect(result.governance.capabilityPolicyOverrides[0].capabilityId).toBe('cap-2');
    });
  });

  describe('resolveConfiguredConnectorId', () => {
    it('resolves github template', () => {
      expect(resolveConfiguredConnectorId('github-mcp-template')).toBe('github-mcp');
    });

    it('resolves browser template', () => {
      expect(resolveConfiguredConnectorId('browser-mcp-template')).toBe('browser-mcp');
    });

    it('resolves lark template', () => {
      expect(resolveConfiguredConnectorId('lark-mcp-template')).toBe('lark-mcp');
    });

    it('defaults to lark-mcp for unknown template', () => {
      expect(resolveConfiguredConnectorId('unknown-template')).toBe('lark-mcp');
    });
  });

  describe('setConfiguredConnectorRecord', () => {
    it('adds configured connector record', () => {
      const result = setConfiguredConnectorRecord(makeSnapshot(), {
        templateId: 'github-mcp-template',
        config: { apiKey: 'test' },
        enabled: true
      } as any);
      expect(result.governance.configuredConnectors).toHaveLength(1);
      expect(result.governance.configuredConnectors[0].connectorId).toBe('github-mcp');
      expect(result.governance.configuredConnectors[0].enabled).toBe(true);
    });

    it('defaults enabled to true', () => {
      const result = setConfiguredConnectorRecord(makeSnapshot(), {
        templateId: 'github-mcp-template',
        config: {}
      } as any);
      expect(result.governance.configuredConnectors[0].enabled).toBe(true);
    });

    it('replaces existing connector record', () => {
      const snapshot = makeSnapshot({
        governance: { configuredConnectors: [{ connectorId: 'github-mcp', config: { old: true } }] }
      });
      const result = setConfiguredConnectorRecord(snapshot, {
        templateId: 'github-mcp-template',
        config: { new: true },
        enabled: true
      } as any);
      expect(result.governance.configuredConnectors).toHaveLength(1);
      expect(result.governance.configuredConnectors[0].config).toEqual({ new: true });
    });

    it('uses custom configuredAt', () => {
      const result = setConfiguredConnectorRecord(
        makeSnapshot(),
        {
          templateId: 'browser-mcp-template',
          config: {}
        } as any,
        '2026-01-01T00:00:00Z'
      );
      expect(result.governance.configuredConnectors[0].configuredAt).toBe('2026-01-01T00:00:00Z');
    });
  });
});
