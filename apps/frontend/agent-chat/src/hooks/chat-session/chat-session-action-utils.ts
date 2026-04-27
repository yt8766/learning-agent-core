import axios from 'axios';

import type { ChatCheckpointRecord } from '@/types/chat';
import { deriveSessionStatusFromCheckpoint } from './chat-session-checkpoint';
import type { CreateChatSessionActionsOptions, OutboundChatMessage } from './chat-session-actions.types';

export const FINAL_RECONCILE_RETRY_DELAY_MS = 500;
export const TERMINAL_SESSION_STATUSES = new Set(['completed', 'failed', 'cancelled']);

export interface SessionDetailRefreshOptions {
  showLoading?: boolean;
}

export interface FinalSnapshotReconcileOptions {
  attempt?: number;
  maxRetries?: number;
}

export type RunLoadingFn = <T>(
  task: () => Promise<T>,
  fallbackMessage: string,
  runOptions?: boolean | { withLoading?: boolean; sessionId?: string }
) => Promise<T | undefined>;

export function delay(ms: number) {
  return new Promise(resolve => globalThis.setTimeout(resolve, ms));
}

export function formatChatError(nextError: unknown, fallbackMessage: string) {
  if (axios.isAxiosError(nextError)) {
    if (fallbackMessage === '终止会话失败') {
      if (nextError.response?.status === 404) {
        return '当前会话不存在或已被移除。';
      }
      if (nextError.response?.status === 400) {
        return '当前没有可终止的运行中的任务。';
      }
      if (nextError.response?.status && nextError.response.status >= 500) {
        return '终止请求已发送，但服务端暂时没有正确返回结果。请稍后刷新会话状态。';
      }
    }
    if (!nextError.response) {
      return `${fallbackMessage}：当前无法连接后端 API，请确认 server 已启动且 ${import.meta.env.VITE_API_BASE_URL ?? '/api'} 可达。`;
    }
    const detail =
      typeof nextError.response.data === 'string'
        ? nextError.response.data
        : typeof nextError.response.data?.message === 'string'
          ? nextError.response.data.message
          : nextError.message;
    return `${fallbackMessage}：${detail}`;
  }

  return nextError instanceof Error ? nextError.message : fallbackMessage;
}

export function isMissingSessionError(nextError: unknown) {
  if (!axios.isAxiosError(nextError)) {
    return false;
  }
  if (nextError.response?.status !== 404) {
    return false;
  }
  const detail =
    typeof nextError.response.data === 'string'
      ? nextError.response.data
      : typeof nextError.response.data?.message === 'string'
        ? nextError.response.data.message
        : nextError.message;
  return /session\s+.+not found/i.test(detail);
}

export function normalizeOutboundMessage(input: string | OutboundChatMessage): OutboundChatMessage {
  if (typeof input === 'string') {
    return {
      display: input,
      payload: input
    };
  }

  return input;
}

export function shouldAttemptImmediateFinalReconcile(checkpoint: ChatCheckpointRecord | undefined) {
  if (!checkpoint) {
    return false;
  }
  return TERMINAL_SESSION_STATUSES.has(deriveSessionStatusFromCheckpoint(checkpoint));
}

export function createRunLoading(
  options: CreateChatSessionActionsOptions,
  handleMissingSession: (id: string) => Promise<void>
): RunLoadingFn {
  return async <T>(
    task: () => Promise<T>,
    fallbackMessage: string,
    runOptions: boolean | { withLoading?: boolean; sessionId?: string } = true
  ): Promise<T | undefined> => {
    const withLoading = typeof runOptions === 'boolean' ? runOptions : (runOptions.withLoading ?? true);
    const sessionId = typeof runOptions === 'boolean' ? undefined : runOptions.sessionId;
    try {
      if (withLoading) options.setLoading(true);
      options.setError('');
      return await task();
    } catch (nextError) {
      if (sessionId && isMissingSessionError(nextError)) {
        await handleMissingSession(sessionId);
        return undefined;
      }
      options.setError(formatChatError(nextError, fallbackMessage));
      return undefined;
    } finally {
      if (withLoading) options.setLoading(false);
    }
  };
}
