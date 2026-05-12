import { describe, expect, it } from 'vitest';

import { AgentRole } from '@agent/core';

import {
  completeSkillStep,
  resolveExecutionDispatchObjective,
  resolveResearchDispatchObjective,
  setSkillStepStatus
} from '../src/flows/runtime-stage/runtime-stage-helpers';

describe('runtime-stage-helpers', () => {
  describe('resolveResearchDispatchObjective', () => {
    it('returns objective from matching research dispatch', () => {
      const dispatches = [
        {
          kind: 'strategy',
          objective: 'Research from strategy',
          to: AgentRole.RESEARCH
        }
      ];
      expect(resolveResearchDispatchObjective(dispatches as any)).toBe('Research from strategy');
    });

    it('returns objective from supervisor dispatch', () => {
      const dispatches = [
        {
          kind: 'ministry',
          selectedAgentId: 'official.supervisor',
          objective: 'Supervisor research'
        }
      ];
      expect(resolveResearchDispatchObjective(dispatches as any)).toBe('Supervisor research');
    });

    it('returns fallback when no matching dispatch found', () => {
      const dispatches = [
        {
          kind: 'ministry',
          selectedAgentId: 'other',
          objective: 'Other objective'
        }
      ];
      expect(resolveResearchDispatchObjective(dispatches as any)).toBe('Research shared memory and skills');
    });

    it('skips fallback dispatches', () => {
      const dispatches = [
        {
          kind: 'fallback',
          to: AgentRole.RESEARCH,
          objective: 'Fallback research'
        }
      ];
      expect(resolveResearchDispatchObjective(dispatches as any)).toBe('Research shared memory and skills');
    });

    it('returns default for undefined dispatches', () => {
      expect(resolveResearchDispatchObjective(undefined)).toBe('Research shared memory and skills');
    });

    it('returns objective from selectionSource strategy-counselor dispatch', () => {
      const dispatches = [
        {
          kind: 'ministry',
          selectionSource: 'strategy-counselor',
          objective: 'Counselor research'
        }
      ];
      expect(resolveResearchDispatchObjective(dispatches as any)).toBe('Counselor research');
    });
  });

  describe('resolveExecutionDispatchObjective', () => {
    it('returns objective from execution dispatch', () => {
      const dispatches = [
        {
          kind: 'ministry',
          to: AgentRole.EXECUTOR,
          objective: 'Execute code'
        }
      ];
      expect(resolveExecutionDispatchObjective(dispatches as any)).toBe('Execute code');
    });

    it('skips review dispatches', () => {
      const dispatches = [
        {
          kind: 'ministry',
          to: AgentRole.REVIEWER,
          objective: 'Review code'
        }
      ];
      expect(resolveExecutionDispatchObjective(dispatches as any)).toBe('Execute the candidate action');
    });

    it('skips risk-compliance specialist dispatches', () => {
      const dispatches = [
        {
          kind: 'ministry',
          specialistDomain: 'risk-compliance',
          objective: 'Risk check'
        }
      ];
      expect(resolveExecutionDispatchObjective(dispatches as any)).toBe('Execute the candidate action');
    });

    it('skips fallback dispatches', () => {
      const dispatches = [
        {
          kind: 'fallback',
          to: AgentRole.EXECUTOR,
          objective: 'Fallback exec'
        }
      ];
      expect(resolveExecutionDispatchObjective(dispatches as any)).toBe('Execute the candidate action');
    });

    it('returns default for undefined dispatches', () => {
      expect(resolveExecutionDispatchObjective(undefined)).toBe('Execute the candidate action');
    });
  });

  describe('setSkillStepStatus', () => {
    it('updates matching subtask status', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'skill:test-skill',
            kind: 'skill',
            enabled: true,
            metadata: { steps: [{ title: 'Step 1' }] },
            owner: { ownerType: 'user-attached' }
          }
        ],
        requestedHints: { requestedSkill: 'test-skill' },
        currentSkillExecution: { phase: 'execute', stepIndex: 1 },
        plan: {
          subTasks: [{ id: 'skill_step:skill:test-skill:1', assignedTo: 'executor', status: 'pending' }]
        }
      } as any;

      setSkillStepStatus(task, 'execute', 'running');
      expect(task.plan.subTasks[0].status).toBe('running');
    });

    it('does nothing when no compiled skill attachment found', () => {
      const task = {
        plan: { subTasks: [{ id: 'sub-1', status: 'pending' }] }
      } as any;

      setSkillStepStatus(task, 'execute', 'running');
      expect(task.plan.subTasks[0].status).toBe('pending');
    });

    it('does nothing when no plan subtasks', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'skill:test-skill',
            kind: 'skill',
            enabled: true,
            metadata: { steps: [{ title: 'Step 1' }] },
            owner: { ownerType: 'user-attached' }
          }
        ],
        requestedHints: { requestedSkill: 'test-skill' },
        plan: undefined
      } as any;

      setSkillStepStatus(task, 'execute', 'running');
      // should not throw
    });
  });

  describe('completeSkillStep', () => {
    it('completes skill step when phase matches', () => {
      const task = {
        capabilityAttachments: [
          {
            id: 'skill:test-skill',
            kind: 'skill',
            enabled: true,
            metadata: { steps: [{ title: 'Step 1' }] },
            owner: { ownerType: 'user-attached' }
          }
        ],
        requestedHints: { requestedSkill: 'test-skill' },
        currentSkillExecution: { phase: 'execute', stepIndex: 1 },
        plan: {
          subTasks: [{ id: 'skill_step:skill:test-skill:1', assignedTo: 'executor', status: 'running' }]
        }
      } as any;

      completeSkillStep(task, 'execute');
      expect(task.plan.subTasks[0].status).toBe('completed');
    });

    it('does nothing when phase does not match', () => {
      const task = {
        currentSkillExecution: { phase: 'research', stepIndex: 1 },
        capabilityAttachments: [
          {
            id: 'skill:test',
            kind: 'skill',
            enabled: true,
            metadata: { steps: [{ title: 'Step 1' }] },
            owner: { ownerType: 'user-attached' }
          }
        ],
        requestedHints: { requestedSkill: 'test' },
        plan: { subTasks: [{ id: 'skill_step:skill:test:1', assignedTo: 'executor', status: 'running' }] }
      } as any;

      completeSkillStep(task, 'execute');
      expect(task.plan.subTasks[0].status).toBe('running');
    });

    it('does nothing when no currentSkillExecution', () => {
      const task = {} as any;
      completeSkillStep(task, 'execute');
      // should not throw
    });
  });
});
