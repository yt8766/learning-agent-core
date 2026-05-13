import { describe, expect, it } from 'vitest';

import { derivePlannerStrategyRecord, type PlannerStrategyContext } from '../src/agents/planner-strategy';

describe('planner-strategy (direct)', () => {
  const fixedNow = '2026-05-10T12:00:00.000Z';

  describe('derivePlannerStrategyRecord', () => {
    it('returns default mode when context has no specialistLead', () => {
      const result = derivePlannerStrategyRecord({}, fixedNow);
      expect(result.mode).toBe('default');
      expect(result.gapDetected).toBe(false);
      expect(result.candidateCount).toBe(0);
      expect(result.candidateAgentIds).toBeUndefined();
      expect(result.updatedAt).toBe(fixedNow);
    });

    it('returns default mode when lead has no candidateAgentIds and no requiredCapabilities', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Test Lead'
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.mode).toBe('default');
      expect(result.gapDetected).toBe(false);
      expect(result.candidateCount).toBe(0);
      expect(result.summary).toContain('Test Lead');
      expect(result.summary).toContain('单一路径规划');
    });

    it('returns capability-gap mode when requiredCapabilities exist but no candidates', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Gap Lead',
          domain: 'payment-channel',
          requiredCapabilities: ['payment-connector']
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.mode).toBe('capability-gap');
      expect(result.gapDetected).toBe(true);
      expect(result.candidateCount).toBe(0);
      expect(result.requiredCapabilities).toEqual(['payment-connector']);
      expect(result.leadDomain).toBe('payment-channel');
      expect(result.summary).toContain('Gap Lead');
      expect(result.summary).toContain('capability gap');
    });

    it('returns rich-candidates mode when 2+ candidateAgentIds exist', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Rich Lead',
          candidateAgentIds: ['agent-a', 'agent-b', 'agent-c']
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.mode).toBe('rich-candidates');
      expect(result.gapDetected).toBe(false);
      expect(result.candidateCount).toBe(3);
      expect(result.candidateAgentIds).toEqual(['agent-a', 'agent-b', 'agent-c']);
      expect(result.summary).toContain('Rich Lead');
      expect(result.summary).toContain('3 个候选官方 Agent');
    });

    it('returns default mode when exactly 1 candidateAgentId', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Single Lead',
          candidateAgentIds: ['agent-a']
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.mode).toBe('default');
      expect(result.candidateCount).toBe(1);
      expect(result.candidateAgentIds).toEqual(['agent-a']);
    });

    it('prefers agentId over first candidateAgentId for preferredAgentId', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Lead',
          agentId: 'preferred-agent',
          candidateAgentIds: ['candidate-1', 'candidate-2']
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.preferredAgentId).toBe('preferred-agent');
    });

    it('falls back to first candidateAgentId when agentId is not set', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Lead',
          candidateAgentIds: ['candidate-1', 'candidate-2']
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.preferredAgentId).toBe('candidate-1');
    });

    it('preferredAgentId is undefined when no agentId and no candidates', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Lead'
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.preferredAgentId).toBeUndefined();
    });

    it('uses "未命名专家" when displayName is missing in gap mode', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: '',
          requiredCapabilities: ['cap-1']
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      // displayName is empty string which is falsy in the ?? chain
      expect(result.summary).toBeDefined();
    });

    it('uses current date when now parameter is omitted', () => {
      const before = new Date().toISOString();
      const result = derivePlannerStrategyRecord({});
      const after = new Date().toISOString();
      expect(result.updatedAt >= before).toBe(true);
      expect(result.updatedAt <= after).toBe(true);
    });

    it('sets candidateAgentIds to undefined when empty', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Lead',
          candidateAgentIds: []
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.candidateAgentIds).toBeUndefined();
    });

    it('includes domain in leadDomain when present', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Lead',
          domain: 'technical-architecture'
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.leadDomain).toBe('technical-architecture');
    });

    it('handles empty requiredCapabilities array as no gap', () => {
      const context: PlannerStrategyContext = {
        specialistLead: {
          displayName: 'Lead',
          requiredCapabilities: [],
          candidateAgentIds: []
        }
      };
      const result = derivePlannerStrategyRecord(context, fixedNow);
      expect(result.gapDetected).toBe(false);
      expect(result.mode).toBe('default');
    });
  });
});
