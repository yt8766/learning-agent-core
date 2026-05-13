import { describe, expect, it } from 'vitest';

import {
  dedupeAttachments,
  dedupeAugmentations,
  getAttachmentTrust,
  hasCapabilityAffinity,
  isDegradedTrust,
  ministryTags,
  normalizeConnectorTag,
  resolveMinistryDisplay,
  resolveSpecialistDisplay,
  specialistTags,
  toCapabilityTrigger
} from '../src/capabilities/capability-pool.shared';

describe('capability-pool-shared', () => {
  describe('toCapabilityTrigger', () => {
    it('returns user_requested for user_requested trigger reason', () => {
      expect(toCapabilityTrigger('user_requested')).toBe('user_requested');
    });

    it('returns specialist_requested for domain_specialization_needed', () => {
      expect(toCapabilityTrigger('domain_specialization_needed')).toBe('specialist_requested');
    });

    it('defaults to capability_gap_detected', () => {
      expect(toCapabilityTrigger('capability_gap_detected')).toBe('capability_gap_detected');
      expect(toCapabilityTrigger(undefined)).toBe('capability_gap_detected');
      expect(toCapabilityTrigger()).toBe('capability_gap_detected');
    });
  });

  describe('normalizeConnectorTag', () => {
    it('normalizes github to repo', () => {
      expect(normalizeConnectorTag('github-mcp')).toBe('repo');
      expect(normalizeConnectorTag('GitHub MCP')).toBe('repo');
    });

    it('normalizes browser to browser', () => {
      expect(normalizeConnectorTag('browser-mcp')).toBe('browser');
      expect(normalizeConnectorTag('Browser MCP')).toBe('browser');
    });

    it('normalizes lark/feishu to feishu', () => {
      expect(normalizeConnectorTag('lark-mcp')).toBe('feishu');
      expect(normalizeConnectorTag('feishu-connector')).toBe('feishu');
    });

    it('lowercases unknown tags', () => {
      expect(normalizeConnectorTag('CustomTag')).toBe('customtag');
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

    it('returns documentation tags for product-strategy', () => {
      expect(specialistTags('product-strategy')).toEqual(['documentation', 'delivery', 'product']);
    });

    it('returns empty array for unknown domain', () => {
      expect(specialistTags('unknown')).toEqual([]);
      expect(specialistTags(undefined)).toEqual([]);
    });
  });

  describe('ministryTags', () => {
    it('returns correct tags for each known ministry', () => {
      expect(ministryTags('hubu-search')).toEqual(['research', 'knowledge', 'memory']);
      expect(ministryTags('gongbu-code')).toEqual(['code', 'refactor']);
      expect(ministryTags('bingbu-ops')).toEqual(['sandbox', 'terminal', 'release']);
      expect(ministryTags('xingbu-review')).toEqual(['review', 'security', 'compliance']);
      expect(ministryTags('libu-delivery')).toEqual(['documentation', 'delivery']);
      expect(ministryTags('libu-governance')).toEqual(['routing', 'budget', 'supervisor']);
    });

    it('resolves aliases', () => {
      expect(ministryTags('libu-router')).toEqual(['routing', 'budget', 'supervisor']);
      expect(ministryTags('libu-docs')).toEqual(['documentation', 'delivery']);
    });

    it('returns empty array for unknown ministry', () => {
      expect(ministryTags('unknown')).toEqual([]);
    });
  });

  describe('hasCapabilityAffinity', () => {
    it('returns true when connector id contains token', () => {
      const connectors = new Set(['browser-mcp-connector']);
      const enabled = new Set<string>();
      const augTargets = new Set<string>();
      expect(hasCapabilityAffinity(connectors, enabled, augTargets, ['browser'])).toBe(true);
    });

    it('returns true when enabled connector contains token', () => {
      const connectors = new Set<string>();
      const enabled = new Set(['github-connector']);
      const augTargets = new Set<string>();
      expect(hasCapabilityAffinity(connectors, enabled, augTargets, ['github'])).toBe(true);
    });

    it('returns true when augmentation target contains token', () => {
      const connectors = new Set<string>();
      const enabled = new Set<string>();
      const augTargets = new Set(['lark-mcp-template']);
      expect(hasCapabilityAffinity(connectors, enabled, augTargets, ['lark'])).toBe(true);
    });

    it('returns false when no match', () => {
      const connectors = new Set(['other-connector']);
      const enabled = new Set<string>();
      const augTargets = new Set<string>();
      expect(hasCapabilityAffinity(connectors, enabled, augTargets, ['browser'])).toBe(false);
    });
  });

  describe('getAttachmentTrust', () => {
    it('returns trust level and trend from matching attachment', () => {
      const attachments = [
        {
          id: 'att-1',
          owner: { ownerType: 'ministry-owned', ownerId: 'gongbu-code' },
          capabilityTrust: { trustLevel: 'high', trustTrend: 'up' }
        }
      ] as any[];
      const result = getAttachmentTrust(attachments, a => a.owner.ownerId === 'gongbu-code');
      expect(result).toEqual({ level: 'high', trend: 'up' });
    });

    it('returns undefined values when no attachment matches', () => {
      const result = getAttachmentTrust([], () => false);
      expect(result).toEqual({ level: undefined, trend: undefined });
    });

    it('returns undefined values for undefined attachments', () => {
      const result = getAttachmentTrust(undefined, () => false);
      expect(result).toEqual({ level: undefined, trend: undefined });
    });
  });

  describe('isDegradedTrust', () => {
    it('returns true when level is low', () => {
      expect(isDegradedTrust('low', 'steady')).toBe(true);
    });

    it('returns true when trend is down', () => {
      expect(isDegradedTrust('high', 'down')).toBe(true);
    });

    it('returns false when level and trend are healthy', () => {
      expect(isDegradedTrust('high', 'up')).toBe(false);
      expect(isDegradedTrust('medium', 'steady')).toBe(false);
    });

    it('returns false when both are undefined', () => {
      expect(isDegradedTrust(undefined, undefined)).toBe(false);
    });
  });

  describe('dedupeAttachments', () => {
    it('keeps the last attachment with the same id', () => {
      const result = dedupeAttachments([
        { id: 'a', displayName: 'first' },
        { id: 'b', displayName: 'other' },
        { id: 'a', displayName: 'second' }
      ] as any[]);
      expect(result).toHaveLength(2);
      expect(result.find(a => a.id === 'a')!.displayName).toBe('second');
    });
  });

  describe('dedupeAugmentations', () => {
    it('keeps the last augmentation with the same id', () => {
      const result = dedupeAugmentations([
        { id: 'x', status: 'suggested' },
        { id: 'y', status: 'ready' },
        { id: 'x', status: 'blocked' }
      ] as any[]);
      expect(result).toHaveLength(2);
      expect(result.find(a => a.id === 'x')!.status).toBe('blocked');
    });
  });

  describe('resolveMinistryDisplay', () => {
    it('returns display name for known ministries', () => {
      expect(resolveMinistryDisplay('gongbu-code' as any)).toBe('工部');
      expect(resolveMinistryDisplay('hubu-search' as any)).toBe('户部');
    });
  });

  describe('resolveSpecialistDisplay', () => {
    it('returns display name for known specialists', () => {
      expect(resolveSpecialistDisplay('technical-architecture', 'fallback')).toBe('技术架构阁臣');
    });

    it('returns the domain for unknown specialists', () => {
      // getSpecialistDisplayName returns the domain itself for unknown, so displayName fallback is not reached
      expect(resolveSpecialistDisplay('unknown', 'fallback')).toBe('unknown');
    });
  });
});
