import { describe, expect, it } from 'vitest';

import {
  runGoalIntakeNode,
  runRouteNode,
  runManagerPlanNode,
  runDispatchNode,
  runResearchNode,
  runExecuteNode,
  runReviewNode,
  runFinishNode
} from '../../../src/flows/chat/chat-graph-nodes';

function makeState(overrides: Record<string, unknown> = {}): any {
  return {
    taskId: 'task-1',
    goal: 'test goal',
    currentStep: '',
    currentPlan: [],
    observations: [],
    shouldRetry: false,
    terminateAfterPlanning: false,
    approvalRequired: false,
    approvalStatus: 'approved',
    finalAnswer: undefined,
    ...overrides
  };
}

describe('chat-graph-nodes (direct)', () => {
  describe('runGoalIntakeNode', () => {
    it('uses default handler when no handler provided', async () => {
      const result = await runGoalIntakeNode(makeState());
      expect(result.currentStep).toBe('goal_intake');
      expect(result.observations).toContain('goal:test goal');
    });

    it('delegates to custom handler when provided', async () => {
      const handler = vi.fn().mockReturnValue(makeState({ currentStep: 'custom' }));
      const result = await runGoalIntakeNode(makeState(), { goalIntake: handler });
      expect(result.currentStep).toBe('custom');
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('runRouteNode', () => {
    it('uses default handler', async () => {
      const result = await runRouteNode(makeState());
      expect(result.currentStep).toBe('route');
    });

    it('delegates to custom handler', async () => {
      const handler = vi.fn().mockReturnValue(makeState({ currentStep: 'custom-route' }));
      const result = await runRouteNode(makeState(), { route: handler });
      expect(result.currentStep).toBe('custom-route');
    });
  });

  describe('runManagerPlanNode', () => {
    it('uses default plan when no plan exists', async () => {
      const result = await runManagerPlanNode(makeState({ currentPlan: [] }));
      expect(result.currentStep).toBe('manager_plan');
      expect(result.currentPlan).toEqual(['research', 'execute', 'review']);
      expect(result.shouldRetry).toBe(false);
      expect(result.terminateAfterPlanning).toBe(false);
    });

    it('preserves existing plan', async () => {
      const result = await runManagerPlanNode(makeState({ currentPlan: ['custom-step'] }));
      expect(result.currentPlan).toEqual(['custom-step']);
    });

    it('delegates to custom handler', async () => {
      const handler = vi.fn().mockReturnValue(makeState({ currentStep: 'custom-plan' }));
      const result = await runManagerPlanNode(makeState(), { managerPlan: handler });
      expect(result.currentStep).toBe('custom-plan');
    });
  });

  describe('runDispatchNode', () => {
    it('uses default handler', async () => {
      const result = await runDispatchNode(makeState());
      expect(result.currentStep).toBe('dispatch');
    });

    it('delegates to custom handler', async () => {
      const handler = vi.fn().mockReturnValue(makeState({ currentStep: 'custom-dispatch' }));
      const result = await runDispatchNode(makeState(), { dispatch: handler });
      expect(result.currentStep).toBe('custom-dispatch');
    });
  });

  describe('runResearchNode', () => {
    it('uses default handler', async () => {
      const result = await runResearchNode(makeState());
      expect(result.currentStep).toBe('research');
    });

    it('delegates to custom handler', async () => {
      const handler = vi.fn().mockReturnValue(makeState({ currentStep: 'custom-research' }));
      const result = await runResearchNode(makeState(), { research: handler });
      expect(result.currentStep).toBe('custom-research');
    });
  });

  describe('runExecuteNode', () => {
    it('uses default handler with defaults', async () => {
      const result = await runExecuteNode(makeState());
      expect(result.currentStep).toBe('execute');
      expect(result.approvalStatus).toBe('approved');
    });

    it('sets pending approval when approvalRequired', async () => {
      const result = await runExecuteNode(makeState({ approvalRequired: true, approvalStatus: undefined }));
      expect(result.approvalStatus).toBe('pending');
    });

    it('preserves existing approval status when approvalRequired', async () => {
      const result = await runExecuteNode(makeState({ approvalRequired: true, approvalStatus: 'approved' }));
      expect(result.approvalStatus).toBe('approved');
    });

    it('delegates to custom handler', async () => {
      const handler = vi.fn().mockReturnValue(makeState({ currentStep: 'custom-execute' }));
      const result = await runExecuteNode(makeState(), { execute: handler });
      expect(result.currentStep).toBe('custom-execute');
    });
  });

  describe('runReviewNode', () => {
    it('uses default handler', async () => {
      const result = await runReviewNode(makeState());
      expect(result.currentStep).toBe('review');
      expect(result.shouldRetry).toBe(false);
    });

    it('delegates to custom handler', async () => {
      const handler = vi.fn().mockReturnValue(makeState({ currentStep: 'custom-review' }));
      const result = await runReviewNode(makeState(), { review: handler });
      expect(result.currentStep).toBe('custom-review');
    });
  });

  describe('runFinishNode', () => {
    it('uses default handler with default answer', async () => {
      const result = await runFinishNode(makeState());
      expect(result.currentStep).toBe('finish');
      expect(result.finalAnswer).toBe('LangGraph workflow completed.');
    });

    it('preserves existing finalAnswer', async () => {
      const result = await runFinishNode(makeState({ finalAnswer: 'Custom answer' }));
      expect(result.finalAnswer).toBe('Custom answer');
    });

    it('delegates to custom handler', async () => {
      const handler = vi.fn().mockReturnValue(makeState({ currentStep: 'custom-finish' }));
      const result = await runFinishNode(makeState(), { finish: handler });
      expect(result.currentStep).toBe('custom-finish');
    });
  });
});
