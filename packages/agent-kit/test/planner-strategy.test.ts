import { describe, expect, it } from 'vitest';

import { derivePlannerStrategyRecord } from '../src/planner-strategy';

describe('@agent/agent-kit planner strategy selector', () => {
  it('marks capability gap when required capabilities exist but no official candidates are present', () => {
    const strategy = derivePlannerStrategyRecord(
      {
        specialistLead: {
          displayName: '风控合规专家',
          domain: 'risk-compliance',
          requiredCapabilities: ['specialist.risk-compliance'],
          candidateAgentIds: []
        }
      },
      '2026-04-19T00:00:00.000Z'
    );

    expect(strategy.mode).toBe('capability-gap');
    expect(strategy.gapDetected).toBe(true);
    expect(strategy.candidateCount).toBe(0);
  });

  it('marks rich candidates when multiple official agents are available', () => {
    const strategy = derivePlannerStrategyRecord(
      {
        specialistLead: {
          displayName: '技术架构专家',
          domain: 'technical-architecture',
          requiredCapabilities: ['specialist.technical-architecture'],
          agentId: 'official.coder',
          candidateAgentIds: ['official.coder', 'official.reviewer', 'official.data-report']
        }
      },
      '2026-04-19T00:00:00.000Z'
    );

    expect(strategy.mode).toBe('rich-candidates');
    expect(strategy.preferredAgentId).toBe('official.coder');
    expect(strategy.candidateCount).toBe(3);
    expect(strategy.gapDetected).toBe(false);
  });
});
