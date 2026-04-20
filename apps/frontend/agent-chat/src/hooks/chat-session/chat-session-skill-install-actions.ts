import { getRemoteSkillInstallReceipt, installRemoteSkill } from '@/api/chat-api';
import type { ChatMessageRecord } from '@/types/chat';
import type { CreateChatSessionActionsOptions } from './chat-session-actions.types';
import { mapReceiptStatus } from './chat-session-control-action-helpers';
import { insertOptimisticControlMessage } from './chat-session-control-actions';

export function updateSkillSuggestionInstallState(
  options: CreateChatSessionActionsOptions,
  sessionId: string,
  suggestionId: string,
  installState: NonNullable<
    Extract<
      NonNullable<ChatMessageRecord['card']>,
      { type: 'skill_suggestions' }
    >['suggestions'][number]['installState']
  >
) {
  options.setMessages(current =>
    current.map(message => {
      if (message.sessionId !== sessionId || message.card?.type !== 'skill_suggestions') {
        return message;
      }

      const nextSuggestions = message.card.suggestions.map(item =>
        item.id === suggestionId
          ? {
              ...item,
              installState
            }
          : item
      );

      return {
        ...message,
        card: {
          ...message.card,
          suggestions: nextSuggestions
        }
      };
    })
  );
}

interface PollSkillInstallReceiptOptions {
  sessionId: string;
  suggestionId: string;
  receiptId: string;
  attempt?: number;
  hydrateSessionSnapshot: (sessionId: string, showLoading?: boolean) => Promise<unknown>;
  refreshCheckpointOnly: (sessionId: string) => Promise<unknown>;
}

export async function installSuggestedSkillAction(
  options: CreateChatSessionActionsOptions,
  params: {
    suggestion: Extract<NonNullable<ChatMessageRecord['card']>, { type: 'skill_suggestions' }>['suggestions'][number];
    runLoading: <T>(task: () => Promise<T>, fallbackMessage: string, withLoading?: boolean) => Promise<T | undefined>;
    refreshCheckpointOnly: (sessionId: string) => Promise<unknown>;
    hydrateSessionSnapshot: (sessionId: string, showLoading?: boolean) => Promise<unknown>;
  }
) {
  const repo = params.suggestion.repo;
  if (!options.activeSessionId || !repo) {
    return;
  }
  updateSkillSuggestionInstallState(options, options.activeSessionId, params.suggestion.id, {
    receiptId: '',
    status: 'requesting'
  });
  const receipt = await params.runLoading(
    () =>
      installRemoteSkill({
        repo,
        skillName: params.suggestion.skillName ?? params.suggestion.displayName,
        detailsUrl: params.suggestion.detailsUrl,
        installCommand: params.suggestion.installCommand,
        triggerReason: params.suggestion.triggerReason,
        summary: params.suggestion.summary
      }),
    '发起 Skill 安装失败'
  );
  if (!receipt) {
    updateSkillSuggestionInstallState(options, options.activeSessionId, params.suggestion.id, {
      receiptId: '',
      status: 'failed',
      failureCode: 'install_request_failed'
    });
    return;
  }

  updateSkillSuggestionInstallState(options, options.activeSessionId, params.suggestion.id, {
    receiptId: receipt.id,
    status: mapReceiptStatus(receipt.status, receipt.phase),
    phase: receipt.phase,
    result: receipt.result
  });

  insertOptimisticControlMessage(
    options,
    options.activeSessionId,
    receipt.status === 'pending'
      ? `已发起阻塞式中断确认：安装 ${params.suggestion.displayName}`
      : `已开始安装 Skill：${params.suggestion.displayName}`
  );
  if (receipt.status !== 'installed' && receipt.status !== 'failed' && receipt.status !== 'rejected') {
    void pollSkillInstallReceipt(options, {
      sessionId: options.activeSessionId,
      suggestionId: params.suggestion.id,
      receiptId: receipt.id,
      hydrateSessionSnapshot: params.hydrateSessionSnapshot,
      refreshCheckpointOnly: params.refreshCheckpointOnly
    });
  }
  await params.refreshCheckpointOnly(options.activeSessionId);
}

export async function pollSkillInstallReceipt(
  options: CreateChatSessionActionsOptions,
  params: PollSkillInstallReceiptOptions
): Promise<void> {
  const attempt = params.attempt ?? 0;
  if (attempt >= 40) {
    return;
  }

  try {
    const receipt = await getRemoteSkillInstallReceipt(params.receiptId);
    updateSkillSuggestionInstallState(options, params.sessionId, params.suggestionId, {
      receiptId: receipt.id,
      status: mapReceiptStatus(receipt.status, receipt.phase),
      phase: receipt.phase,
      result: receipt.result,
      failureCode: receipt.failureCode,
      failureDetail: receipt.failureDetail,
      installedAt: receipt.installedAt
    });

    if (receipt.status === 'installed') {
      insertOptimisticControlMessage(options, params.sessionId, 'Skill 已安装完成，后续当前会话可直接复用。');
      await params.hydrateSessionSnapshot(params.sessionId, false);
      return;
    }

    if (receipt.status === 'failed' || receipt.status === 'rejected') {
      insertOptimisticControlMessage(
        options,
        params.sessionId,
        receipt.status === 'rejected'
          ? 'Skill 安装申请已被拒绝。'
          : `Skill 安装失败：${receipt.failureCode ?? '请检查安装日志'}`
      );
      await params.refreshCheckpointOnly(params.sessionId);
      return;
    }

    window.setTimeout(
      () => {
        void pollSkillInstallReceipt(options, {
          ...params,
          attempt: attempt + 1
        });
      },
      receipt.status === 'pending' ? 2000 : 1000
    );
  } catch (error) {
    if (attempt >= 5) {
      updateSkillSuggestionInstallState(options, params.sessionId, params.suggestionId, {
        receiptId: params.receiptId,
        status: 'failed',
        failureCode: error instanceof Error ? error.message : 'receipt_poll_failed'
      });
      return;
    }
    window.setTimeout(() => {
      void pollSkillInstallReceipt(options, {
        ...params,
        attempt: attempt + 1
      });
    }, 1200);
  }
}
