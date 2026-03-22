import { Annotation, StateGraph, START, END } from '@langchain/langgraph';

import {
  ActionIntent,
  ApprovalDecision,
  ApprovalStatus,
  DispatchInstruction,
  MemoryRecord,
  ReviewDecision,
  SkillCard,
  ToolExecutionResult
} from '@agent/shared';

export interface RuntimeAgentGraphState {
  taskId: string;
  goal: string;
  context?: string;
  constraints: string[];
  currentPlan: string[];
  currentStep?: string;
  toolIntent?: ActionIntent;
  approvalRequired: boolean;
  approvalStatus?: ApprovalStatus;
  observations: string[];
  retrievedMemories: MemoryRecord[];
  retrievedSkills: SkillCard[];
  evaluation?: unknown;
  reflection?: unknown;
  finalAnswer?: string;
  dispatches: DispatchInstruction[];
  researchSummary?: string;
  toolName?: string;
  executionSummary?: string;
  executionResult?: ToolExecutionResult;
  reviewDecision?: ReviewDecision;
  shouldRetry: boolean;
  retryCount: number;
  maxRetries: number;
  resumeFromApproval: boolean;
}

export interface AgentGraphHandlers {
  goalIntake?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  route?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  managerPlan?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  dispatch?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  research?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  execute?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  review?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
  finish?: (state: RuntimeAgentGraphState) => Promise<RuntimeAgentGraphState>;
}

const AgentAnnotation = Annotation.Root({
  taskId: Annotation<string>(),
  goal: Annotation<string>(),
  context: Annotation<string | undefined>(),
  constraints: Annotation<string[]>(),
  currentPlan: Annotation<string[]>(),
  currentStep: Annotation<string | undefined>(),
  toolIntent: Annotation<ActionIntent | undefined>(),
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
  executionSummary: Annotation<string | undefined>(),
  executionResult: Annotation<ToolExecutionResult | undefined>(),
  reviewDecision: Annotation<ReviewDecision | undefined>(),
  shouldRetry: Annotation<boolean>(),
  retryCount: Annotation<number>(),
  maxRetries: Annotation<number>(),
  resumeFromApproval: Annotation<boolean>()
});

export function createAgentGraph(handlers: AgentGraphHandlers = {}) {
  return new StateGraph(AgentAnnotation)
    .addNode('goal_intake', async state =>
      handlers.goalIntake
        ? handlers.goalIntake(state)
        : { ...state, currentStep: 'goal_intake', observations: [...state.observations, `goal:${state.goal}`] }
    )
    .addNode('route', async state =>
      handlers.route
        ? handlers.route(state)
        : {
            ...state,
            currentStep: 'route'
          }
    )
    .addNode('manager_plan', async state =>
      handlers.managerPlan
        ? handlers.managerPlan(state)
        : {
            ...state,
            currentStep: 'manager_plan',
            currentPlan: state.currentPlan.length > 0 ? state.currentPlan : ['research', 'execute', 'review'],
            shouldRetry: false
          }
    )
    .addNode('dispatch', async state =>
      handlers.dispatch ? handlers.dispatch(state) : { ...state, currentStep: 'dispatch' }
    )
    .addNode('research', async state =>
      handlers.research ? handlers.research(state) : { ...state, currentStep: 'research' }
    )
    .addNode('execute', async state =>
      handlers.execute
        ? handlers.execute(state)
        : {
            ...state,
            currentStep: 'execute',
            toolIntent: state.toolIntent ?? ActionIntent.READ_FILE,
            approvalStatus: state.approvalRequired ? (state.approvalStatus ?? 'pending') : ApprovalDecision.APPROVED
          }
    )
    .addNode('review', async state =>
      handlers.review ? handlers.review(state) : { ...state, currentStep: 'review', shouldRetry: false }
    )
    .addNode('finish', async state =>
      handlers.finish
        ? handlers.finish(state)
        : {
            ...state,
            currentStep: 'finish',
            finalAnswer: state.finalAnswer ?? 'LangGraph workflow completed.'
          }
    )
    .addEdge(START, 'goal_intake')
    .addEdge('goal_intake', 'route')
    .addConditionalEdges('route', state => (state.resumeFromApproval ? 'execute' : 'manager_plan'))
    .addEdge('manager_plan', 'dispatch')
    .addEdge('dispatch', 'research')
    .addEdge('research', 'execute')
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
    retryCount: 0,
    maxRetries: 1,
    resumeFromApproval: false
  };
}
