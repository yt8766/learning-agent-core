import { ApprovalDecision, TaskStatus } from '@agent/core';
import type { ChatSessionRecord, SessionApprovalDto } from '@agent/core';
import type { RuntimeStateRepository } from '@agent/memory';

import type { AgentOrchestrator } from '../../orchestration/agent-orchestrator';
import { matchesApprovalScopePolicy, type ApprovalScopePolicyRecord } from '../../contracts/governance';
import {
  buildApprovalScopeMatchInput,
  findRuntimeApprovalScopePolicy,
  persistApprovalScopePolicy,
  recordPolicyAutoAllow
} from './session-coordinator-approval-policy';
import type { SessionCoordinatorStore } from './session-coordinator-store';
import type { SessionTaskAggregate, SessionTaskLike } from '../session-task.types';

type ChatEventType =
  | 'run_cancelled'
  | 'interrupt_resumed'
  | 'approval_resolved'
  | 'interrupt_rejected_with_feedback'
  | 'approval_rejected_with_feedback';

export function resolveApprovalEventType(
  decision: (typeof ApprovalDecision)[keyof typeof ApprovalDecision],
  currentTask: SessionTaskLike | undefined,
  dto: SessionApprovalDto
): ChatEventType {
  if (decision === ApprovalDecision.APPROVED) {
    if (dto.interrupt?.action === 'abort' || currentTask?.status === TaskStatus.CANCELLED) {
      return 'run_cancelled';
    }
    return currentTask?.activeInterrupt ? 'interrupt_resumed' : 'approval_resolved';
  }

  if (dto.interrupt?.action === 'abort') {
    return 'run_cancelled';
  }
  if (currentTask?.activeInterrupt && dto.feedback) {
    return 'interrupt_rejected_with_feedback';
  }
  if (dto.feedback) {
    return 'approval_rejected_with_feedback';
  }
  return currentTask?.activeInterrupt ? 'interrupt_resumed' : 'approval_resolved';
}

export function resolveApprovalInteractionKind(task: SessionTaskLike, dto: SessionApprovalDto): unknown {
  if (task.activeInterrupt?.payload && typeof task.activeInterrupt.payload === 'object') {
    return (task.activeInterrupt.payload as { interactionKind?: unknown }).interactionKind;
  }
  if (dto.interrupt?.payload && typeof dto.interrupt.payload === 'object') {
    return (dto.interrupt.payload as { interactionKind?: unknown }).interactionKind;
  }
  return undefined;
}

export async function resolveSessionAutoApprovalPolicy(
  runtimeStateRepository: RuntimeStateRepository,
  session: ChatSessionRecord,
  task: SessionTaskLike
): Promise<
  | {
      actor: string;
      reason: string;
      policyRecord?: ApprovalScopePolicyRecord;
      source?: 'session' | 'always';
    }
  | undefined
> {
  if (task.status !== TaskStatus.WAITING_APPROVAL || !task.pendingApproval?.intent) {
    return undefined;
  }

  const sessionPolicy = (session.approvalPolicies?.sessionAllowRules ?? []).find(policy =>
    matchesApprovalScopePolicy(policy, buildApprovalScopeMatchInput(task))
  );
  if (sessionPolicy) {
    return {
      actor: 'agent-chat-session-policy',
      reason: 'session approval scope policy auto allow',
      policyRecord: sessionPolicy,
      source: 'session'
    };
  }

  const runtimePolicy = await findRuntimeApprovalScopePolicy(runtimeStateRepository, task);
  if (runtimePolicy) {
    return {
      actor: 'agent-runtime-approval-policy',
      reason: 'runtime approval scope policy auto allow',
      policyRecord: runtimePolicy,
      source: 'always'
    };
  }

  if (!session.channelIdentity) {
    return {
      actor: 'agent-chat-auto-approve',
      reason: 'agent-chat default auto approval'
    };
  }

  return undefined;
}

export async function bindSessionCoordinatorSubscriptions(params: {
  orchestrator: AgentOrchestrator;
  store: SessionCoordinatorStore;
  runtimeStateRepository: RuntimeStateRepository;
  autoApprovingTaskIds: Set<string>;
  syncTask: (sessionId: string, task: SessionTaskAggregate) => void;
}) {
  params.orchestrator.subscribe(task => {
    if (!task.sessionId || !params.store.sessions.has(task.sessionId)) {
      return;
    }
    void (async () => {
      const session = params.store.getSession(task.sessionId!);
      const autoApprovalPolicy = session
        ? await resolveSessionAutoApprovalPolicy(params.runtimeStateRepository, session, task)
        : undefined;
      if (session && autoApprovalPolicy && !params.autoApprovingTaskIds.has(task.id)) {
        params.autoApprovingTaskIds.add(task.id);
        try {
          const approvedTask = await params.orchestrator.applyApproval(
            task.id,
            {
              intent: task.pendingApproval!.intent,
              actor: autoApprovalPolicy.actor,
              reason: autoApprovalPolicy.reason
            },
            ApprovalDecision.APPROVED
          );
          if (autoApprovalPolicy.policyRecord) {
            await recordPolicyAutoAllow({
              runtimeStateRepository: params.runtimeStateRepository,
              session,
              policy: autoApprovalPolicy.policyRecord,
              task
            });
          }
          if (approvedTask?.sessionId) {
            params.syncTask(approvedTask.sessionId, approvedTask);
            await params.store.persistRuntimeState();
            return;
          }
        } finally {
          params.autoApprovingTaskIds.delete(task.id);
        }
      }

      params.syncTask(task.sessionId!, task);
      await params.store.persistRuntimeState();
    })();
  });

  params.orchestrator.subscribeTokens(tokenEvent => {
    const task = params.orchestrator.getTask(tokenEvent.taskId);
    if (!task?.sessionId || !params.store.sessions.has(task.sessionId)) {
      return;
    }

    params.store.appendStreamingMessage(
      task.sessionId,
      tokenEvent.messageId,
      tokenEvent.token,
      tokenEvent.role,
      tokenEvent.createdAt
    );
    params.store.addEvent(task.sessionId, 'assistant_token', {
      taskId: tokenEvent.taskId,
      messageId: tokenEvent.messageId,
      content: tokenEvent.token,
      from: tokenEvent.role,
      model: tokenEvent.model,
      summary: tokenEvent.token
    });
    void params.store.persistRuntimeState();
  });
}

export async function persistSessionApprovalScopePolicy(params: {
  runtimeStateRepository: RuntimeStateRepository;
  session: ChatSessionRecord;
  task: SessionTaskLike | undefined;
  dto: SessionApprovalDto;
}) {
  await persistApprovalScopePolicy(params);
}
