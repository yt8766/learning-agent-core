import { describe, expect, it } from 'vitest';

import {
  getMinistryDisplayName,
  getSpecialistDisplayName,
  normalizeExecutionMode,
  normalizeMinistryId
} from '../../../src/runtime/helpers/runtime-architecture-helpers';

describe('runtime-architecture-helpers', () => {
  it('会规范化 ministry 与 execution mode 别名', () => {
    expect(normalizeMinistryId('libu-router')).toBe('libu-governance');
    expect(normalizeMinistryId('libu-docs')).toBe('libu-delivery');
    expect(normalizeMinistryId('unknown')).toBeUndefined();

    expect(normalizeExecutionMode('planning-readonly')).toBe('plan');
    expect(normalizeExecutionMode('standard')).toBe('execute');
    expect(normalizeExecutionMode('imperial_direct')).toBe('imperial_direct');
    expect(normalizeExecutionMode('custom')).toBeUndefined();
  });

  it('会返回 ministry 与 specialist 的展示名称，并兼容 live-ops 分流', () => {
    expect(getMinistryDisplayName('gongbu-code')).toBe('工部');
    expect(getMinistryDisplayName('custom-ministry')).toBe('custom-ministry');

    expect(getSpecialistDisplayName({ domain: 'technical-architecture' })).toBe('技术架构阁臣');
    expect(
      getSpecialistDisplayName({
        domain: 'live-ops',
        goal: '制定产品规划',
        context: '需要梳理版本路线和功能优先级'
      })
    ).toBe('产品策略阁臣');
    expect(
      getSpecialistDisplayName({
        domain: 'live-ops',
        goal: '提高活动转化',
        context: '关注投放素材与增长节奏'
      })
    ).toBe('增长营销阁臣');
  });
});
