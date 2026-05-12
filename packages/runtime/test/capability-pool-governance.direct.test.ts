import { describe, expect, it } from 'vitest';

import {
  buildWorkerSelectionPreferences,
  buildMinistryStagePreferences,
  isCapabilityPoolMinistryOwnedAttachment
} from '../src/capabilities/capability-pool-governance';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    capabilityAttachments: [],
    capabilityAugmentations: [],
    specialistLead: undefined,
    requestedHints: undefined,
    usedInstalledSkills: [],
    skillSearch: undefined,
    pendingApproval: undefined,
    resolvedWorkflow: undefined,
    ...overrides
  } as any;
}

describe('capability-pool-governance (direct)', () => {
  describe('buildWorkerSelectionPreferences', () => {
    it('returns empty preferences when no attachments', () => {
      const prefs = buildWorkerSelectionPreferences(makeTask());
      expect(prefs.preferredConnectorTags).toEqual([]);
      expect(prefs.preferredTags).toEqual([]);
      expect(prefs.preferredWorkerIds).toEqual([]);
      expect(prefs.avoidedTags).toEqual([]);
      expect(prefs.avoidedWorkerIds).toEqual([]);
    });

    it('adds connector tags for connector attachments', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'github-mcp',
            displayName: 'GitHub MCP',
            kind: 'connector',
            owner: { ownerType: 'runtime-derived' },
            capabilityTrust: { trustLevel: 'high' }
          }
        ]
      });
      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredConnectorTags.length).toBeGreaterThan(0);
    });

    it('adds preferred tags for specialist-owned attachments', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'specialist-1',
            displayName: 'Specialist',
            kind: 'skill',
            owner: { ownerType: 'specialist-owned', ownerId: 'technical-architecture' },
            capabilityTrust: { trustLevel: 'high' }
          }
        ]
      });
      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredTags).toContain('architecture');
    });

    it('adds avoided tags for low trust specialist-owned attachments', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'specialist-1',
            displayName: 'Specialist',
            kind: 'skill',
            owner: { ownerType: 'specialist-owned', ownerId: 'risk-compliance' },
            capabilityTrust: { trustLevel: 'low' }
          }
        ]
      });
      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.avoidedTags).toContain('review');
    });

    it('adds user-requested tag for user-attached attachments', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'skill-1',
            displayName: 'Skill',
            kind: 'skill',
            owner: { ownerType: 'user-attached' },
            capabilityTrust: { trustLevel: 'medium' }
          }
        ]
      });
      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredTags).toContain('user-requested');
    });

    it('adds preferred worker ids for installed-skill attachments with high trust', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'installed-skill:my-skill',
            displayName: 'My Skill',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            capabilityTrust: { trustLevel: 'high' }
          }
        ]
      });
      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredWorkerIds).toContain('installed-skill:my-skill');
    });

    it('adds avoided worker ids for installed-skill attachments with low trust', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'installed-skill:bad-skill',
            displayName: 'Bad Skill',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            capabilityTrust: { trustLevel: 'low' }
          }
        ]
      });
      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.avoidedWorkerIds).toContain('installed-skill:bad-skill');
    });

    it('adds ministry tags for ministry-owned attachments with high trust', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'ministry-1',
            displayName: 'Ministry',
            kind: 'skill',
            owner: { ownerType: 'ministry-owned', ownerId: 'hubu-search' },
            capabilityTrust: { trustLevel: 'high' }
          }
        ]
      });
      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredTags).toContain('research');
    });

    it('adds avoided tags for ministry-owned attachments with low trust', () => {
      const task = makeTask({
        capabilityAttachments: [
          {
            id: 'ministry-1',
            displayName: 'Ministry',
            kind: 'skill',
            owner: { ownerType: 'ministry-owned', ownerId: 'hubu-search' },
            capabilityTrust: { trustLevel: 'low' }
          }
        ]
      });
      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.avoidedTags).toContain('research');
    });

    it('adds used installed skills to preferred worker ids', () => {
      const task = makeTask({ usedInstalledSkills: ['skill-a', 'skill-b'] });
      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredWorkerIds).toContain('skill-a');
      expect(prefs.preferredWorkerIds).toContain('skill-b');
    });
  });

  describe('buildMinistryStagePreferences', () => {
    it('returns default ministries when no attachments or workflow', () => {
      const prefs = buildMinistryStagePreferences(makeTask());
      expect(prefs.research).toBeDefined();
      expect(prefs.execution).toBeDefined();
      expect(prefs.review).toBeDefined();
    });

    it('sets isRiskHeavy when specialist is risk-compliance', () => {
      const task = makeTask({
        specialistLead: { domain: 'risk-compliance' }
      });
      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.isRiskHeavy).toBe(true);
    });

    it('sets isRiskHeavy when pendingApproval has high risk', () => {
      const task = makeTask({
        pendingApproval: { riskLevel: 'high' }
      });
      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.isRiskHeavy).toBe(true);
    });

    it('returns hubu-search research when workflow supports it and has capability gap', () => {
      const task = makeTask({
        resolvedWorkflow: { requiredMinistries: ['hubu-search', 'gongbu-code', 'xingbu-review'] },
        skillSearch: { capabilityGapDetected: true }
      });
      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.research).toBe('hubu-search');
    });

    it('returns xingbu-review when workflow supports it', () => {
      const task = makeTask({
        resolvedWorkflow: { requiredMinistries: ['xingbu-review'] }
      });
      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.review).toBe('xingbu-review');
    });

    it('falls back to libu-delivery when workflow does not support review ministry', () => {
      const task = makeTask({
        resolvedWorkflow: { requiredMinistries: [] }
      });
      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.review).toBe('libu-delivery');
    });
  });

  describe('isCapabilityPoolMinistryOwnedAttachment', () => {
    it('returns true when attachment matches ministry', () => {
      const attachments = [{ owner: { ownerType: 'ministry-owned', ownerId: 'hubu-search' } }] as any;
      expect(isCapabilityPoolMinistryOwnedAttachment(attachments, 'hubu-search')).toBe(true);
    });

    it('returns false when no attachment matches', () => {
      const attachments = [{ owner: { ownerType: 'ministry-owned', ownerId: 'gongbu-code' } }] as any;
      expect(isCapabilityPoolMinistryOwnedAttachment(attachments, 'hubu-search')).toBe(false);
    });

    it('returns false for undefined attachments', () => {
      expect(isCapabilityPoolMinistryOwnedAttachment(undefined, 'hubu-search')).toBe(false);
    });

    it('normalizes alias ministry ids', () => {
      const attachments = [{ owner: { ownerType: 'ministry-owned', ownerId: 'libu-governance' } }] as any;
      expect(isCapabilityPoolMinistryOwnedAttachment(attachments, 'libu-router')).toBe(true);
    });
  });
});
