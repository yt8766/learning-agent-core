import type { ChatCheckpointRecord, ExecutionStepRecord } from '@agent/core';

import type { SessionCoordinatorStore } from './session-coordinator-store';
import type { SessionCoordinatorThinking } from './session-coordinator-thinking';
import type { SessionTaskAggregate } from '../session-task.types';

export function updateCheckpoint(
  checkpoint: ChatCheckpointRecord,
  channelIdentity: ChatCheckpointRecord['channelIdentity'],
  task: SessionTaskAggregate,
  thinking: SessionCoordinatorThinking,
  messageId?: string
) {
  checkpoint.taskId = task.id;
  checkpoint.channelIdentity = channelIdentity;
  checkpoint.context = task.context;
  checkpoint.runId = task.runId;
  checkpoint.traceId = task.traceId;
  checkpoint.skillId = task.skillId;
  checkpoint.skillStage = task.skillStage;
  checkpoint.resolvedWorkflow = task.resolvedWorkflow;
  checkpoint.subgraphTrail = task.subgraphTrail as ChatCheckpointRecord['subgraphTrail'];
  checkpoint.currentNode = task.currentNode;
  checkpoint.currentMinistry = task.currentMinistry;
  checkpoint.currentWorker = task.currentWorker;
  checkpoint.specialistLead = task.specialistLead;
  checkpoint.supportingSpecialists = task.supportingSpecialists;
  checkpoint.specialistFindings = task.specialistFindings;
  checkpoint.routeConfidence = task.routeConfidence;
  checkpoint.plannerStrategy = task.plannerStrategy;
  checkpoint.contextSlicesBySpecialist =
    task.contextSlicesBySpecialist as ChatCheckpointRecord['contextSlicesBySpecialist'];
  checkpoint.dispatches = task.dispatches;
  checkpoint.critiqueResult = task.critiqueResult;
  checkpoint.chatRoute = task.chatRoute;
  checkpoint.executionSteps = task.executionSteps;
  checkpoint.currentExecutionStep = task.currentExecutionStep;
  checkpoint.queueState = task.queueState;
  checkpoint.pendingAction = task.pendingAction;
  checkpoint.pendingApproval = task.pendingApproval;
  checkpoint.activeInterrupt = task.activeInterrupt;
  checkpoint.interruptHistory = task.interruptHistory;
  checkpoint.entryDecision = task.entryDecision;
  checkpoint.executionPlan = task.executionPlan;
  checkpoint.budgetGateState = task.budgetGateState;
  checkpoint.complexTaskPlan = task.complexTaskPlan;
  checkpoint.blackboardState = task.blackboardState;
  checkpoint.planMode = task.planMode;
  checkpoint.executionMode =
    task.executionMode ??
    task.executionPlan?.mode ??
    (task.planMode && task.planMode !== 'finalized' && task.planMode !== 'aborted' ? 'plan' : 'execute');
  checkpoint.planModeTransitions = task.planModeTransitions;
  checkpoint.planDraft = task.planDraft;
  checkpoint.approvalFeedback = task.approvalFeedback;
  checkpoint.modelRoute = task.modelRoute;
  checkpoint.externalSources = task.externalSources;
  checkpoint.reusedMemories = task.reusedMemories;
  checkpoint.reusedRules = task.reusedRules;
  checkpoint.reusedSkills = task.reusedSkills;
  checkpoint.usedInstalledSkills = task.usedInstalledSkills;
  checkpoint.usedCompanyWorkers = task.usedCompanyWorkers;
  checkpoint.connectorRefs = task.connectorRefs;
  checkpoint.requestedHints = task.requestedHints;
  checkpoint.capabilityAugmentations = task.capabilityAugmentations;
  checkpoint.capabilityAttachments = task.capabilityAttachments;
  checkpoint.currentSkillExecution = task.currentSkillExecution;
  checkpoint.learningEvaluation = task.learningEvaluation;
  checkpoint.governanceScore = task.governanceScore;
  checkpoint.governanceReport = task.governanceReport;
  checkpoint.skillSearch = task.skillSearch;
  checkpoint.budgetState = task.budgetState;
  checkpoint.guardrailState = task.guardrailState;
  checkpoint.criticState = task.criticState;
  checkpoint.sandboxState = task.sandboxState;
  checkpoint.knowledgeIngestionState = task.knowledgeIngestionState;
  checkpoint.knowledgeIndexState = task.knowledgeIndexState;
  checkpoint.llmUsage = task.llmUsage;
  checkpoint.recoverability = task.pendingApproval || task.activeInterrupt ? 'partial' : 'safe';
  checkpoint.traceCursor = task.trace.length;
  checkpoint.messageCursor = task.messages.length;
  checkpoint.approvalCursor = task.approvals.length;
  checkpoint.learningCursor = task.learningCandidates?.length ?? 0;
  checkpoint.graphState = {
    status: task.status,
    currentStep: task.currentStep,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    revisionCount: task.revisionCount,
    maxRevisions: task.maxRevisions,
    microLoopCount: task.microLoopCount,
    maxMicroLoops: task.maxMicroLoops,
    microLoopState: task.microLoopState,
    revisionState: task.revisionState
  };
  checkpoint.pendingApprovals =
    task.pendingApproval && task.pendingApproval.intent
      ? task.approvals.filter(
          approval => approval.decision === 'pending' && approval.intent === task.pendingApproval?.intent
        )
      : [];
  checkpoint.agentStates = task.agentStates;
  checkpoint.thoughtChain = thinking.buildThoughtChain(task, messageId);
  checkpoint.thinkState = thinking.buildThinkState(task, messageId);
  checkpoint.thoughtGraph = thinking.buildThoughtGraph(task, checkpoint);
  checkpoint.updatedAt = new Date().toISOString();
}

export function emitExecutionStepEvents(
  store: SessionCoordinatorStore,
  sessionId: string,
  task: SessionTaskAggregate,
  previousExecutionSteps: ExecutionStepRecord[]
) {
  const previousById = new Map(previousExecutionSteps.map(step => [step.id, step]));
  for (const step of task.executionSteps ?? []) {
    const previous = previousById.get(step.id);
    if (!previous) {
      store.addEvent(
        sessionId,
        resolveExecutionStepEventType(undefined, step.status),
        buildExecutionStepPayload(task, step)
      );
      continue;
    }
    if (
      previous.status !== step.status ||
      previous.detail !== step.detail ||
      previous.reason !== step.reason ||
      previous.completedAt !== step.completedAt
    ) {
      store.addEvent(
        sessionId,
        resolveExecutionStepEventType(previous.status, step.status),
        buildExecutionStepPayload(task, step)
      );
    }
  }
}

function resolveExecutionStepEventType(
  previousStatus: ExecutionStepRecord['status'] | undefined,
  nextStatus: ExecutionStepRecord['status']
) {
  if (nextStatus === 'completed') {
    return 'execution_step_completed' as const;
  }
  if (nextStatus === 'blocked') {
    return 'execution_step_blocked' as const;
  }
  if (nextStatus === 'running' && previousStatus === 'blocked') {
    return 'execution_step_resumed' as const;
  }
  return 'execution_step_started' as const;
}

function buildExecutionStepPayload(task: SessionTaskAggregate, step: ExecutionStepRecord) {
  return {
    taskId: task.id,
    route: step.route,
    stage: step.stage,
    label: step.label,
    owner: step.owner,
    status: step.status,
    detail: step.detail,
    reason: step.reason,
    startedAt: step.startedAt,
    completedAt: step.completedAt
  };
}
