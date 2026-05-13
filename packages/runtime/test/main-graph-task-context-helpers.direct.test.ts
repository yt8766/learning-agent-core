import { describe, expect, it } from 'vitest';

import {
  createEmptyUsageRecord,
  estimateModelCostUsd,
  roundUsageCost,
  resolveCompiledSkillAttachment,
  resolveExecutionMode
} from '../src/graphs/main/tasking/context/main-graph-task-context-helpers';

describe('main-graph-task-context-helpers (direct)', () => {
  describe('createEmptyUsageRecord', () => {
    it('returns record with zero tokens', () => {
      const record = createEmptyUsageRecord('2026-05-10T00:00:00Z');
      expect(record.promptTokens).toBe(0);
      expect(record.completionTokens).toBe(0);
      expect(record.totalTokens).toBe(0);
    });

    it('sets estimated to false', () => {
      const record = createEmptyUsageRecord('2026-05-10T00:00:00Z');
      expect(record.estimated).toBe(false);
    });

    it('sets call counts to zero', () => {
      const record = createEmptyUsageRecord('2026-05-10T00:00:00Z');
      expect(record.measuredCallCount).toBe(0);
      expect(record.estimatedCallCount).toBe(0);
    });

    it('sets empty models array', () => {
      const record = createEmptyUsageRecord('2026-05-10T00:00:00Z');
      expect(record.models).toEqual([]);
    });

    it('sets updatedAt to provided value', () => {
      const record = createEmptyUsageRecord('2026-12-25T12:00:00Z');
      expect(record.updatedAt).toBe('2026-12-25T12:00:00Z');
    });
  });

  describe('estimateModelCostUsd', () => {
    it('uses glm-5 rate', () => {
      const cost = estimateModelCostUsd('glm-5-chat', 1000);
      expect(cost).toBeCloseTo(0.002, 6);
    });

    it('uses glm-4.7-flash rate', () => {
      const cost = estimateModelCostUsd('glm-4.7-flash', 1000);
      expect(cost).toBeCloseTo(0.0005, 6);
    });

    it('uses glm-4.7 rate', () => {
      const cost = estimateModelCostUsd('glm-4.7', 1000);
      expect(cost).toBeCloseTo(0.001, 6);
    });

    it('uses glm-4.6 rate', () => {
      const cost = estimateModelCostUsd('glm-4.6', 1000);
      expect(cost).toBeCloseTo(0.0012, 6);
    });

    it('uses default rate for unknown model', () => {
      const cost = estimateModelCostUsd('gpt-4', 1000);
      expect(cost).toBeCloseTo(0.001, 6);
    });

    it('is case-insensitive', () => {
      const cost = estimateModelCostUsd('GLM-5-CHAT', 1000);
      expect(cost).toBeCloseTo(0.002, 6);
    });

    it('scales with token count', () => {
      const cost = estimateModelCostUsd('glm-5-chat', 5000);
      expect(cost).toBeCloseTo(0.01, 6);
    });

    it('handles zero tokens', () => {
      const cost = estimateModelCostUsd('glm-5-chat', 0);
      expect(cost).toBe(0);
    });

    it('clamps negative tokens to zero', () => {
      const cost = estimateModelCostUsd('glm-5-chat', -100);
      expect(cost).toBe(0);
    });

    it('prefers glm-4.7-flash over glm-4.7', () => {
      const cost = estimateModelCostUsd('glm-4.7-flash', 1000);
      expect(cost).toBeCloseTo(0.0005, 6);
    });
  });

  describe('roundUsageCost', () => {
    it('rounds to 4 decimal places', () => {
      expect(roundUsageCost(0.123456789)).toBe(0.1235);
    });

    it('rounds down', () => {
      expect(roundUsageCost(0.12344)).toBe(0.1234);
    });

    it('handles zero', () => {
      expect(roundUsageCost(0)).toBe(0);
    });

    it('handles integers', () => {
      expect(roundUsageCost(5)).toBe(5);
    });

    it('handles small values', () => {
      expect(roundUsageCost(0.00001)).toBe(0);
    });
  });

  describe('resolveCompiledSkillAttachment', () => {
    function makeAttachment(overrides: Record<string, unknown> = {}) {
      return {
        id: 'skill-1',
        kind: 'skill',
        enabled: true,
        displayName: 'My Skill',
        sourceId: 'source-1',
        metadata: { steps: [{ step: 1 }] },
        owner: { ownerType: 'user-attached' },
        ...overrides
      } as any;
    }

    it('returns undefined when no attachments', () => {
      const task = { capabilityAttachments: [] } as any;
      expect(resolveCompiledSkillAttachment(task)).toBeUndefined();
    });

    it('falls back to user-attached skill when no requestedSkill', () => {
      const task = {
        capabilityAttachments: [makeAttachment()],
        requestedHints: {}
      } as any;
      const result = resolveCompiledSkillAttachment(task);
      expect(result).toBeDefined();
      expect(result.owner.ownerType).toBe('user-attached');
    });

    it('matches by displayName', () => {
      const task = {
        capabilityAttachments: [makeAttachment()],
        requestedHints: { requestedSkill: 'my skill' }
      } as any;
      const result = resolveCompiledSkillAttachment(task);
      expect(result).toBeDefined();
      expect(result.id).toBe('skill-1');
    });

    it('matches by sourceId', () => {
      const task = {
        capabilityAttachments: [makeAttachment()],
        requestedHints: { requestedSkill: 'source-1' }
      } as any;
      const result = resolveCompiledSkillAttachment(task);
      expect(result).toBeDefined();
    });

    it('matches by attachment id', () => {
      const task = {
        capabilityAttachments: [makeAttachment()],
        requestedHints: { requestedSkill: 'skill-1' }
      } as any;
      const result = resolveCompiledSkillAttachment(task);
      expect(result).toBeDefined();
    });

    it('is case-insensitive', () => {
      const task = {
        capabilityAttachments: [makeAttachment()],
        requestedHints: { requestedSkill: 'MY SKILL' }
      } as any;
      const result = resolveCompiledSkillAttachment(task);
      expect(result).toBeDefined();
    });

    it('skips disabled attachments', () => {
      const task = {
        capabilityAttachments: [makeAttachment({ enabled: false })],
        requestedHints: { requestedSkill: 'my skill' }
      } as any;
      expect(resolveCompiledSkillAttachment(task)).toBeUndefined();
    });

    it('skips non-skill attachments', () => {
      const task = {
        capabilityAttachments: [makeAttachment({ kind: 'tool' })],
        requestedHints: { requestedSkill: 'my skill' }
      } as any;
      expect(resolveCompiledSkillAttachment(task)).toBeUndefined();
    });

    it('skips attachments without steps', () => {
      const task = {
        capabilityAttachments: [makeAttachment({ metadata: { steps: [] } })],
        requestedHints: { requestedSkill: 'my skill' }
      } as any;
      expect(resolveCompiledSkillAttachment(task)).toBeUndefined();
    });

    it('falls back to user-attached skill when no requestedSkill match', () => {
      const task = {
        capabilityAttachments: [makeAttachment()],
        requestedHints: { requestedSkill: 'nonexistent' }
      } as any;
      const result = resolveCompiledSkillAttachment(task);
      expect(result).toBeDefined();
      expect(result.owner.ownerType).toBe('user-attached');
    });

    it('does not fall back to non-user-attached skill', () => {
      const task = {
        capabilityAttachments: [makeAttachment({ owner: { ownerType: 'system' } })],
        requestedHints: { requestedSkill: 'nonexistent' }
      } as any;
      expect(resolveCompiledSkillAttachment(task)).toBeUndefined();
    });
  });

  describe('resolveExecutionMode', () => {
    it('returns execute when no task', () => {
      expect(resolveExecutionMode(undefined)).toBe('execute');
    });

    it('returns execute when no task properties', () => {
      expect(resolveExecutionMode({} as any)).toBe('execute');
    });

    it('returns executionPlan.mode when present', () => {
      const task = { executionPlan: { mode: 'plan' } } as any;
      expect(resolveExecutionMode(task)).toBe('plan');
    });

    it('returns executionMode when no executionPlan', () => {
      const task = { executionMode: 'plan' } as any;
      expect(resolveExecutionMode(task)).toBe('plan');
    });

    it('prefers executionPlan.mode over executionMode', () => {
      const task = {
        executionPlan: { mode: 'plan' },
        executionMode: 'execute'
      } as any;
      expect(resolveExecutionMode(task)).toBe('plan');
    });

    it('returns plan when planMode is active', () => {
      const task = { planMode: 'draft' } as any;
      expect(resolveExecutionMode(task)).toBe('plan');
    });

    it('returns execute when planMode is finalized', () => {
      const task = { planMode: 'finalized' } as any;
      expect(resolveExecutionMode(task)).toBe('execute');
    });

    it('returns execute when planMode is aborted', () => {
      const task = { planMode: 'aborted' } as any;
      expect(resolveExecutionMode(task)).toBe('execute');
    });

    it('returns execute when planMode is undefined', () => {
      const task = { planMode: undefined } as any;
      expect(resolveExecutionMode(task)).toBe('execute');
    });
  });
});
