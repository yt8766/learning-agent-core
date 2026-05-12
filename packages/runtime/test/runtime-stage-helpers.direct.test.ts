import { describe, expect, it, vi } from 'vitest';

import { AgentRole } from '@agent/core';

import {
  resolveResearchDispatchObjective,
  resolveExecutionDispatchObjective,
  appendExecutionEvidence,
  completeSkillStep,
  buildCurrentSkillExecution,
  setSkillStepStatus,
  announceSkillStep
} from '../src/flows/runtime-stage/runtime-stage-helpers';

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    goal: 'test goal',
    status: 'running',
    trace: [],
    externalSources: [],
    capabilityAttachments: [],
    plan: { subTasks: [] },
    currentSkillExecution: undefined,
    updatedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  } as any;
}

describe('runtime-stage-helpers (direct)', () => {
  describe('resolveResearchDispatchObjective', () => {
    it('returns fallback when no dispatches', () => {
      expect(resolveResearchDispatchObjective(undefined)).toBe('Research shared memory and skills');
    });

    it('returns fallback when empty dispatches', () => {
      expect(resolveResearchDispatchObjective([])).toBe('Research shared memory and skills');
    });

    it('returns objective for strategy dispatch', () => {
      const dispatches = [{ kind: 'strategy', objective: 'Research the topic' }] as any;
      expect(resolveResearchDispatchObjective(dispatches)).toBe('Research the topic');
    });

    it('returns objective for research role dispatch', () => {
      const dispatches = [{ kind: 'ministry', to: AgentRole.RESEARCH, objective: 'Search memory' }] as any;
      expect(resolveResearchDispatchObjective(dispatches)).toBe('Search memory');
    });

    it('skips fallback dispatches', () => {
      const dispatches = [
        { kind: 'fallback', objective: 'Fallback' },
        { kind: 'strategy', objective: 'Strategy research' }
      ] as any;
      expect(resolveResearchDispatchObjective(dispatches)).toBe('Strategy research');
    });
  });

  describe('resolveExecutionDispatchObjective', () => {
    it('returns fallback when no dispatches', () => {
      expect(resolveExecutionDispatchObjective(undefined)).toBe('Execute the candidate action');
    });

    it('returns objective for ministry dispatch (not review)', () => {
      const dispatches = [{ kind: 'ministry', to: AgentRole.EXECUTOR, objective: 'Write code' }] as any;
      expect(resolveExecutionDispatchObjective(dispatches)).toBe('Write code');
    });

    it('skips review dispatches', () => {
      const dispatches = [
        { kind: 'ministry', to: AgentRole.REVIEWER, objective: 'Review', specialistDomain: 'risk-compliance' },
        { kind: 'ministry', to: AgentRole.EXECUTOR, objective: 'Execute' }
      ] as any;
      expect(resolveExecutionDispatchObjective(dispatches)).toBe('Execute');
    });

    it('skips fallback dispatches', () => {
      const dispatches = [
        { kind: 'fallback', objective: 'Fallback' },
        { kind: 'ministry', to: AgentRole.EXECUTOR, objective: 'Execute' }
      ] as any;
      expect(resolveExecutionDispatchObjective(dispatches)).toBe('Execute');
    });
  });

  describe('appendExecutionEvidence', () => {
    it('does nothing when toolName is undefined', () => {
      const task = makeTask();
      appendExecutionEvidence(task, undefined, undefined);
      expect(task.externalSources).toEqual([]);
    });

    it('does nothing when executionResult is undefined', () => {
      const task = makeTask();
      appendExecutionEvidence(task, 'tool', undefined);
      expect(task.externalSources).toEqual([]);
    });

    it('does nothing when rawOutput is not an object', () => {
      const task = makeTask();
      appendExecutionEvidence(task, 'tool', { outputSummary: 'test', rawOutput: 'string' });
      expect(task.externalSources).toEqual([]);
    });

    it('does nothing when rawOutput has no results or items', () => {
      const task = makeTask();
      appendExecutionEvidence(task, 'unknown_tool', {
        outputSummary: 'test',
        rawOutput: { someField: 'value' }
      });
      expect(task.externalSources).toEqual([]);
    });
  });

  describe('completeSkillStep', () => {
    it('does nothing when no currentSkillExecution', () => {
      const task = makeTask();
      completeSkillStep(task, 'research');
      expect(task.currentSkillExecution).toBeUndefined();
    });

    it('does nothing when phase does not match', () => {
      const task = makeTask({
        currentSkillExecution: { phase: 'execute', stepIndex: 1 }
      });
      completeSkillStep(task, 'research');
      expect(task.currentSkillExecution.phase).toBe('execute');
    });
  });
});
