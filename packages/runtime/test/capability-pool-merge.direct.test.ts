import { describe, expect, it } from 'vitest';

import {
  mergeCapabilityStateFromSkillSearch,
  syncCheckpointCapabilityState
} from '../src/capabilities/capability-pool-merge';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    sessionId: 'session-1',
    capabilityAttachments: [],
    capabilityAugmentations: [],
    usedInstalledSkills: [],
    specialistLead: undefined,
    ...overrides
  } as any;
}

describe('capability-pool-merge (direct)', () => {
  describe('mergeCapabilityStateFromSkillSearch', () => {
    it('returns empty attachments and augmentations when no skill search', () => {
      const task = makeTask();
      const result = mergeCapabilityStateFromSkillSearch(task, '2026-01-01T00:00:00Z');
      expect(result.capabilityAttachments).toEqual([]);
      expect(result.capabilityAugmentations).toEqual([]);
    });

    it('creates attachments from usedInstalledSkills', () => {
      const task = makeTask({ usedInstalledSkills: ['skill-a', 'skill-b'] });
      const result = mergeCapabilityStateFromSkillSearch(task, '2026-01-01T00:00:00Z');
      expect(result.capabilityAttachments).toHaveLength(2);
      expect(result.capabilityAttachments[0].displayName).toBe('skill-a');
    });

    it('creates augmentation when skillSearch has capabilityGapDetected', () => {
      const task = makeTask();
      const skillSearch = {
        capabilityGapDetected: true,
        query: 'test-query',
        status: 'searching',
        safetyNotes: ['Test note'],
        suggestions: [],
        mcpRecommendation: undefined,
        triggerReason: 'capability_gap_detected'
      };
      const result = mergeCapabilityStateFromSkillSearch(task, '2026-01-01T00:00:00Z', skillSearch as any);
      expect(result.capabilityAugmentations).toHaveLength(1);
      expect(result.capabilityAugmentations[0].summary).toBe('test-query');
    });

    it('creates attachment from skillSearch suggestions', () => {
      const task = makeTask();
      const skillSearch = {
        capabilityGapDetected: false,
        query: 'test',
        status: 'searching',
        safetyNotes: [],
        suggestions: [
          {
            id: 'sug-1',
            displayName: 'Test Skill',
            kind: 'skill',
            availability: 'ready',
            sourceId: 'source-1'
          }
        ],
        mcpRecommendation: undefined
      };
      const result = mergeCapabilityStateFromSkillSearch(task, '2026-01-01T00:00:00Z', skillSearch as any);
      expect(result.capabilityAttachments.length).toBeGreaterThan(0);
    });

    it('creates connector attachment when mcpRecommendation has connectorTemplateId', () => {
      const task = makeTask();
      const skillSearch = {
        capabilityGapDetected: false,
        query: 'test',
        status: 'searching',
        safetyNotes: [],
        suggestions: [],
        mcpRecommendation: { connectorTemplateId: 'github-mcp-template' }
      };
      const result = mergeCapabilityStateFromSkillSearch(task, '2026-01-01T00:00:00Z', skillSearch as any);
      const connector = result.capabilityAttachments.find((a: any) => a.kind === 'connector');
      expect(connector).toBeDefined();
      expect(connector!.displayName).toBe('GitHub MCP');
    });

    it('deduplicates attachments by id', () => {
      const task = makeTask({
        capabilityAttachments: [
          { id: 'existing', displayName: 'Existing', kind: 'skill', owner: { ownerType: 'shared' }, enabled: true }
        ]
      });
      const skillSearch = {
        capabilityGapDetected: false,
        query: 'test',
        status: 'searching',
        safetyNotes: [],
        suggestions: [
          { id: 'existing', displayName: 'Existing', kind: 'skill', availability: 'ready', sourceId: 'existing' }
        ],
        mcpRecommendation: undefined
      };
      const result = mergeCapabilityStateFromSkillSearch(task, '2026-01-01T00:00:00Z', skillSearch as any);
      const existing = result.capabilityAttachments.filter((a: any) => a.id === 'existing');
      expect(existing).toHaveLength(1);
    });

    it('handles blocked skillSearch status', () => {
      const task = makeTask();
      const skillSearch = {
        capabilityGapDetected: true,
        query: 'blocked-query',
        status: 'blocked',
        safetyNotes: ['blocked note'],
        suggestions: [],
        mcpRecommendation: undefined
      };
      const result = mergeCapabilityStateFromSkillSearch(task, '2026-01-01T00:00:00Z', skillSearch as any);
      expect(result.capabilityAugmentations[0].status).toBe('blocked');
    });

    it('handles auto-installed skillSearch status', () => {
      const task = makeTask();
      const skillSearch = {
        capabilityGapDetected: true,
        query: 'auto-query',
        status: 'auto-installed',
        safetyNotes: [],
        suggestions: [],
        mcpRecommendation: undefined
      };
      const result = mergeCapabilityStateFromSkillSearch(task, '2026-01-01T00:00:00Z', skillSearch as any);
      expect(result.capabilityAugmentations[0].status).toBe('ready');
    });
  });

  describe('syncCheckpointCapabilityState', () => {
    it('copies attachments and augmentations to checkpoint', () => {
      const checkpoint = {} as any;
      const task = {
        capabilityAttachments: [{ id: 'a1' }],
        capabilityAugmentations: [{ id: 'aug-1' }]
      } as any;
      syncCheckpointCapabilityState(checkpoint, task);
      expect(checkpoint.capabilityAttachments).toEqual([{ id: 'a1' }]);
      expect(checkpoint.capabilityAugmentations).toEqual([{ id: 'aug-1' }]);
    });
  });
});
