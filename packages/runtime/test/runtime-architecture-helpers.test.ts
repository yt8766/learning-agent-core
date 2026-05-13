import { describe, expect, it } from 'vitest';

import {
  getMinistryDisplayName,
  getSpecialistDisplayName,
  normalizeExecutionMode,
  normalizeMinistryId,
  normalizeSpecialistDomain
} from '../src/runtime/runtime-architecture-helpers';

describe('runtime-architecture-helpers', () => {
  describe('normalizeMinistryId', () => {
    it('returns the canonical ministry id for known aliases', () => {
      expect(normalizeMinistryId('libu-governance')).toBe('libu-governance');
      expect(normalizeMinistryId('libu-router')).toBe('libu-governance');
      expect(normalizeMinistryId('hubu-search')).toBe('hubu-search');
      expect(normalizeMinistryId('gongbu-code')).toBe('gongbu-code');
      expect(normalizeMinistryId('bingbu-ops')).toBe('bingbu-ops');
      expect(normalizeMinistryId('xingbu-review')).toBe('xingbu-review');
      expect(normalizeMinistryId('libu-delivery')).toBe('libu-delivery');
      expect(normalizeMinistryId('libu-docs')).toBe('libu-delivery');
    });

    it('returns undefined for unknown ministry ids', () => {
      expect(normalizeMinistryId('unknown-ministry')).toBeUndefined();
    });

    it('returns undefined for empty/undefined input', () => {
      expect(normalizeMinistryId(undefined)).toBeUndefined();
      expect(normalizeMinistryId('')).toBeUndefined();
    });
  });

  describe('getMinistryDisplayName', () => {
    it('returns Chinese display name for known ministries', () => {
      expect(getMinistryDisplayName('libu-governance')).toBe('吏部');
      expect(getMinistryDisplayName('hubu-search')).toBe('户部');
      expect(getMinistryDisplayName('gongbu-code')).toBe('工部');
      expect(getMinistryDisplayName('bingbu-ops')).toBe('兵部');
      expect(getMinistryDisplayName('xingbu-review')).toBe('刑部');
      expect(getMinistryDisplayName('libu-delivery')).toBe('礼部');
    });

    it('resolves aliases to display name', () => {
      expect(getMinistryDisplayName('libu-router')).toBe('吏部');
      expect(getMinistryDisplayName('libu-docs')).toBe('礼部');
    });

    it('returns the input string for unknown ministries', () => {
      expect(getMinistryDisplayName('custom-ministry')).toBe('custom-ministry');
    });

    it('returns undefined for empty/undefined input', () => {
      expect(getMinistryDisplayName(undefined)).toBeUndefined();
    });
  });

  describe('normalizeSpecialistDomain', () => {
    it('returns canonical domain for known specialist types', () => {
      expect(normalizeSpecialistDomain({ domain: 'general-assistant' })).toBe('general-assistant');
      expect(normalizeSpecialistDomain({ domain: 'product-strategy' })).toBe('product-strategy');
      expect(normalizeSpecialistDomain({ domain: 'growth-marketing' })).toBe('growth-marketing');
      expect(normalizeSpecialistDomain({ domain: 'payment-channel' })).toBe('payment-channel');
      expect(normalizeSpecialistDomain({ domain: 'risk-compliance' })).toBe('risk-compliance');
      expect(normalizeSpecialistDomain({ domain: 'technical-architecture' })).toBe('technical-architecture');
    });

    it('resolves live-ops to growth-marketing by default', () => {
      expect(normalizeSpecialistDomain({ domain: 'live-ops' })).toBe('growth-marketing');
    });

    it('resolves live-ops to product-strategy when product signals present in goal', () => {
      expect(normalizeSpecialistDomain({ domain: 'live-ops', goal: '规划新版本功能' })).toBe('product-strategy');
    });

    it('resolves live-ops to product-strategy when product signals present in context', () => {
      expect(normalizeSpecialistDomain({ domain: 'live-ops', context: '优先级排序' })).toBe('product-strategy');
    });

    it('returns undefined for unknown domain', () => {
      expect(normalizeSpecialistDomain({ domain: 'unknown' })).toBeUndefined();
    });

    it('returns undefined for empty/undefined domain', () => {
      expect(normalizeSpecialistDomain({})).toBeUndefined();
    });
  });

  describe('getSpecialistDisplayName', () => {
    it('returns Chinese display name for known specialists', () => {
      expect(getSpecialistDisplayName({ domain: 'general-assistant' })).toBe('通才阁臣');
      expect(getSpecialistDisplayName({ domain: 'product-strategy' })).toBe('产品策略阁臣');
      expect(getSpecialistDisplayName({ domain: 'growth-marketing' })).toBe('增长营销阁臣');
      expect(getSpecialistDisplayName({ domain: 'risk-compliance' })).toBe('风控合规阁臣');
      expect(getSpecialistDisplayName({ domain: 'technical-architecture' })).toBe('技术架构阁臣');
    });

    it('returns the domain string for unknown specialists', () => {
      expect(getSpecialistDisplayName({ domain: 'custom-domain' })).toBe('custom-domain');
    });

    it('returns undefined when domain is undefined', () => {
      expect(getSpecialistDisplayName({})).toBeUndefined();
    });
  });

  describe('normalizeExecutionMode', () => {
    it('returns plan for planning-readonly', () => {
      expect(normalizeExecutionMode('planning-readonly')).toBe('plan');
    });

    it('returns execute for standard', () => {
      expect(normalizeExecutionMode('standard')).toBe('execute');
    });

    it('passes through known modes unchanged', () => {
      expect(normalizeExecutionMode('plan')).toBe('plan');
      expect(normalizeExecutionMode('execute')).toBe('execute');
      expect(normalizeExecutionMode('imperial_direct')).toBe('imperial_direct');
    });

    it('returns undefined for unknown mode strings', () => {
      expect(normalizeExecutionMode('unknown')).toBeUndefined();
    });

    it('returns undefined for empty/undefined input', () => {
      expect(normalizeExecutionMode(undefined)).toBeUndefined();
      expect(normalizeExecutionMode('')).toBeUndefined();
    });
  });
});
