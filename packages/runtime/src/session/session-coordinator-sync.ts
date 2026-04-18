import type { ChatCheckpointRecord, ExecutionStepRecord } from '@agent/core';
import { TaskStatus } from '@agent/core';

import { TASK_MESSAGE_EVENT_MAP, TRACE_EVENT_MAP } from '../utils/event-maps';
import type { AgentRoleValue as AgentRole } from './session-architecture-helpers';
import type { SessionCoordinatorStore } from './session-coordinator-store';
import type { SessionCoordinatorThinking } from './session-coordinator-thinking';
import { emitNodeStatusEvent } from './session-node-events';
import type { SessionTaskAggregate } from './session-task.types';

const CHAT_VISIBLE_MESSAGE_TYPES = new Set(['summary']);
const PROGRESS_STREAM_MESSAGE_PREFIX = 'progress_stream_';

function findStreamingAssistantMessage(
  sessionMessages: ReturnType<SessionCoordinatorStore['getMessages']>,
  taskId: string
) {
  const candidateIds = new Set([
    `${PROGRESS_STREAM_MESSAGE_PREFIX}${taskId}`,
    `direct_reply_${taskId}`,
    `summary_stream_${taskId}`
  ]);

  return sessionMessages.find(
    message => message.role === 'assistant' && Boolean(message.content.trim()) && candidateIds.has(message.id)
  );
}

function bindAssistantResultMessage(
  store: SessionCoordinatorStore,
  sessionId: string,
  sessionMessages: ReturnType<SessionCoordinatorStore['getMessages']>,
  task: SessionTaskAggregate,
  content: string,
  linkedAgent?: AgentRole
) {
  const normalizedContent = content.trim();
  if (!normalizedContent) {
    return undefined;
  }

  const existingExact = sessionMessages.find(
    message => message.role === 'assistant' && message.taskId === task.id && message.content === normalizedContent
  );
  if (existingExact) {
    existingExact.taskId = task.id;
    if (linkedAgent) {
      existingExact.linkedAgent = linkedAgent;
    }
    return existingExact;
  }

  const streamingMessage = findStreamingAssistantMessage(sessionMessages, task.id);
  if (streamingMessage) {
    const currentContent = streamingMessage.content.trim();
    if (
      !currentContent ||
      normalizedContent.startsWith(currentContent) ||
      currentContent.startsWith(normalizedContent)
    ) {
      streamingMessage.content = normalizedContent;
      streamingMessage.taskId = task.id;
      if (linkedAgent) {
        streamingMessage.linkedAgent = linkedAgent;
      }
      return streamingMessage;
    }
  }

  return store.addMessage(sessionId, 'assistant', normalizedContent, linkedAgent, undefined, task.id);
}

export function syncCoordinatorTask(
  store: SessionCoordinatorStore,
  thinking: SessionCoordinatorThinking,
  sessionId: string,
  task: SessionTaskAggregate,
  ensureLearningCandidates: (task: SessionTaskAggregate) => void,
  onAutoConfirmLearning: (sessionId: string, task: SessionTaskAggregate) => void
): void {
  const session = store.requireSession(sessionId);
  // task.activeInterrupt / task.interruptHistory are persisted 司礼监 / InterruptController projections.
  // task.entryDecision is the persisted 通政司 / EntryRouter projection.
  if ((!task.learningCandidates || task.learningCandidates.length === 0) && task.review) {
    ensureLearningCandidates(task);
  }

  session.currentTaskId = task.id;
  session.updatedAt = new Date().toISOString();

  const checkpoint = store.getCheckpoint(sessionId) ?? store.createCheckpoint(sessionId, task.id);
  const previousNode = checkpoint.currentNode;
  const previousExecutionSteps = checkpoint.executionSteps ?? [];
  if (checkpoint.taskId && checkpoint.taskId !== task.id) {
    checkpoint.traceCursor = 0;
    checkpoint.messageCursor = 0;
    checkpoint.approvalCursor = 0;
    checkpoint.learningCursor = 0;
  }
  const sessionMessages = store.getMessages(sessionId);

  if (task.currentNode && task.currentNode !== previousNode) {
    emitNodeStatusEvent(store, sessionId, {
      task,
      checkpoint,
      nodeId: task.currentNode,
      phase: 'start',
      detail: task.currentStep ?? task.currentNode
    });
  }

  emitExecutionStepEvents(store, sessionId, task, previousExecutionSteps);

  for (const trace of task.trace.slice(checkpoint.traceCursor)) {
    if (trace.node === 'approval_gate' || trace.node === 'approval_rejected_with_feedback') {
      continue;
    }
    const type = TRACE_EVENT_MAP[trace.node];
    if (!type) continue;
    store.addEvent(sessionId, type, {
      taskId: task.id,
      node: trace.node,
      summary: trace.summary,
      data: trace.data ?? {}
    });
    emitNodeStatusEvent(store, sessionId, {
      task,
      checkpoint,
      nodeId: trace.node,
      phase: 'end',
      detail: trace.summary
    });
  }

  let hasAssistantResult = sessionMessages.some(
    message => message.role === 'assistant' && message.content === task.result
  );

  for (const taskMessage of task.messages.slice(checkpoint.messageCursor)) {
    if (taskMessage.type === 'summary_delta') {
      const progressMessageId = `${PROGRESS_STREAM_MESSAGE_PREFIX}${task.id}`;
      store.appendStreamingMessage(
        sessionId,
        progressMessageId,
        taskMessage.content,
        taskMessage.from,
        taskMessage.createdAt
      );
      store.addEvent(sessionId, 'assistant_token', {
        taskId: task.id,
        messageId: progressMessageId,
        content: taskMessage.content,
        from: taskMessage.from,
        summary: taskMessage.content
      });
      emitNodeStatusEvent(store, sessionId, {
        task,
        checkpoint,
        nodeId: task.currentNode ?? task.currentStep,
        phase: 'progress',
        detail: taskMessage.content
      });
      continue;
    }

    store.addEvent(sessionId, TASK_MESSAGE_EVENT_MAP[taskMessage.type], {
      taskId: task.id,
      messageType: taskMessage.type,
      from: taskMessage.from,
      to: taskMessage.to,
      content: taskMessage.content,
      summary: taskMessage.content
    });

    if (!CHAT_VISIBLE_MESSAGE_TYPES.has(taskMessage.type)) {
      continue;
    }

    const assistantMessage = bindAssistantResultMessage(
      store,
      sessionId,
      sessionMessages,
      task,
      taskMessage.content,
      taskMessage.from
    );
    if (task.result && assistantMessage?.content === task.result) {
      hasAssistantResult = true;
    }
  }

  for (const approval of task.approvals.slice(checkpoint.approvalCursor)) {
    const isCurrentPendingApproval =
      approval.decision === 'pending' &&
      (task.pendingApproval?.intent === approval.intent ||
        task.pendingAction?.intent === approval.intent ||
        (task.activeInterrupt?.kind === 'user-input' && approval.intent === 'plan_question'));
    if (approval.decision === 'pending' && !isCurrentPendingApproval) {
      continue;
    }

    const pendingApproval = isCurrentPendingApproval
      ? task.pendingApproval?.intent === approval.intent
        ? task.pendingApproval
        : task.pendingAction?.intent === approval.intent
          ? task.pendingAction
          : undefined
      : undefined;
    const approvalPreview = pendingApproval && 'preview' in pendingApproval ? pendingApproval.preview : undefined;
    const approvalServerId = pendingApproval && 'serverId' in pendingApproval ? pendingApproval.serverId : undefined;
    const approvalCapabilityId =
      pendingApproval && 'capabilityId' in pendingApproval ? pendingApproval.capabilityId : undefined;
    const eventType =
      approval.decision === 'pending'
        ? task.activeInterrupt
          ? 'interrupt_pending'
          : 'approval_required'
        : 'approval_resolved';
    store.addEvent(sessionId, eventType, {
      taskId: task.id,
      intent: approval.intent,
      decision: approval.decision,
      reason: approval.reason,
      reasonCode: pendingApproval && 'reasonCode' in pendingApproval ? pendingApproval.reasonCode : undefined,
      actor: approval.actor,
      riskLevel: pendingApproval?.riskLevel,
      requestedBy: pendingApproval?.requestedBy,
      toolName: pendingApproval?.toolName,
      serverId: approvalServerId,
      capabilityId: approvalCapabilityId,
      preview: approvalPreview,
      interruptId: task.activeInterrupt?.id,
      interruptSource: task.activeInterrupt?.source,
      interruptMode: task.activeInterrupt?.mode,
      resumeStrategy: task.activeInterrupt?.resumeStrategy,
      interactionKind:
        task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
          ? (task.activeInterrupt.payload as { interactionKind?: unknown }).interactionKind
          : undefined,
      questionSet:
        task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
          ? (task.activeInterrupt.payload as { questionSet?: unknown }).questionSet
          : undefined,
      questions:
        task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
          ? (task.activeInterrupt.payload as { questions?: unknown }).questions
          : undefined,
      defaultAssumption:
        task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object'
          ? (task.activeInterrupt.payload as { defaultAssumption?: unknown }).defaultAssumption
          : undefined
    });
  }

  const progressStreamMessageId = `${PROGRESS_STREAM_MESSAGE_PREFIX}${task.id}`;
  const progressStreamMessage = sessionMessages.find(
    message => message.id === progressStreamMessageId && message.role === 'assistant' && Boolean(message.content.trim())
  );
  let boundAssistantMessageId =
    task.status === TaskStatus.RUNNING ? `${PROGRESS_STREAM_MESSAGE_PREFIX}${task.id}` : undefined;
  if (progressStreamMessage && task.result && progressStreamMessage.content === task.result) {
    hasAssistantResult = true;
    boundAssistantMessageId = progressStreamMessage.id;
  }
  if (task.status === TaskStatus.CANCELLED && progressStreamMessage && !hasAssistantResult) {
    progressStreamMessage.taskId = task.id;
    const assistantMessage = progressStreamMessage;
    boundAssistantMessageId = assistantMessage.id;
    hasAssistantResult = true;
    store.addEvent(sessionId, 'assistant_message', {
      taskId: task.id,
      messageId: assistantMessage.id,
      content: assistantMessage.content,
      summary: assistantMessage.content
    });
  }
  if (task.result && !hasAssistantResult && task.status !== TaskStatus.CANCELLED) {
    const assistantMessage =
      bindAssistantResultMessage(store, sessionId, sessionMessages, task, task.result) ??
      store.addMessage(sessionId, 'assistant', task.result, undefined, undefined, task.id);
    boundAssistantMessageId = assistantMessage.id;
    hasAssistantResult = true;
    store.addEvent(sessionId, 'assistant_message', {
      taskId: task.id,
      messageId: assistantMessage.id,
      content: assistantMessage.content,
      summary: assistantMessage.content
    });
  }

  updateCheckpoint(checkpoint, session.channelIdentity, task, thinking, boundAssistantMessageId);
  store.checkpoints.set(sessionId, checkpoint);

  if (task.status === TaskStatus.WAITING_APPROVAL) {
    session.status = task.activeInterrupt?.kind === 'user-input' ? 'waiting_interrupt' : 'waiting_approval';
    return;
  }
  if (task.status === TaskStatus.CANCELLED) {
    session.status = 'cancelled';
    return;
  }
  if (task.status === TaskStatus.FAILED || task.status === TaskStatus.BLOCKED) {
    session.status = 'failed';
    return;
  }
  if (task.status === TaskStatus.COMPLETED) {
    session.status = 'completed';
    onAutoConfirmLearning(sessionId, task);
    return;
  }
  session.status = 'running';
}

function updateCheckpoint(
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

function emitExecutionStepEvents(
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
