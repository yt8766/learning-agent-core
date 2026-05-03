import type { ChatCheckpointRecord, ChatEventRecord, ChatThoughtChainItem } from '@/types/chat';

import {
  buildAdminRuntimeObservatoryUrl,
  buildApprovalsCenterExportUrl,
  buildBrowserReplayUrl,
  buildRuntimeCenterExportUrl
} from '@/api/chat-api';
import { getRuntimeDrawerExportFilters } from '@/pages/runtime-panel/chat-runtime-drawer';
import { formatSessionTime } from '@/hooks/use-chat-session';
import { buildEventSummary } from './chat-home-helpers';

export function resolveCognitionTargetMessageId(
  checkpoint: ChatCheckpointRecord | undefined,
  thoughtChain: ChatThoughtChainItem[] | undefined
) {
  return checkpoint?.thinkState?.messageId ?? thoughtChain?.find(item => item.messageId)?.messageId ?? '';
}

function isDirectReplyCheckpoint(checkpoint: ChatCheckpointRecord | undefined): boolean {
  return checkpoint?.chatRoute?.flow === 'direct-reply';
}

export function buildCognitionDurationLabel(
  checkpoint: ChatCheckpointRecord | undefined,
  thoughtChain: ChatThoughtChainItem[] | undefined,
  thinkingNow: number
) {
  const MAX_COGNITION_MS = 30 * 60 * 1000;
  const directReply = isDirectReplyCheckpoint(checkpoint);

  const durationMs = directReply
    ? typeof checkpoint?.thinkState?.thinkingDurationMs === 'number'
      ? checkpoint.thinkState.thinkingDurationMs
      : undefined
    : (checkpoint?.thinkState?.thinkingDurationMs ??
      thoughtChain?.find(item => typeof item.thinkingDurationMs === 'number')?.thinkingDurationMs);

  if (checkpoint?.thinkState?.loading) {
    const extraMs = Math.max(0, thinkingNow - new Date(checkpoint.updatedAt).getTime());
    const staleMs = typeof durationMs === 'number' && durationMs <= MAX_COGNITION_MS ? durationMs : 0;
    const totalMs = Math.min(staleMs + extraMs, MAX_COGNITION_MS);
    const seconds = Math.max(1, Math.round(totalMs / 1000));
    return `${seconds}s`;
  }

  if (typeof durationMs === 'number') {
    if (durationMs > MAX_COGNITION_MS) {
      return '较长';
    }
    const seconds = Math.max(1, Math.round(durationMs / 1000));
    if (seconds >= 120) {
      const minutes = Math.floor(seconds / 60);
      const rem = seconds % 60;
      return `约 ${minutes} 分 ${rem} 秒`;
    }
    return `约 ${seconds} 秒`;
  }

  if (!directReply && checkpoint?.createdAt && checkpoint?.updatedAt) {
    const fallbackMs = new Date(checkpoint.updatedAt).getTime() - new Date(checkpoint.createdAt).getTime();
    if (fallbackMs > 0 && fallbackMs <= MAX_COGNITION_MS) {
      const seconds = Math.max(1, Math.round(fallbackMs / 1000));
      return seconds >= 120 ? `约 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒` : `约 ${seconds} 秒`;
    }
    if (fallbackMs > MAX_COGNITION_MS) {
      return '较长';
    }
  }

  return '';
}

const MAX_COGNITION_MS = 30 * 60 * 1000;

/** 用于单条消息的持久化 cognition 快照耗时展示（checkpoint 不可用时的等价逻辑） */
export function formatCognitionDurationLabelFromMs(durationMs?: number): string {
  if (typeof durationMs !== 'number') {
    return '';
  }

  if (durationMs > MAX_COGNITION_MS) {
    return '较长';
  }

  const seconds = Math.max(1, Math.round(durationMs / 1000));
  if (seconds >= 120) {
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    return `约 ${minutes} 分 ${rem} 秒`;
  }

  return `约 ${seconds} 秒`;
}

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
