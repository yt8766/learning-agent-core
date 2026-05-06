import type { ChatCheckpointRecord, ChatThoughtChainItem } from '@/types/chat';

import {
  buildAdminRuntimeObservatoryUrl,
  buildApprovalsCenterExportUrl,
  buildBrowserReplayUrl,
  buildRuntimeCenterExportUrl
} from '@/api/chat-api';
import {
  buildCognitionDurationLabel,
  formatCognitionDurationLabelFromMs
} from '@/pages/chat/chat-message-adapter-helpers';

function getCheckpointInteractionKind(checkpoint?: ChatCheckpointRecord) {
  const payload = checkpoint?.activeInterrupt?.payload;
  if (
    payload &&
    typeof payload === 'object' &&
    typeof (payload as { interactionKind?: unknown }).interactionKind === 'string'
  ) {
    return (payload as { interactionKind: 'approval' | 'plan-question' | 'supplemental-input' }).interactionKind;
  }
  if (checkpoint?.activeInterrupt?.kind === 'user-input') {
    return 'plan-question';
  }
  if (checkpoint?.activeInterrupt || checkpoint?.pendingApproval) {
    return 'approval';
  }
  return undefined;
}

export function resolveCognitionTargetMessageId(
  checkpoint: ChatCheckpointRecord | undefined,
  thoughtChain: ChatThoughtChainItem[] | undefined
) {
  return checkpoint?.thinkState?.messageId ?? thoughtChain?.find(item => item.messageId)?.messageId ?? '';
}

export {
  buildCognitionDurationLabel,
  formatCognitionDurationLabelFromMs
} from '@/pages/chat/chat-message-adapter-helpers';

export function resolveNextCognitionExpansionPatch(params: {
  wasThinkLoading: boolean;
  isThinkLoading: boolean;
  hasCognitionTarget: boolean;
  isSessionRunning: boolean;
  cognitionTargetMessageId?: string;
}): Record<string, boolean> | undefined {
  const id = params.cognitionTargetMessageId;
  if (!id) {
    return undefined;
  }

  if (params.isThinkLoading) {
    return { [id]: true };
  }

  if (params.wasThinkLoading && params.hasCognitionTarget) {
    return { [id]: false };
  }

  if (params.hasCognitionTarget && !params.wasThinkLoading && !params.isSessionRunning) {
    return { [id]: false };
  }

  return undefined;
}

/** @deprecated 使用 resolveNextCognitionExpansionPatch 按 messageId 合并展开状态 */
export function resolveNextCognitionExpansion(params: {
  wasThinkLoading: boolean;
  isThinkLoading: boolean;
  hasCognitionTarget: boolean;
  isSessionRunning: boolean;
}) {
  if (params.isThinkLoading) {
    return true;
  }

  if (params.wasThinkLoading && params.hasCognitionTarget) {
    return false;
  }

  if (params.hasCognitionTarget && !params.wasThinkLoading && !params.isSessionRunning) {
    return false;
  }

  return undefined;
}

export function shouldShowErrorAlert(error: string, dismissedError: string, hasErrorCopy: boolean) {
  return Boolean(error && dismissedError !== error && hasErrorCopy);
}

export function shouldShowSessionHeaderActions(activeSessionId?: string) {
  return Boolean(activeSessionId);
}

export function getWorkbenchToggleLabel(showWorkbench: boolean) {
  return showWorkbench ? '收起工作区' : '打开工作区';
}

export function buildShareLinksText(urls: {
  runtimeUrl: string;
  approvalsUrl: string;
  observatoryUrl?: string;
  replayUrl?: string;
}) {
  return [
    '当前运行视角链接',
    `runtime: ${urls.runtimeUrl}`,
    `approvals: ${urls.approvalsUrl}`,
    urls.observatoryUrl ? `observatory: ${urls.observatoryUrl}` : undefined,
    urls.replayUrl ? `replay: ${urls.replayUrl}` : undefined
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildReplayDownloadFilename(sessionId: string) {
  return `browser-replay-${sessionId}.json`;
}

export function buildRuntimeExportRequest(checkpoint: ChatCheckpointRecord | undefined) {
  return {
    executionMode: checkpoint?.executionMode,
    interactionKind: getCheckpointInteractionKind(checkpoint),
    format: 'json' as const
  };
}

export function buildApprovalsExportRequest(checkpoint: ChatCheckpointRecord | undefined) {
  return {
    executionMode: checkpoint?.executionMode,
    interactionKind: getCheckpointInteractionKind(checkpoint),
    format: 'json' as const
  };
}

export function buildChatHomeShareLinks(checkpoint: ChatCheckpointRecord | undefined, activeSessionId?: string) {
  const interactionKind = getCheckpointInteractionKind(checkpoint);
  return {
    runtimeUrl: buildRuntimeCenterExportUrl({
      executionMode: checkpoint?.executionMode,
      interactionKind,
      format: 'json'
    }),
    approvalsUrl: buildApprovalsCenterExportUrl({
      executionMode: checkpoint?.executionMode,
      interactionKind,
      format: 'json'
    }),
    observatoryUrl: checkpoint?.taskId
      ? buildAdminRuntimeObservatoryUrl({
          taskId: checkpoint.taskId,
          executionMode: checkpoint?.executionMode,
          interactionKind
        })
      : '',
    replayUrl: activeSessionId ? buildBrowserReplayUrl(activeSessionId) : ''
  };
}

export function serializeBrowserReplay(replay: unknown) {
  return JSON.stringify(replay, null, 2);
}

export function openApprovalFeedbackState(intent: string, reason?: string) {
  return {
    feedbackIntent: intent,
    feedbackDraft: reason ?? ''
  };
}

export function resetApprovalFeedbackState() {
  return {
    feedbackIntent: '',
    feedbackDraft: ''
  };
}

export function resolveApprovalFeedbackSubmission(feedbackIntent: string, feedbackDraft: string) {
  if (!feedbackIntent) {
    return null;
  }

  return {
    intent: feedbackIntent,
    approved: false as const,
    reason: feedbackDraft.trim() || undefined
  };
}

export function buildDeleteSessionConfirmConfig(onConfirm: () => Promise<unknown>) {
  return {
    title: '删除当前会话？',
    content: '删除后，这个会话的聊天记录、事件流和检查点都会一并移除。',
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    onOk: onConfirm
  };
}

export function downloadTextFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
