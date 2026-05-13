import { describe, expect, it, vi } from 'vitest';

import {
  toConnectorDiscoveryHistoryRecord,
  getCapabilityGovernanceProfiles,
  getGovernanceProfiles
} from '../src/governance/runtime-governance-store';

describe('runtime-governance-store', () => {
  describe('toConnectorDiscoveryHistoryRecord', () => {
    it('builds record from connector', () => {
      const connector = {
        lastDiscoveredAt: '2026-04-16T00:00:00.000Z',
        discoveredCapabilities: ['tool-1', 'tool-2'],
        discoveryMode: 'registered' as const,
        sessionState: 'connected' as const,
        transport: 'http'
      };
      const result = toConnectorDiscoveryHistoryRecord('connector-1', connector);
      expect(result.connectorId).toBe('connector-1');
      expect(result.discoveredAt).toBe('2026-04-16T00:00:00.000Z');
      expect(result.discoveredCapabilities).toEqual(['tool-1', 'tool-2']);
      expect(result.discoveryMode).toBe('registered');
      expect(result.sessionState).toBe('connected');
    });

    it('uses capabilities fallback when discoveredCapabilities missing', () => {
      const connector = {
        capabilities: [{ toolName: 'cap-1' }, { toolName: 'cap-2' }],
        transport: 'stdio'
      };
      const result = toConnectorDiscoveryHistoryRecord('connector-2', connector);
      expect(result.discoveredCapabilities).toEqual(['cap-1', 'cap-2']);
    });

    it('returns empty capabilities when connector undefined', () => {
      const result = toConnectorDiscoveryHistoryRecord('connector-3', undefined);
      expect(result.connectorId).toBe('connector-3');
      expect(result.discoveredCapabilities).toEqual([]);
    });

    it('includes error when provided', () => {
      const result = toConnectorDiscoveryHistoryRecord('connector-4', undefined, 'connection failed');
      expect(result.error).toBe('connection failed');
    });

    it('defaults sessionState to disconnected for stdio', () => {
      const connector = { transport: 'stdio' };
      const result = toConnectorDiscoveryHistoryRecord('c-1', connector);
      expect(result.sessionState).toBe('disconnected');
    });

    it('defaults sessionState to stateless for http', () => {
      const connector = { transport: 'http' };
      const result = toConnectorDiscoveryHistoryRecord('c-1', connector);
      expect(result.sessionState).toBe('stateless');
    });

    it('uses connector lastDiscoveryError when no explicit error', () => {
      const connector = {
        lastDiscoveryError: 'timeout',
        transport: 'http'
      };
      const result = toConnectorDiscoveryHistoryRecord('c-1', connector);
      expect(result.error).toBe('timeout');
    });
  });

  describe('getCapabilityGovernanceProfiles', () => {
    it('returns empty array when no governance', () => {
      expect(getCapabilityGovernanceProfiles({} as any)).toEqual([]);
    });

    it('returns empty array when governance has no profiles', () => {
      expect(getCapabilityGovernanceProfiles({ governance: {} } as any)).toEqual([]);
    });

    it('parses valid profiles', () => {
      const snapshot = {
        governance: {
          capabilityGovernanceProfiles: [
            {
              capabilityId: 'cap-1',
              displayName: 'Test Skill',
              ownerType: 'ministry-owned',
              kind: 'skill',
              trustLevel: 'high',
              trustTrend: 'up',
              reportCount: 5,
              promoteCount: 3,
              holdCount: 1,
              downgradeCount: 1,
              passCount: 4,
              reviseRequiredCount: 0,
              blockCount: 1,
              lastTaskId: 'task-1',
              lastReviewDecision: 'pass',
              lastTrustAdjustment: 'promote',
              recentOutcomes: [],
              updatedAt: '2026-04-16T00:00:00.000Z'
            }
          ]
        }
      };
      const result = getCapabilityGovernanceProfiles(snapshot as any);
      expect(result).toHaveLength(1);
      expect(result[0].capabilityId).toBe('cap-1');
    });

    it('filters out invalid profiles', () => {
      const snapshot = {
        governance: {
          capabilityGovernanceProfiles: [
            {
              capabilityId: 'cap-1',
              displayName: 'Valid',
              ownerType: 'ministry-owned',
              kind: 'skill',
              trustLevel: 'high',
              trustTrend: 'up',
              reportCount: 0,
              promoteCount: 0,
              holdCount: 0,
              downgradeCount: 0,
              passCount: 0,
              reviseRequiredCount: 0,
              blockCount: 0,
              lastTaskId: 't',
              lastReviewDecision: 'pass',
              lastTrustAdjustment: 'hold',
              recentOutcomes: [],
              updatedAt: '2026-04-16T00:00:00.000Z'
            },
            { invalid: true }
          ]
        }
      };
      const result = getCapabilityGovernanceProfiles(snapshot as any);
      expect(result).toHaveLength(1);
    });
  });

  describe('getGovernanceProfiles', () => {
    it('returns empty array for ministry kind', () => {
      expect(getGovernanceProfiles({} as any, 'ministry')).toEqual([]);
    });

    it('returns empty array for worker kind', () => {
      expect(getGovernanceProfiles({} as any, 'worker')).toEqual([]);
    });

    it('returns empty array for specialist kind', () => {
      expect(getGovernanceProfiles({} as any, 'specialist')).toEqual([]);
    });

    it('parses valid ministry profiles', () => {
      const snapshot = {
        governance: {
          ministryGovernanceProfiles: [
            {
              entityId: 'hubu-search',
              displayName: '户部',
              entityKind: 'ministry',
              trustLevel: 'high',
              trustTrend: 'up',
              reportCount: 10,
              promoteCount: 5,
              holdCount: 3,
              downgradeCount: 2,
              passCount: 8,
              reviseRequiredCount: 1,
              blockCount: 1,
              lastTaskId: 'task-1',
              lastReviewDecision: 'pass',
              lastTrustAdjustment: 'promote',
              recentOutcomes: [],
              updatedAt: '2026-04-16T00:00:00.000Z'
            }
          ]
        }
      };
      const result = getGovernanceProfiles(snapshot as any, 'ministry');
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('hubu-search');
    });
  });
});
