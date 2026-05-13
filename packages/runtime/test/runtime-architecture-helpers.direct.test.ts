import { describe, expect, it } from 'vitest';

import {
  normalizeMinistryId,
  getMinistryDisplayName,
  normalizeSpecialistDomain,
  getSpecialistDisplayName,
  normalizeExecutionMode
} from '../src/runtime/runtime-architecture-helpers';

describe('runtime-architecture-helpers (direct)', () => {
  describe('normalizeMinistryId', () => {
    it('returns canonical id for known ministry', () => {
      expect(normalizeMinistryId('hubu-search')).toBe('hubu-search');
      expect(normalizeMinistryId('gongbu-code')).toBe('gongbu-code');
      expect(normalizeMinistryId('bingbu-ops')).toBe('bingbu-ops');
      expect(normalizeMinistryId('xingbu-review')).toBe('xingbu-review');
      expect(normalizeMinistryId('libu-delivery')).toBe('libu-delivery');
      expect(normalizeMinistryId('libu-governance')).toBe('libu-governance');
    });

    it('resolves alias libu-router to libu-governance', () => {
      expect(normalizeMinistryId('libu-router')).toBe('libu-governance');
    });

    it('resolves alias libu-docs to libu-delivery', () => {
      expect(normalizeMinistryId('libu-docs')).toBe('libu-delivery');
    });

    it('returns undefined for undefined input', () => {
      expect(normalizeMinistryId(undefined)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      expect(normalizeMinistryId('')).toBeUndefined();
    });

    it('returns undefined for unknown ministry', () => {
      expect(normalizeMinistryId('unknown-ministry')).toBeUndefined();
    });
  });

  describe('getMinistryDisplayName', () => {
    it('returns Chinese label for known ministries', () => {
      expect(getMinistryDisplayName('hubu-search')).toBe('户部');
      expect(getMinistryDisplayName('gongbu-code')).toBe('工部');
      expect(getMinistryDisplayName('bingbu-ops')).toBe('兵部');
      expect(getMinistryDisplayName('xingbu-review')).toBe('刑部');
      expect(getMinistryDisplayName('libu-delivery')).toBe('礼部');
      expect(getMinistryDisplayName('libu-governance')).toBe('吏部');
    });

    it('returns Chinese label for aliases via canonical resolution', () => {
      expect(getMinistryDisplayName('libu-router')).toBe('吏部');
      expect(getMinistryDisplayName('libu-docs')).toBe('礼部');
    });

    it('returns the input string for unknown ministry', () => {
      expect(getMinistryDisplayName('custom')).toBe('custom');
    });

    it('returns undefined for undefined input', () => {
      expect(getMinistryDisplayName(undefined)).toBeUndefined();
    });
  });

  describe('normalizeSpecialistDomain', () => {
    it('returns canonical domain for known specialists', () => {
      expect(normalizeSpecialistDomain({ domain: 'general-assistant' })).toBe('general-assistant');
      expect(normalizeSpecialistDomain({ domain: 'product-strategy' })).toBe('product-strategy');
      expect(normalizeSpecialistDomain({ domain: 'growth-marketing' })).toBe('growth-marketing');
      expect(normalizeSpecialistDomain({ domain: 'payment-channel' })).toBe('payment-channel');
      expect(normalizeSpecialistDomain({ domain: 'risk-compliance' })).toBe('risk-compliance');
      expect(normalizeSpecialistDomain({ domain: 'technical-architecture' })).toBe('technical-architecture');
    });

    it('returns undefined for undefined domain', () => {
      expect(normalizeSpecialistDomain({})).toBeUndefined();
    });

    it('resolves live-ops to growth-marketing by default', () => {
      expect(normalizeSpecialistDomain({ domain: 'live-ops' })).toBe('growth-marketing');
    });

    it('resolves live-ops to product-strategy when goal has product signals', () => {
      expect(normalizeSpecialistDomain({ domain: 'live-ops', goal: '产品规划' })).toBe('product-strategy');
      expect(normalizeSpecialistDomain({ domain: 'live-ops', context: '版本优先级调整' })).toBe('product-strategy');
    });

    it('resolves live-ops to growth-marketing when no product signals', () => {
      expect(normalizeSpecialistDomain({ domain: 'live-ops', goal: '增加投放' })).toBe('growth-marketing');
    });

    it('returns undefined for unknown domain', () => {
      expect(normalizeSpecialistDomain({ domain: 'unknown-domain' })).toBeUndefined();
    });
  });

  describe('getSpecialistDisplayName', () => {
    it('returns Chinese label for known specialists', () => {
      expect(getSpecialistDisplayName({ domain: 'general-assistant' })).toBe('通才阁臣');
      expect(getSpecialistDisplayName({ domain: 'product-strategy' })).toBe('产品策略阁臣');
      expect(getSpecialistDisplayName({ domain: 'risk-compliance' })).toBe('风控合规阁臣');
    });

    it('returns the input domain string for unknown domain', () => {
      expect(getSpecialistDisplayName({ domain: 'custom-domain' })).toBe('custom-domain');
    });
  });

  describe('normalizeExecutionMode', () => {
    it('returns plan for planning-readonly', () => {
      expect(normalizeExecutionMode('planning-readonly')).toBe('plan');
    });

    it('returns execute for standard', () => {
      expect(normalizeExecutionMode('standard')).toBe('execute');
    });

    it('passes through plan, execute, imperial_direct', () => {
      expect(normalizeExecutionMode('plan')).toBe('plan');
      expect(normalizeExecutionMode('execute')).toBe('execute');
      expect(normalizeExecutionMode('imperial_direct')).toBe('imperial_direct');
    });

    it('returns undefined for undefined input', () => {
      expect(normalizeExecutionMode(undefined)).toBeUndefined();
    });

    it('returns undefined for unknown mode', () => {
      expect(normalizeExecutionMode('unknown-mode')).toBeUndefined();
    });
  });
});
