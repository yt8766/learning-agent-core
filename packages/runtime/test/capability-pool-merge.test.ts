import { describe, expect, it } from 'vitest';

import {
  mergeCapabilityStateFromSkillSearch,
  syncCheckpointCapabilityState
} from '../src/capabilities/capability-pool-merge';

describe('capability-pool-merge', () => {
  describe('mergeCapabilityStateFromSkillSearch', () => {
    it('converts usedInstalledSkills to attachments', () => {
      const task = {
        usedInstalledSkills: ['installed-skill:my-tool'],
        sessionId: 'sess-1',
        specialistLead: { domain: 'technical-architecture' }
      } as any;

      const result = mergeCapabilityStateFromSkillSearch(task, '2026-04-16T00:00:00.000Z');

      const skillAttachment = result.capabilityAttachments.find((a: any) => a.id === 'installed-skill:my-tool');
      expect(skillAttachment).toBeDefined();
      expect(skillAttachment!.displayName).toBe('my-tool');
      expect(skillAttachment!.kind).toBe('skill');
      expect(skillAttachment!.enabled).toBe(true);
    });

    it('returns deduplicated attachments and augmentations when no skillSearch', () => {
      const task = {
        capabilityAttachments: [{ id: 'att-1', displayName: 'Att 1' }],
        capabilityAugmentations: [{ id: 'aug-1' }]
      } as any;

      const result = mergeCapabilityStateFromSkillSearch(task, '2026-04-16T00:00:00.000Z');

      expect(result.capabilityAttachments).toHaveLength(1);
      expect(result.capabilityAugmentations).toHaveLength(1);
    });

    it('adds augmentation when skillSearch detects capability gap', () => {
      const task = {
        sessionId: 'sess-1',
        skillSearch: {
          capabilityGapDetected: true,
          query: 'test-query',
          status: 'suggested',
          triggerReason: 'capability_gap_detected',
          safetyNotes: ['safety note 1'],
          suggestions: [],
          mcpRecommendation: null
        }
      } as any;

      const result = mergeCapabilityStateFromSkillSearch(task, '2026-04-16T00:00:00.000Z', task.skillSearch);

      const augmentation = result.capabilityAugmentations.find((a: any) => a.id.includes('skill-search'));
      expect(augmentation).toBeDefined();
      expect(augmentation!.kind).toBe('skill');
      expect(augmentation!.status).toBe('suggested');
      expect(augmentation!.reason).toBe('safety note 1');
    });

    it('adds connector augmentation when mcpRecommendation has connectorTemplateId', () => {
      const task = {
        sessionId: 'sess-1'
      } as any;
      const skillSearch = {
        capabilityGapDetected: false,
        status: 'suggested',
        triggerReason: 'capability_gap_detected',
        safetyNotes: [],
        suggestions: [],
        mcpRecommendation: {
          connectorTemplateId: 'github-mcp-template'
        }
      };

      const result = mergeCapabilityStateFromSkillSearch(task, '2026-04-16T00:00:00.000Z', skillSearch as any);

      const connector = result.capabilityAttachments.find((a: any) => a.id.includes('github-mcp-template'));
      expect(connector).toBeDefined();
      expect(connector!.kind).toBe('connector');
      expect(connector!.enabled).toBe(false);
    });

    it('handles blocked status in augmentation', () => {
      const task = { sessionId: 'sess-1' } as any;
      const skillSearch = {
        capabilityGapDetected: true,
        query: 'test',
        status: 'blocked',
        triggerReason: 'user_requested',
        safetyNotes: ['blocked reason'],
        suggestions: [],
        mcpRecommendation: null
      };

      const result = mergeCapabilityStateFromSkillSearch(task, '2026-04-16T00:00:00.000Z', skillSearch as any);

      const augmentation = result.capabilityAugmentations.find((a: any) => a.id.includes('skill-search'));
      expect(augmentation!.status).toBe('blocked');
      expect(augmentation!.requestedBy).toBe('user');
    });

    it('handles auto-installed status in augmentation', () => {
      const task = { sessionId: 'sess-1' } as any;
      const skillSearch = {
        capabilityGapDetected: true,
        query: 'test',
        status: 'auto-installed',
        triggerReason: 'capability_gap_detected',
        safetyNotes: [],
        suggestions: [],
        mcpRecommendation: null
      };

      const result = mergeCapabilityStateFromSkillSearch(task, '2026-04-16T00:00:00.000Z', skillSearch as any);

      const augmentation = result.capabilityAugmentations.find((a: any) => a.id.includes('skill-search'));
      expect(augmentation!.status).toBe('ready');
    });

    it('converts suggestions to attachments', () => {
      const task = { sessionId: 'sess-1' } as any;
      const skillSearch = {
        capabilityGapDetected: false,
        status: 'suggested',
        triggerReason: 'capability_gap_detected',
        safetyNotes: [],
        suggestions: [
          {
            id: 'sug-1',
            displayName: 'Suggested Skill',
            kind: 'skill',
            availability: 'ready'
          }
        ],
        mcpRecommendation: null
      };

      const result = mergeCapabilityStateFromSkillSearch(task, '2026-04-16T00:00:00.000Z', skillSearch as any);

      const suggestion = result.capabilityAttachments.find((a: any) => a.id.includes('sug-1'));
      expect(suggestion).toBeDefined();
      expect(suggestion!.enabled).toBe(true);
    });

    it('defaults safety note to generic message when empty', () => {
      const task = { sessionId: 'sess-1' } as any;
      const skillSearch = {
        capabilityGapDetected: true,
        query: 'test',
        status: 'suggested',
        triggerReason: 'capability_gap_detected',
        safetyNotes: [],
        suggestions: [],
        mcpRecommendation: null
      };

      const result = mergeCapabilityStateFromSkillSearch(task, '2026-04-16T00:00:00.000Z', skillSearch as any);

      const augmentation = result.capabilityAugmentations.find((a: any) => a.id.includes('skill-search'));
      expect(augmentation!.reason).toContain('能力缺口');
    });
  });

  describe('syncCheckpointCapabilityState', () => {
    it('copies capability state from task to checkpoint', () => {
      const checkpoint: any = {};
      const task = {
        capabilityAttachments: [{ id: 'att-1' }],
        capabilityAugmentations: [{ id: 'aug-1' }]
      } as any;

      syncCheckpointCapabilityState(checkpoint, task);

      expect(checkpoint.capabilityAttachments).toEqual([{ id: 'att-1' }]);
      expect(checkpoint.capabilityAugmentations).toEqual([{ id: 'aug-1' }]);
    });
  });
});
