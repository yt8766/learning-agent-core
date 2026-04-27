import type { ChatCheckpointRecord, ChatEventRecord, ChatThoughtChainItem } from '@/types/chat';

import {
  buildAdminRuntimeObservatoryUrl,
  buildApprovalsCenterExportUrl,
  buildBrowserReplayUrl,
  buildRuntimeCenterExportUrl
} from '@/api/chat-api';
import { getRuntimeDrawerExportFilters } from '@/features/runtime-panel/chat-runtime-drawer';
import { formatSessionTime } from '@/hooks/use-chat-session';
import { buildEventSummary } from './chat-home-helpers';

export function resolveCognitionTargetMessageId(
  checkpoint: ChatCheckpointRecord | undefined,
  thoughtChain: ChatThoughtChainItem[] | undefined
) {
  return checkpoint?.thinkState?.messageId ?? thoughtChain?.find(item => item.messageId)?.messageId ?? '';
}

export function buildCognitionDurationLabel(
  checkpoint: ChatCheckpointRecord | undefined,
  thoughtChain: ChatThoughtChainItem[] | undefined,
  thinkingNow: number
) {
  const durationMs =
    checkpoint?.thinkState?.thinkingDurationMs ??
    thoughtChain?.find(item => typeof item.thinkingDurationMs === 'number')?.thinkingDurationMs;
  if (typeof durationMs !== 'number') {
    return '';
  }

  const extraMs = checkpoint?.thinkState?.loading
    ? Math.max(0, thinkingNow - new Date(checkpoint.updatedAt).getTime())
    : 0;
  const seconds = Math.max(1, Math.round((durationMs + extraMs) / 1000));
  return checkpoint?.thinkState?.loading ? `${seconds}s` : `约 ${seconds} 秒`;
}

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

export function buildStreamEventItems(events: ChatEventRecord[]) {
  return events
    .slice()
    .reverse()
    .map(eventItem => ({
      id: eventItem.id,
      type: eventItem.type,
      summary: buildEventSummary(eventItem),
      at: formatSessionTime(eventItem.at),
      raw: JSON.stringify(eventItem.payload ?? {}, null, 2)
    }));
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
    ...getRuntimeDrawerExportFilters(checkpoint),
    format: 'json' as const
  };
}

export function buildApprovalsExportRequest(checkpoint: ChatCheckpointRecord | undefined) {
  return {
    ...getRuntimeDrawerExportFilters(checkpoint),
    format: 'json' as const
  };
}

export function buildChatHomeShareLinks(checkpoint: ChatCheckpointRecord | undefined, activeSessionId?: string) {
  const filters = getRuntimeDrawerExportFilters(checkpoint);
  return {
    runtimeUrl: buildRuntimeCenterExportUrl({ ...filters, format: 'json' }),
    approvalsUrl: buildApprovalsCenterExportUrl({ ...filters, format: 'json' }),
    observatoryUrl: checkpoint?.taskId
      ? buildAdminRuntimeObservatoryUrl({
          taskId: checkpoint.taskId,
          executionMode: filters.executionMode,
          interactionKind: filters.interactionKind
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
