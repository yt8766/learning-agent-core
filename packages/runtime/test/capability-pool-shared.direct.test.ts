import { describe, expect, it } from 'vitest';

import {
  toCapabilityTrigger,
  toAttachmentFromSuggestion,
  normalizeConnectorTag,
  specialistTags,
  ministryTags,
  hasCapabilityAffinity,
  getAttachmentTrust,
  isDegradedTrust,
  dedupeAttachments,
  dedupeAugmentations,
  resolveMinistryDisplay,
  resolveSpecialistDisplay,
  MINISTRY_LABELS,
  SPECIALIST_LABELS,
  CONNECTOR_TEMPLATE_TO_DISPLAY
} from '../src/capabilities/capability-pool.shared';

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'suggestion-1',
    displayName: 'Test Suggestion',
    kind: 'skill',
    availability: 'ready',
    sourceId: 'source-1',
    ...overrides
  } as any;
}

describe('capability-pool.shared (direct)', () => {
  describe('MINISTRY_LABELS', () => {
    it('has labels for all ministries', () => {
      expect(MINISTRY_LABELS['hubu-search']).toBe('户部能力池');
      expect(MINISTRY_LABELS['gongbu-code']).toBe('工部能力池');
      expect(MINISTRY_LABELS['bingbu-ops']).toBe('兵部能力池');
      expect(MINISTRY_LABELS['xingbu-review']).toBe('刑部能力池');
      expect(MINISTRY_LABELS['libu-delivery']).toBe('礼部能力池');
      expect(MINISTRY_LABELS['libu-governance']).toBe('吏部能力池');
    });
  });

  describe('SPECIALIST_LABELS', () => {
    it('has labels for known specialists', () => {
      expect(SPECIALIST_LABELS['general-assistant']).toBe('通用助理能力池');
      expect(SPECIALIST_LABELS['risk-compliance']).toBe('风控合规能力池');
    });
  });

  describe('CONNECTOR_TEMPLATE_TO_DISPLAY', () => {
    it('maps connector templates to display names', () => {
      expect(CONNECTOR_TEMPLATE_TO_DISPLAY['github-mcp-template']).toBe('GitHub MCP');
      expect(CONNECTOR_TEMPLATE_TO_DISPLAY['browser-mcp-template']).toBe('Browser MCP');
      expect(CONNECTOR_TEMPLATE_TO_DISPLAY['lark-mcp-template']).toBe('Lark MCP');
    });
  });

  describe('toCapabilityTrigger', () => {
    it('returns user_requested for user_requested', () => {
      expect(toCapabilityTrigger('user_requested')).toBe('user_requested');
    });

    it('returns specialist_requested for domain_specialization_needed', () => {
      expect(toCapabilityTrigger('domain_specialization_needed')).toBe('specialist_requested');
    });

    it('returns capability_gap_detected as default', () => {
      expect(toCapabilityTrigger()).toBe('capability_gap_detected');
      expect(toCapabilityTrigger('capability_gap_detected')).toBe('capability_gap_detected');
    });
  });

  describe('toAttachmentFromSuggestion', () => {
    it('creates attachment from skill suggestion', () => {
      const suggestion = makeSuggestion();
      const attachment = toAttachmentFromSuggestion(suggestion, '2026-01-01T00:00:00Z');
      expect(attachment.id).toBe('suggestion:skill:suggestion-1');
      expect(attachment.displayName).toBe('Test Suggestion');
      expect(attachment.kind).toBe('skill');
      expect(attachment.enabled).toBe(true);
      expect(attachment.sourceId).toBe('source-1');
    });

    it('creates connector attachment from connector-template suggestion', () => {
      const suggestion = makeSuggestion({ kind: 'connector-template' });
      const attachment = toAttachmentFromSuggestion(suggestion, '2026-01-01T00:00:00Z');
      expect(attachment.kind).toBe('connector');
    });

    it('sets enabled to false when availability is not ready', () => {
      const suggestion = makeSuggestion({ availability: 'pending' });
      const attachment = toAttachmentFromSuggestion(suggestion, '2026-01-01T00:00:00Z');
      expect(attachment.enabled).toBe(false);
    });

    it('uses owner from suggestion when available', () => {
      const suggestion = makeSuggestion({
        ownership: {
          ownerType: 'user-attached',
          tier: 'user-preference',
          ownerId: 'user-1',
          capabilityType: 'skill',
          scope: 'user',
          trigger: 'user_requested'
        }
      });
      const attachment = toAttachmentFromSuggestion(suggestion, '2026-01-01T00:00:00Z');
      expect(attachment.owner.ownerType).toBe('user-attached');
    });

    it('infers runtime-derived ownership for skill without explicit ownership', () => {
      const suggestion = makeSuggestion({ kind: 'skill', ownership: undefined });
      const attachment = toAttachmentFromSuggestion(suggestion, '2026-01-01T00:00:00Z', 'owner-1');
      expect(attachment.owner.ownerType).toBe('runtime-derived');
      expect(attachment.owner.ownerId).toBe('owner-1');
    });

    it('infers shared ownership for installed kind', () => {
      const suggestion = makeSuggestion({ kind: 'installed', ownership: undefined });
      const attachment = toAttachmentFromSuggestion(suggestion, '2026-01-01T00:00:00Z');
      expect(attachment.owner.ownerType).toBe('shared');
      expect(attachment.owner.scope).toBe('workspace');
    });
  });

  describe('normalizeConnectorTag', () => {
    it('returns repo for github', () => {
      expect(normalizeConnectorTag('github-mcp')).toBe('repo');
    });

    it('returns browser for browser', () => {
      expect(normalizeConnectorTag('browser-mcp')).toBe('browser');
    });

    it('returns feishu for lark', () => {
      expect(normalizeConnectorTag('lark-mcp')).toBe('feishu');
    });

    it('returns feishu for feishu', () => {
      expect(normalizeConnectorTag('feishu-mcp')).toBe('feishu');
    });

    it('returns lowercase input for unknown', () => {
      expect(normalizeConnectorTag('Custom')).toBe('custom');
    });

    it('returns empty string for undefined', () => {
      expect(normalizeConnectorTag(undefined)).toBe('');
    });
  });

  describe('specialistTags', () => {
    it('returns architecture tags for technical-architecture', () => {
      expect(specialistTags('technical-architecture')).toEqual(['architecture', 'repo', 'code', 'refactor']);
    });

    it('returns review tags for risk-compliance', () => {
      expect(specialistTags('risk-compliance')).toEqual(['review', 'security', 'compliance']);
    });

    it('returns payment tags for payment-channel', () => {
      expect(specialistTags('payment-channel')).toEqual(['payment', 'knowledge']);
    });

    it('returns product tags for product-strategy', () => {
      expect(specialistTags('product-strategy')).toEqual(['documentation', 'delivery', 'product']);
    });

    it('returns empty array for unknown domain', () => {
      expect(specialistTags('unknown')).toEqual([]);
    });

    it('returns empty array for undefined', () => {
      expect(specialistTags(undefined)).toEqual([]);
    });
  });

  describe('ministryTags', () => {
    it('returns research tags for hubu-search', () => {
      expect(ministryTags('hubu-search')).toEqual(['research', 'knowledge', 'memory']);
    });

    it('returns code tags for gongbu-code', () => {
      expect(ministryTags('gongbu-code')).toEqual(['code', 'refactor']);
    });

    it('returns sandbox tags for bingbu-ops', () => {
      expect(ministryTags('bingbu-ops')).toEqual(['sandbox', 'terminal', 'release']);
    });

    it('returns review tags for xingbu-review', () => {
      expect(ministryTags('xingbu-review')).toEqual(['review', 'security', 'compliance']);
    });

    it('returns delivery tags for libu-delivery', () => {
      expect(ministryTags('libu-delivery')).toEqual(['documentation', 'delivery']);
    });

    it('returns routing tags for libu-governance', () => {
      expect(ministryTags('libu-governance')).toEqual(['routing', 'budget', 'supervisor']);
    });

    it('resolves alias libu-router', () => {
      expect(ministryTags('libu-router')).toEqual(['routing', 'budget', 'supervisor']);
    });

    it('returns empty for unknown', () => {
      expect(ministryTags('unknown')).toEqual([]);
    });
  });

  describe('hasCapabilityAffinity', () => {
    it('returns true when token matches enabled connector', () => {
      expect(hasCapabilityAffinity(new Set(['github']), new Set(['github-mcp']), new Set(), ['github'])).toBe(true);
    });

    it('returns true when token matches connector', () => {
      expect(hasCapabilityAffinity(new Set(['github-mcp']), new Set(), new Set(), ['github'])).toBe(true);
    });

    it('returns true when token matches augmentation target', () => {
      expect(hasCapabilityAffinity(new Set(), new Set(), new Set(['browser-aug']), ['browser'])).toBe(true);
    });

    it('returns false when no match', () => {
      expect(
        hasCapabilityAffinity(new Set(['github']), new Set(['github-mcp']), new Set(['browser-aug']), ['lark'])
      ).toBe(false);
    });

    it('returns false for empty tokens', () => {
      expect(hasCapabilityAffinity(new Set(['github']), new Set(['github-mcp']), new Set(), [])).toBe(false);
    });
  });

  describe('getAttachmentTrust', () => {
    it('returns trust level and trend for matching attachment', () => {
      const attachments = [{ id: 'a1', capabilityTrust: { trustLevel: 'high', trustTrend: 'up' } }] as any;
      const result = getAttachmentTrust(attachments, a => a.id === 'a1');
      expect(result.level).toBe('high');
      expect(result.trend).toBe('up');
    });

    it('returns undefined level and trend when no attachment matches', () => {
      const result = getAttachmentTrust([], () => false);
      expect(result.level).toBeUndefined();
      expect(result.trend).toBeUndefined();
    });

    it('returns undefined level and trend when attachment has no trust', () => {
      const attachments = [{ id: 'a1' }] as any;
      const result = getAttachmentTrust(attachments, a => a.id === 'a1');
      expect(result.level).toBeUndefined();
      expect(result.trend).toBeUndefined();
    });
  });

  describe('isDegradedTrust', () => {
    it('returns true for low trust level', () => {
      expect(isDegradedTrust('low', 'steady')).toBe(true);
    });

    it('returns true for down trend', () => {
      expect(isDegradedTrust('high', 'down')).toBe(true);
    });

    it('returns false for high trust with up trend', () => {
      expect(isDegradedTrust('high', 'up')).toBe(false);
    });

    it('returns false for medium trust with steady trend', () => {
      expect(isDegradedTrust('medium', 'steady')).toBe(false);
    });

    it('returns false for undefined inputs', () => {
      expect(isDegradedTrust(undefined, undefined)).toBe(false);
    });
  });

  describe('dedupeAttachments', () => {
    it('deduplicates by id (last wins in Map)', () => {
      const attachments = [
        { id: 'a1', displayName: 'First' },
        { id: 'a1', displayName: 'Duplicate' },
        { id: 'a2', displayName: 'Second' }
      ] as any;
      const result = dedupeAttachments(attachments);
      expect(result).toHaveLength(2);
      // Map keeps the last value for duplicate keys
      expect(result[0].displayName).toBe('Duplicate');
    });

    it('returns empty array for empty input', () => {
      expect(dedupeAttachments([])).toEqual([]);
    });
  });

  describe('dedupeAugmentations', () => {
    it('deduplicates by id', () => {
      const augmentations = [
        { id: 'aug-1', name: 'First' },
        { id: 'aug-1', name: 'Duplicate' },
        { id: 'aug-2', name: 'Second' }
      ] as any;
      const result = dedupeAugmentations(augmentations);
      expect(result).toHaveLength(2);
    });
  });

  describe('resolveMinistryDisplay', () => {
    it('returns Chinese label for known ministry', () => {
      expect(resolveMinistryDisplay('hubu-search')).toBe('户部');
    });
  });

  describe('resolveSpecialistDisplay', () => {
    it('returns Chinese label for known specialist', () => {
      expect(resolveSpecialistDisplay('risk-compliance', 'fallback')).toBe('风控合规阁臣');
    });

    it('returns domain string for unknown specialist (getSpecialistDisplayName returns domain)', () => {
      expect(resolveSpecialistDisplay('unknown', 'fallback-name')).toBe('unknown');
    });
  });
});
