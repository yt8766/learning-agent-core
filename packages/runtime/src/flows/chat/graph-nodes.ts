import { ActionIntent, ApprovalDecision } from '@agent/shared';

import type { AgentGraphHandlers, RuntimeAgentGraphState } from '@agent/core';

export async function runGoalIntakeNode(
  state: RuntimeAgentGraphState,
  handlers: AgentGraphHandlers = {}
): Promise<RuntimeAgentGraphState> {
  return handlers.goalIntake
    ? handlers.goalIntake(state)
    : { ...state, currentStep: 'goal_intake', observations: [...state.observations, `goal:${state.goal}`] };
}

export async function runRouteNode(
  state: RuntimeAgentGraphState,
  handlers: AgentGraphHandlers = {}
): Promise<RuntimeAgentGraphState> {
  return handlers.route
    ? handlers.route(state)
    : {
        ...state,
        currentStep: 'route'
      };
}

export async function runManagerPlanNode(
  state: RuntimeAgentGraphState,
  handlers: AgentGraphHandlers = {}
): Promise<RuntimeAgentGraphState> {
  return handlers.managerPlan
    ? handlers.managerPlan(state)
    : {
        ...state,
        currentStep: 'manager_plan',
        currentPlan: state.currentPlan.length > 0 ? state.currentPlan : ['research', 'execute', 'review'],
        shouldRetry: false,
        terminateAfterPlanning: false
      };
}

export async function runDispatchNode(
  state: RuntimeAgentGraphState,
  handlers: AgentGraphHandlers = {}
): Promise<RuntimeAgentGraphState> {
  return handlers.dispatch ? handlers.dispatch(state) : { ...state, currentStep: 'dispatch' };
}

export async function runResearchNode(
  state: RuntimeAgentGraphState,
  handlers: AgentGraphHandlers = {}
): Promise<RuntimeAgentGraphState> {
  return handlers.research ? handlers.research(state) : { ...state, currentStep: 'research' };
}

export async function runExecuteNode(
  state: RuntimeAgentGraphState,
  handlers: AgentGraphHandlers = {}
): Promise<RuntimeAgentGraphState> {
  return handlers.execute
    ? handlers.execute(state)
    : {
        ...state,
        currentStep: 'execute',
        toolIntent: state.toolIntent ?? ActionIntent.READ_FILE,
        approvalStatus: state.approvalRequired ? (state.approvalStatus ?? 'pending') : ApprovalDecision.APPROVED
      };
}

export async function runReviewNode(
  state: RuntimeAgentGraphState,
  handlers: AgentGraphHandlers = {}
): Promise<RuntimeAgentGraphState> {
  return handlers.review ? handlers.review(state) : { ...state, currentStep: 'review', shouldRetry: false };
}

export async function runFinishNode(
  state: RuntimeAgentGraphState,
  handlers: AgentGraphHandlers = {}
): Promise<RuntimeAgentGraphState> {
  return handlers.finish
    ? handlers.finish(state)
    : {
        ...state,
        currentStep: 'finish',
        finalAnswer: state.finalAnswer ?? 'LangGraph workflow completed.'
      };
}
