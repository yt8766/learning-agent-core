import type { PlatformConsoleRecord } from '@/types/admin';

export type AdminRequestInit = RequestInit & {
  cancelKey?: string;
  cancelPrevious?: boolean;
};

export const ABORTED_REQUEST_ERROR = '__ADMIN_REQUEST_ABORTED__';
const requestControllers = new Map<string, AbortController>();
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export interface ChannelDeliveryRecord {
  id: string;
  channel: 'web' | 'telegram' | 'feishu' | 'wechat';
  channelChatId: string;
  sessionId?: string;
  taskId?: string;
  segment: 'planning' | 'approval' | 'progress' | 'final';
  status: 'queued' | 'sent' | 'failed';
  attemptCount?: number;
  queuedAt: string;
  lastAttemptAt?: string;
  deliveredAt?: string;
  failureReason?: string;
}

export function isAbortedAdminRequestError(error: unknown): boolean {
  return (
    (error instanceof Error && error.message === ABORTED_REQUEST_ERROR) ||
    (error instanceof DOMException && error.name === 'AbortError')
  );
}

export async function request<T>(path: string, init?: AdminRequestInit): Promise<T> {
  const cancelKey = init?.cancelKey;
  const abortController = cancelKey ? new AbortController() : undefined;

  if (cancelKey && init?.cancelPrevious) {
    requestControllers.get(cancelKey)?.abort();
    if (abortController) {
      requestControllers.set(cancelKey, abortController);
    }
  }

  if (init?.signal && abortController) {
    if (init.signal.aborted) {
      abortController.abort();
    } else {
      init.signal.addEventListener('abort', () => abortController.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      },
      ...init,
      signal: abortController?.signal ?? init?.signal
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(ABORTED_REQUEST_ERROR);
    }
    throw error;
  } finally {
    if (cancelKey && requestControllers.get(cancelKey) === abortController) {
      requestControllers.delete(cancelKey);
    }
  }
}

export async function getHealth() {
  return request<{ status: string; now: string }>('/health');
}

export async function getPlatformConsole(
  days = 30,
  filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    runtimeExecutionMode?: string;
    runtimeInteractionKind?: string;
    approvalsExecutionMode?: string;
    approvalsInteractionKind?: string;
  }
) {
  const search = new URLSearchParams();
  search.set('days', String(days));
  if (filters?.status) search.set('status', filters.status);
  if (filters?.model) search.set('model', filters.model);
  if (filters?.pricingSource) search.set('pricingSource', filters.pricingSource);
  if (filters?.runtimeExecutionMode) search.set('runtimeExecutionMode', filters.runtimeExecutionMode);
  if (filters?.runtimeInteractionKind) search.set('runtimeInteractionKind', filters.runtimeInteractionKind);
  if (filters?.approvalsExecutionMode) search.set('approvalsExecutionMode', filters.approvalsExecutionMode);
  if (filters?.approvalsInteractionKind) search.set('approvalsInteractionKind', filters.approvalsInteractionKind);
  return request<PlatformConsoleRecord>(`/platform/console?${search.toString()}`, {
    cancelKey: 'platform-console',
    cancelPrevious: true
  });
}
