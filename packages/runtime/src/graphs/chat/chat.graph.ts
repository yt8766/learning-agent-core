import { Annotation, StateGraph, START, END } from '@langchain/langgraph';

import {
  ActionIntent,
  type ApprovalStatus,
  type DispatchInstruction,
  type MemoryRecord,
  type ReviewDecision,
  type SkillCard,
  type ToolExecutionResult,
  type AgentGraphHandlers,
  type RuntimeAgentGraphState
} from '@agent/core';
import {
  runDispatchNode,
  runExecuteNode,
  runFinishNode,
  runGoalIntakeNode,
  runManagerPlanNode,
  runResearchNode,
  runReviewNode,
  runRouteNode
} from '../../flows/chat/chat-graph-nodes';

type ActionIntentValue = (typeof ActionIntent)[keyof typeof ActionIntent];

const AgentAnnotation = Annotation.Root({
  taskId: Annotation<string>(),
  goal: Annotation<string>(),
  context: Annotation<string | undefined>(),
  constraints: Annotation<string[]>(),
  currentPlan: Annotation<string[]>(),
  currentStep: Annotation<string | undefined>(),
  toolIntent: Annotation<ActionIntentValue | undefined>(),
  approvalRequired: Annotation<boolean>(),
  approvalStatus: Annotation<ApprovalStatus | undefined>(),
  observations: Annotation<string[]>(),
  retrievedMemories: Annotation<MemoryRecord[]>(),
  retrievedSkills: Annotation<SkillCard[]>(),
  evaluation: Annotation<unknown>(),
  reflection: Annotation<unknown>(),
  finalAnswer: Annotation<string | undefined>(),
  dispatches: Annotation<DispatchInstruction[]>(),
  researchSummary: Annotation<string | undefined>(),
  toolName: Annotation<string | undefined>(),
  pendingToolInput: Annotation<Record<string, unknown> | undefined>(),
  executionSummary: Annotation<string | undefined>(),
  executionResult: Annotation<ToolExecutionResult | undefined>(),
  reviewDecision: Annotation<ReviewDecision | undefined>(),
  shouldRetry: Annotation<boolean>(),
  terminateAfterPlanning: Annotation<boolean | undefined>(),
  retryCount: Annotation<number>(),
  maxRetries: Annotation<number>(),
  resumeFromApproval: Annotation<boolean>()
});

export function createAgentGraph(handlers: AgentGraphHandlers = {}) {
  return new StateGraph(AgentAnnotation)
    .addNode('goal_intake', state => runGoalIntakeNode(state, handlers))
    .addNode('route', state => runRouteNode(state, handlers))
    .addNode('manager_plan', state => runManagerPlanNode(state, handlers))
    .addNode('dispatch', state => runDispatchNode(state, handlers))
    .addNode('research', state => runResearchNode(state, handlers))
    .addNode('execute', state => runExecuteNode(state, handlers))
    .addNode('review', state => runReviewNode(state, handlers))
    .addNode('finish', state => runFinishNode(state, handlers))
    .addEdge(START, 'goal_intake')
    .addEdge('goal_intake', 'route')
    .addConditionalEdges('route', state => (state.resumeFromApproval ? 'execute' : 'manager_plan'))
    .addConditionalEdges('manager_plan', state => (state.terminateAfterPlanning ? 'finish' : 'dispatch'))
    .addEdge('dispatch', 'research')
    .addConditionalEdges('research', state =>
      state.approvalRequired && state.approvalStatus === 'pending' ? 'finish' : 'execute'
    )
    .addConditionalEdges('execute', state =>
      state.approvalRequired && state.approvalStatus === 'pending' ? 'finish' : 'review'
    )
    .addConditionalEdges('review', state =>
      state.shouldRetry && state.retryCount <= state.maxRetries ? 'manager_plan' : 'finish'
    )
    .addEdge('finish', END);
}

export function createInitialState(taskId: string, goal: string, context?: string): RuntimeAgentGraphState {
  return {
    taskId,
    goal,
    context,
    constraints: [],
    currentPlan: [],
    approvalRequired: false,
    observations: [],
    retrievedMemories: [],
    retrievedSkills: [],
    dispatches: [],
    shouldRetry: false,
    terminateAfterPlanning: false,
    retryCount: 0,
    maxRetries: 1,
    resumeFromApproval: false
  };
}
