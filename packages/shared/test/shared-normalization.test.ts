import { describe, expect, it } from 'vitest';

import {
  getExecutionModeDisplayName,
  getMinistryDisplayName,
  getSpecialistDisplayName,
  isLegacyExecutionModeAlias,
  isLegacyMinistryAlias,
  normalizeExecutionMode,
  normalizeMinistryId,
  normalizeSpecialistDomain
} from '../src/architecture';
import { buildApprovalScopeMatchKey, matchesApprovalScopePolicy } from '../src/types/governance';

describe('@agent/shared normalization helpers', () => {
  it('normalizes legacy ministry aliases to canonical ids and labels', () => {
    expect(normalizeMinistryId('libu-router')).toBe('libu-governance');
    expect(isLegacyMinistryAlias('libu-docs')).toBe(true);
    expect(getMinistryDisplayName('libu-docs')).toBe('礼部');
  });

  it('routes live-ops specialist aliases based on product signals', () => {
    expect(
      normalizeSpecialistDomain({
        domain: 'live-ops',
        goal: '梳理产品路线和功能优先级'
      })
    ).toBe('product-strategy');

    expect(
      normalizeSpecialistDomain({
        domain: 'live-ops',
        context: '聚焦活动投放和增长表现'
      })
    ).toBe('growth-marketing');

    expect(
      getSpecialistDisplayName({
        domain: 'live-ops',
        goal: '优化版本规划'
      })
    ).toBe('产品策略阁臣');
  });

  it('normalizes legacy execution mode aliases', () => {
    expect(normalizeExecutionMode('planning-readonly')).toBe('plan');
    expect(normalizeExecutionMode('standard')).toBe('execute');
    expect(isLegacyExecutionModeAlias('standard')).toBe(true);
    expect(getExecutionModeDisplayName('imperial_direct')).toBe('特旨直达');
    expect(normalizeExecutionMode('unknown-mode')).toBeUndefined();
  });

  it('builds stable approval scope match keys and only matches active policies', () => {
    const input = {
      intent: '  Execute  ',
      toolName: '  Bash Tool ',
      riskCode: ' HIGH_RISK ',
      requestedBy: ' Supervisor ',
      commandPreview: ' pnpm test:unit '
    };

    const matchKey = buildApprovalScopeMatchKey(input);

    expect(matchKey).toBe('execute::bash tool::high_risk::supervisor::pnpm test:unit');
    expect(
      matchesApprovalScopePolicy(
        {
          status: 'active',
          matchKey
        },
        {
          intent: 'execute',
          toolName: 'bash tool',
          riskCode: 'high_risk',
          requestedBy: 'supervisor',
          commandPreview: 'pnpm test:unit'
        }
      )
    ).toBe(true);

    expect(
      matchesApprovalScopePolicy(
        {
          status: 'revoked',
          matchKey
        },
        input
      )
    ).toBe(false);
  });
});
