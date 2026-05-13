import { describe, expect, it } from 'vitest';

import {
  aggregateCapabilityGovernanceProfiles,
  aggregateNamedGovernanceProfiles
} from '../src/governance/runtime-governance-aggregation';

describe('runtime-governance-aggregation', () => {
  describe('aggregateCapabilityGovernanceProfiles', () => {
    it('returns empty array when no tasks and no persisted', () => {
      const result = aggregateCapabilityGovernanceProfiles([], []);
      expect(result).toEqual([]);
    });

    it('preserves persisted profiles when no tasks', () => {
      const persisted = [
        {
          capabilityId: 'cap-1',
          displayName: 'Test',
          ownerType: 'ministry-owned' as const,
          kind: 'skill' as const,
          trustLevel: 'high' as const,
          trustTrend: 'up' as const,
          reportCount: 5,
          promoteCount: 3,
          holdCount: 1,
          downgradeCount: 1,
          passCount: 4,
          reviseRequiredCount: 0,
          blockCount: 1,
          recentOutcomes: [],
          updatedAt: '2026-04-16T00:00:00.000Z'
        }
      ];
      const result = aggregateCapabilityGovernanceProfiles([], persisted);
      expect(result).toHaveLength(1);
      expect(result[0].capabilityId).toBe('cap-1');
    });

    it('merges task attachment governance profile', () => {
      const tasks = [
        {
          capabilityAttachments: [
            {
              id: 'cap-1',
              displayName: 'Skill 1',
              owner: { ownerType: 'ministry-owned' as const },
              kind: 'skill' as const,
              capabilityTrust: { trustLevel: 'high' as const, trustTrend: 'up' as const },
              governanceProfile: {
                reportCount: 3,
                promoteCount: 2,
                holdCount: 1,
                downgradeCount: 0,
                passCount: 3,
                reviseRequiredCount: 0,
                blockCount: 0,
                lastTaskId: 'task-1',
                lastReviewDecision: 'pass' as const,
                lastTrustAdjustment: 'promote' as const,
                recentOutcomes: [],
                updatedAt: '2026-04-16T00:00:00.000Z'
              }
            }
          ]
        }
      ];
      const result = aggregateCapabilityGovernanceProfiles(tasks as any, []);
      expect(result).toHaveLength(1);
      expect(result[0].capabilityId).toBe('cap-1');
      expect(result[0].trustLevel).toBe('high');
    });

    it('skips attachments without governance profile', () => {
      const tasks = [
        {
          capabilityAttachments: [
            {
              id: 'cap-1',
              displayName: 'Skill 1',
              owner: { ownerType: 'ministry-owned' as const },
              kind: 'skill' as const
            }
          ]
        }
      ];
      const result = aggregateCapabilityGovernanceProfiles(tasks as any, []);
      expect(result).toHaveLength(0);
    });

    it('sorts by updatedAt descending', () => {
      const persisted = [
        {
          capabilityId: 'cap-1',
          displayName: 'A',
          ownerType: 'ministry-owned' as const,
          kind: 'skill' as const,
          trustLevel: 'medium' as const,
          trustTrend: 'steady' as const,
          reportCount: 1,
          promoteCount: 0,
          holdCount: 1,
          downgradeCount: 0,
          passCount: 1,
          reviseRequiredCount: 0,
          blockCount: 0,
          recentOutcomes: [],
          updatedAt: '2026-04-15T00:00:00.000Z'
        },
        {
          capabilityId: 'cap-2',
          displayName: 'B',
          ownerType: 'ministry-owned' as const,
          kind: 'skill' as const,
          trustLevel: 'high' as const,
          trustTrend: 'up' as const,
          reportCount: 1,
          promoteCount: 1,
          holdCount: 0,
          downgradeCount: 0,
          passCount: 1,
          reviseRequiredCount: 0,
          blockCount: 0,
          recentOutcomes: [],
          updatedAt: '2026-04-16T00:00:00.000Z'
        }
      ];
      const result = aggregateCapabilityGovernanceProfiles([], persisted);
      expect(result[0].capabilityId).toBe('cap-2');
      expect(result[1].capabilityId).toBe('cap-1');
    });
  });

  describe('aggregateNamedGovernanceProfiles', () => {
    it('returns empty array when no tasks and no persisted', () => {
      const result = aggregateNamedGovernanceProfiles([], 'ministry', []);
      expect(result).toEqual([]);
    });

    it('skips tasks without governance report', () => {
      const tasks = [{ id: 'task-1', currentMinistry: 'hubu-search' }];
      const result = aggregateNamedGovernanceProfiles(tasks as any, 'ministry', []);
      expect(result).toEqual([]);
    });

    it('skips tasks without review decision', () => {
      const tasks = [
        {
          id: 'task-1',
          currentMinistry: 'hubu-search',
          governanceReport: {
            reviewOutcome: {},
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        }
      ];
      const result = aggregateNamedGovernanceProfiles(tasks as any, 'ministry', []);
      expect(result).toEqual([]);
    });

    it('skips tasks without entity id', () => {
      const tasks = [
        {
          id: 'task-1',
          governanceReport: {
            reviewOutcome: { decision: 'pass' },
            trustAdjustment: 'promote',
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        }
      ];
      const result = aggregateNamedGovernanceProfiles(tasks as any, 'ministry', []);
      expect(result).toEqual([]);
    });

    it('creates ministry profile from task', () => {
      const tasks = [
        {
          id: 'task-1',
          currentMinistry: 'hubu-search',
          governanceReport: {
            reviewOutcome: { decision: 'pass', summary: 'passed' },
            trustAdjustment: 'promote',
            summary: 'good',
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        }
      ];
      const result = aggregateNamedGovernanceProfiles(tasks as any, 'ministry', []);
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('hubu-search');
      expect(result[0].entityKind).toBe('ministry');
      expect(result[0].trustLevel).toBe('high');
      expect(result[0].trustTrend).toBe('up');
      expect(result[0].passCount).toBe(1);
    });

    it('creates worker profile from task', () => {
      const tasks = [
        {
          id: 'task-1',
          currentWorker: 'worker-1',
          governanceReport: {
            reviewOutcome: { decision: 'pass' },
            trustAdjustment: 'hold',
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        }
      ];
      const result = aggregateNamedGovernanceProfiles(tasks as any, 'worker', []);
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('worker-1');
      expect(result[0].entityKind).toBe('worker');
    });

    it('creates specialist profile from task', () => {
      const tasks = [
        {
          id: 'task-1',
          specialistLead: { domain: 'risk-compliance', displayName: 'Risk' },
          governanceReport: {
            reviewOutcome: { decision: 'block' },
            trustAdjustment: 'downgrade',
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        }
      ];
      const result = aggregateNamedGovernanceProfiles(tasks as any, 'specialist', []);
      expect(result).toHaveLength(1);
      expect(result[0].entityId).toBe('risk-compliance');
      expect(result[0].entityKind).toBe('specialist');
      expect(result[0].trustLevel).toBe('low');
      expect(result[0].blockCount).toBe(1);
    });

    it('converts blocked decision to block', () => {
      const tasks = [
        {
          id: 'task-1',
          currentMinistry: 'hubu-search',
          governanceReport: {
            reviewOutcome: { decision: 'blocked' },
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        }
      ];
      const result = aggregateNamedGovernanceProfiles(tasks as any, 'ministry', []);
      expect(result[0].lastReviewDecision).toBe('block');
    });

    it('converts approved decision to pass', () => {
      const tasks = [
        {
          id: 'task-1',
          currentMinistry: 'hubu-search',
          governanceReport: {
            reviewOutcome: { decision: 'approved' },
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        }
      ];
      const result = aggregateNamedGovernanceProfiles(tasks as any, 'ministry', []);
      expect(result[0].lastReviewDecision).toBe('pass');
    });

    it('increments counts correctly on second task', () => {
      const tasks = [
        {
          id: 'task-1',
          currentMinistry: 'hubu-search',
          governanceReport: {
            reviewOutcome: { decision: 'pass' },
            trustAdjustment: 'promote',
            updatedAt: '2026-04-16T00:00:00.000Z'
          }
        },
        {
          id: 'task-2',
          currentMinistry: 'hubu-search',
          governanceReport: {
            reviewOutcome: { decision: 'revise_required' },
            trustAdjustment: 'hold',
            updatedAt: '2026-04-17T00:00:00.000Z'
          }
        }
      ];
      const result = aggregateNamedGovernanceProfiles(tasks as any, 'ministry', []);
      expect(result).toHaveLength(1);
      expect(result[0].reportCount).toBe(2);
      expect(result[0].promoteCount).toBe(1);
      expect(result[0].reviseRequiredCount).toBe(1);
    });
  });
});
