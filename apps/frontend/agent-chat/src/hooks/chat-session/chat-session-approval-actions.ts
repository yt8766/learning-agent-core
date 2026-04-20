import {
  approveSession,
  allowApprovalCapability,
  allowApprovalConnector,
  confirmLearning,
  rejectSession,
  respondInterrupt
} from '@/api/chat-api';
import type { CreateChatSessionActionsOptions } from './chat-session-actions.types';
import { insertOptimisticControlMessage } from './chat-session-control-actions';
import type { RunLoadingFn } from './chat-session-action-utils';

interface ApprovalActionDeps {
  options: CreateChatSessionActionsOptions;
  runLoading: RunLoadingFn;
  hydrateSessionSnapshot: (sessionId?: string, showLoading?: boolean) => Promise<unknown>;
}

export function createApprovalActions({ options, runLoading, hydrateSessionSnapshot }: ApprovalActionDeps) {
  const updateApproval = async (
    intent: string,
    approved: boolean,
    feedback?: string,
    approvalScope?: 'once' | 'session' | 'always'
  ) => {
    if (!options.activeSessionId) return;
    const task = approved
      ? () => approveSession(options.activeSessionId, intent, feedback, approvalScope)
      : () => rejectSession(options.activeSessionId, intent, feedback);
    const updated = await runLoading(task, '更新审批失败', { sessionId: options.activeSessionId });
    if (updated) await hydrateSessionSnapshot(options.activeSessionId, false);
  };

  const updatePlanInterrupt = async (params: {
    action: 'input' | 'bypass' | 'abort';
    interruptId?: string;
    answers?: Array<{
      questionId: string;
      optionId?: string;
      freeform?: string;
    }>;
  }) => {
    if (!options.activeSessionId) return;
    const endpoint = params.action === 'abort' ? 'reject' : 'approve';
    const updated = await runLoading(
      () =>
        respondInterrupt(options.activeSessionId, {
          endpoint,
          intent: 'plan_question',
          interrupt: {
            interruptId: params.interruptId,
            action: params.action,
            payload: params.answers
              ? { answers: params.answers, interactionKind: 'plan-question' }
              : { interactionKind: 'plan-question' }
          }
        }),
      '更新计划问题失败',
      { sessionId: options.activeSessionId }
    );
    if (updated) {
      if (params.action === 'abort') {
        insertOptimisticControlMessage(options, options.activeSessionId, '计划已取消');
      } else if (params.action === 'bypass') {
        insertOptimisticControlMessage(options, options.activeSessionId, '已按推荐项跳过计划，正在继续执行');
      } else {
        insertOptimisticControlMessage(options, options.activeSessionId, '已提交计划回答，正在更新方案');
      }
      await hydrateSessionSnapshot(options.activeSessionId, false);
    }
  };

  const allowApprovalAndApprove = async (params: { intent: string; capabilityId?: string; serverId?: string }) => {
    if (!options.activeSessionId) return;
    const updated = await runLoading(
      async () => {
        if (params.capabilityId && params.serverId) {
          await allowApprovalCapability(params.serverId, params.capabilityId);
        } else if (params.serverId) {
          await allowApprovalConnector(params.serverId);
        }
        return approveSession(options.activeSessionId, params.intent, undefined, 'always');
      },
      '更新授权策略失败',
      { sessionId: options.activeSessionId }
    );
    if (updated) await hydrateSessionSnapshot(options.activeSessionId, false);
  };

  const submitLearningConfirmation = async () => {
    if (!options.activeSessionId) return;
    const updated = await runLoading(() => confirmLearning(options.activeSessionId), '确认学习失败', {
      sessionId: options.activeSessionId
    });
    if (updated) await hydrateSessionSnapshot(options.activeSessionId, false);
  };

  return {
    updateApproval,
    updatePlanInterrupt,
    allowApprovalAndApprove,
    submitLearningConfirmation
  };
}
