import { describe, expect, it } from 'vitest';

import {
  buildMinistryStagePreferences,
  buildWorkerSelectionPreferences,
  isCapabilityPoolMinistryOwnedAttachment
} from '../src/capabilities/capability-pool-governance';

describe('capability-pool-governance', () => {
  describe('buildWorkerSelectionPreferences', () => {
    it('adds preferred tags for specialist-owned attachments', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'att-1',
            kind: 'skill',
            owner: { ownerType: 'specialist-owned', ownerId: 'technical-architecture' },
            capabilityTrust: { trustLevel: 'medium' }
          }
        ],
        specialistLead: { domain: 'technical-architecture' }
      } as any;

      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredTags).toContain('architecture');
      expect(prefs.preferredTags).toContain('repo');
      expect(prefs.preferredTags).toContain('code');
      expect(prefs.preferredTags).toContain('refactor');
    });

    it('adds avoided tags for low trust specialist-owned attachments', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'att-1',
            kind: 'skill',
            owner: { ownerType: 'specialist-owned', ownerId: 'risk-compliance' },
            capabilityTrust: { trustLevel: 'low' }
          }
        ],
        specialistLead: { domain: 'risk-compliance' }
      } as any;

      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.avoidedTags).toContain('review');
      expect(prefs.avoidedTags).toContain('security');
    });

    it('adds user-requested tag for user-attached attachments', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'att-1',
            kind: 'skill',
            owner: { ownerType: 'user-attached' },
            capabilityTrust: { trustLevel: 'medium' }
          }
        ]
      } as any;

      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredTags).toContain('user-requested');
    });

    it('adds preferred connector tags for connector attachments', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'github-mcp-template',
            kind: 'connector',
            displayName: 'GitHub MCP',
            owner: { ownerType: 'user-attached' }
          }
        ]
      } as any;

      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredConnectorTags).toContain('repo');
    });

    it('adds preferred worker ids for installed-skill attachments with non-low trust', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'installed-skill:my-skill',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            capabilityTrust: { trustLevel: 'high' }
          }
        ]
      } as any;

      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredWorkerIds).toContain('installed-skill:my-skill');
    });

    it('adds avoided worker ids for installed-skill with low trust', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'installed-skill:bad-skill',
            kind: 'skill',
            owner: { ownerType: 'shared' },
            capabilityTrust: { trustLevel: 'low' }
          }
        ]
      } as any;

      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.avoidedWorkerIds).toContain('installed-skill:bad-skill');
    });

    it('adds ministry-owned preferred tags for high trust', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'att-1',
            kind: 'skill',
            owner: { ownerType: 'ministry-owned', ownerId: 'hubu-search' },
            capabilityTrust: { trustLevel: 'high' }
          }
        ]
      } as any;

      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredTags).toContain('research');
      expect(prefs.preferredTags).toContain('knowledge');
    });

    it('adds ministry-owned avoided tags for low trust', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'att-1',
            kind: 'skill',
            owner: { ownerType: 'ministry-owned', ownerId: 'gongbu-code' },
            capabilityTrust: { trustLevel: 'low' }
          }
        ]
      } as any;

      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.avoidedTags).toContain('code');
    });

    it('adds used installed skills to preferred worker ids', () => {
      const task = {
        usedInstalledSkills: ['installed-skill:used-one', 'installed-skill:used-two']
      } as any;

      const prefs = buildWorkerSelectionPreferences(task);
      expect(prefs.preferredWorkerIds).toContain('installed-skill:used-one');
      expect(prefs.preferredWorkerIds).toContain('installed-skill:used-two');
    });

    it('handles empty/undefined attachments', () => {
      const prefs = buildWorkerSelectionPreferences({} as any);
      expect(prefs.preferredConnectorTags).toEqual([]);
      expect(prefs.preferredTags).toEqual([]);
      expect(prefs.preferredWorkerIds).toEqual([]);
      expect(prefs.avoidedTags).toEqual([]);
      expect(prefs.avoidedWorkerIds).toEqual([]);
    });
  });

  describe('buildMinistryStagePreferences', () => {
    it('selects gongbu-code for architecture-heavy tasks', () => {
      const task = {
        capabilityAttachments: [],
        capabilityAugmentations: [],
        specialistLead: { domain: 'technical-architecture' },
        resolvedWorkflow: {
          requiredMinistries: ['gongbu-code', 'xingbu-review']
        }
      } as any;

      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.execution).toBe('gongbu-code');
      expect(prefs.review).toBe('xingbu-review');
    });

    it('selects bingbu-ops for connector-heavy tasks', () => {
      const task = {
        capabilityAttachments: [
          {
            kind: 'connector',
            id: 'browser-mcp',
            displayName: 'Browser MCP',
            enabled: true,
            owner: { ownerType: 'user-attached' }
          }
        ],
        capabilityAugmentations: [],
        resolvedWorkflow: {
          requiredMinistries: ['gongbu-code', 'bingbu-ops', 'xingbu-review']
        }
      } as any;

      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.execution).toBe('bingbu-ops');
    });

    it('selects research ministry from workflow when connector affinity present', () => {
      const task = {
        capabilityAttachments: [
          {
            kind: 'connector',
            id: 'github-mcp',
            displayName: 'GitHub MCP',
            enabled: true,
            owner: { ownerType: 'user-attached' }
          }
        ],
        capabilityAugmentations: [],
        specialistLead: { domain: 'general-assistant' },
        resolvedWorkflow: {
          requiredMinistries: ['hubu-search', 'gongbu-code', 'xingbu-review']
        }
      } as any;

      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.research).toBe('hubu-search');
    });

    it('falls back to libu-delivery for research when no workflow research support', () => {
      const task = {
        capabilityAttachments: [],
        capabilityAugmentations: [],
        resolvedWorkflow: {
          requiredMinistries: ['gongbu-code']
        }
      } as any;

      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.research).toBe('libu-delivery');
    });

    it('detects isRiskHeavy for risk-compliance specialist', () => {
      const task = {
        capabilityAttachments: [],
        capabilityAugmentations: [],
        specialistLead: { domain: 'risk-compliance' },
        resolvedWorkflow: { requiredMinistries: [] }
      } as any;

      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.isRiskHeavy).toBe(true);
    });

    it('defaults to libu-delivery when no workflow supports execution ministry', () => {
      const task = {
        capabilityAttachments: [],
        capabilityAugmentations: [],
        resolvedWorkflow: { requiredMinistries: [] }
      } as any;

      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.execution).toBe('libu-delivery');
    });

    it('handles connector augmentations', () => {
      const task = {
        capabilityAttachments: [],
        capabilityAugmentations: [{ id: 'aug-1', target: 'lark-mcp-template' }],
        resolvedWorkflow: {
          requiredMinistries: ['gongbu-code', 'bingbu-ops', 'xingbu-review']
        }
      } as any;

      const prefs = buildMinistryStagePreferences(task);
      expect(prefs.execution).toBe('bingbu-ops');
    });
  });

  describe('isCapabilityPoolMinistryOwnedAttachment', () => {
    it('returns true when attachment is ministry-owned with matching id', () => {
      const attachments = [{ owner: { ownerType: 'ministry-owned', ownerId: 'gongbu-code' } }] as any;
      expect(isCapabilityPoolMinistryOwnedAttachment(attachments, 'gongbu-code')).toBe(true);
    });

    it('returns true when matching via alias normalization', () => {
      const attachments = [{ owner: { ownerType: 'ministry-owned', ownerId: 'libu-delivery' } }] as any;
      expect(isCapabilityPoolMinistryOwnedAttachment(attachments, 'libu-docs')).toBe(true);
    });

    it('returns false when no matching ministry-owned attachment', () => {
      const attachments = [{ owner: { ownerType: 'specialist-owned', ownerId: 'risk-compliance' } }] as any;
      expect(isCapabilityPoolMinistryOwnedAttachment(attachments, 'gongbu-code')).toBe(false);
    });

    it('returns false for undefined attachments', () => {
      expect(isCapabilityPoolMinistryOwnedAttachment(undefined, 'gongbu-code')).toBe(false);
    });
  });
});
