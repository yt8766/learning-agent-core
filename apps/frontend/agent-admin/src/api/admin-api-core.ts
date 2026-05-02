import axios from 'axios';
import type { AxiosRequestConfig, Method } from 'axios';
import type { AdminAuthErrorResponse, AdminTokenPair } from '@agent/core';

import { refreshAdminAuth } from '@/pages/auth/api/admin-auth.api';
import { adminAuthStore } from '@/pages/auth/store/admin-auth-store';
import { adminTokenManager } from '@/pages/auth/runtime/admin-token-manager';
import type { PlatformConsoleRecord } from '@/types/admin';

export type AdminRequestInit = {
  method?: Method;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  cancelKey?: string;
  cancelPrevious?: boolean;
  skipAuth?: boolean;
  retryAfterRefresh?: boolean;
};

export const ABORTED_REQUEST_ERROR = '__ADMIN_REQUEST_ABORTED__';
const requestControllers = new Map<string, AbortController>();
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3000/api';
const http = axios.create({
  baseURL: API_BASE,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json'
  }
});
let refreshPromise: Promise<AdminTokenPair> | undefined;

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

export type PlatformConsoleView = 'shell' | 'full';

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
    const config: AxiosRequestConfig = {
      url: path,
      method: init?.method ?? 'GET',
      headers: withAuthHeaders(init),
      signal: abortController?.signal ?? init?.signal
    };

    if (typeof init?.body === 'string') {
      config.data = init.body;
    } else if (init?.body !== undefined && init.body !== null) {
      config.data = init.body;
    }

    const response = await http.request<T>(config);
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || (error instanceof axios.CanceledError && error.code === 'ERR_CANCELED')) {
      throw new Error(ABORTED_REQUEST_ERROR);
    }
    if (axios.isAxiosError(error) && error.response) {
      const errorCode = readAdminAuthErrorCode(error.response.data);
      if (
        error.response.status === 401 &&
        errorCode === 'access_token_expired' &&
        !init?.skipAuth &&
        !init?.retryAfterRefresh
      ) {
        await refreshAdminTokenPair();
        return request<T>(path, {
          ...init,
          retryAfterRefresh: true
        });
      }
      throw new Error(`Request failed: ${error.response.status}`);
    }
    throw error;
  } finally {
    if (cancelKey && requestControllers.get(cancelKey) === abortController) {
      requestControllers.delete(cancelKey);
    }
  }
}

function withAuthHeaders(init?: AdminRequestInit): Record<string, string> | undefined {
  if (init?.skipAuth) {
    return init.headers;
  }
  const accessToken = adminTokenManager.getAccessToken();
  if (!accessToken) {
    return init?.headers;
  }
  return {
    ...(init?.headers ?? {}),
    Authorization: `Bearer ${accessToken}`
  };
}

async function refreshAdminTokenPair(): Promise<AdminTokenPair> {
  if (!refreshPromise) {
    adminAuthStore.setRefreshing();
    refreshPromise = refreshAdminAuth(adminTokenManager.getRefreshToken())
      .then(response => {
        adminTokenManager.setTokenPair(response.tokens);
        return response.tokens;
      })
      .catch(error => {
        adminTokenManager.clearTokens();
        throw error;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
}

function readAdminAuthErrorCode(data: unknown): AdminAuthErrorResponse['error']['code'] | undefined {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return undefined;
  }
  const error = (data as { error?: { code?: unknown } }).error;
  return typeof error?.code === 'string' ? (error.code as AdminAuthErrorResponse['error']['code']) : undefined;
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
  },
  view: PlatformConsoleView = 'shell'
) {
  const search = new URLSearchParams();
  search.set('days', String(days));
  if (view === 'full') search.set('view', 'full');
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

export async function getPlatformConsoleShell(
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
  return request<PlatformConsoleRecord>(`/platform/console-shell?${search.toString()}`, {
    cancelKey: 'platform-console-shell',
    cancelPrevious: true
  });
}
