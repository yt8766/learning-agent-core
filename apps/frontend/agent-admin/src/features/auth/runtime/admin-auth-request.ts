import type { AdminAuthErrorCode, AdminTokenPair } from '@agent/core';

import type { AdminRequestInit } from '@/api/admin-api-core';

import type { AdminRefreshCoordinator } from './admin-refresh-coordinator';
import type { AdminTokenManager } from './admin-token-manager';

export class AdminAuthRequestError extends Error {
  readonly status: number;
  readonly code: AdminAuthErrorCode;

  constructor(status: number, code: AdminAuthErrorCode, message: string) {
    super(message);
    this.name = 'AdminAuthRequestError';
    this.status = status;
    this.code = code;
  }
}

export type AdminAuthTransport = <T>(path: string, init?: AdminRequestInit) => Promise<T>;

export type AdminAuthRequestRuntime = {
  request<T>(path: string, init?: AdminRequestInit & { skipAuth?: boolean; retryAfterRefresh?: boolean }): Promise<T>;
};

export function createAdminAuthRequestRuntime(
  transport: AdminAuthTransport,
  tokenManager: AdminTokenManager,
  refreshCoordinator: AdminRefreshCoordinator
): AdminAuthRequestRuntime {
  return {
    async request<T>(path: string, init?: AdminRequestInit & { skipAuth?: boolean; retryAfterRefresh?: boolean }) {
      const requestInit = withAuthorization(init, tokenManager, init?.skipAuth);
      try {
        return await transport<T>(path, requestInit);
      } catch (error) {
        if (
          init?.skipAuth ||
          init?.retryAfterRefresh ||
          !(error instanceof AdminAuthRequestError) ||
          error.status !== 401 ||
          error.code !== 'access_token_expired'
        ) {
          throw error;
        }
        const tokens: AdminTokenPair = await refreshCoordinator.refresh();
        return transport<T>(
          path,
          withAuthorization({ ...init, retryAfterRefresh: true }, tokenManagerWith(tokens), false)
        );
      }
    }
  };
}

function withAuthorization(
  init: (AdminRequestInit & { skipAuth?: boolean }) | undefined,
  tokenManager: AdminTokenManager,
  skipAuth = false
): AdminRequestInit {
  if (skipAuth) {
    return init ?? {};
  }
  const accessToken = tokenManager.getAccessToken();
  if (!accessToken) {
    return init ?? {};
  }
  return {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${accessToken}`
    }
  };
}

function tokenManagerWith(tokens: AdminTokenPair): AdminTokenManager {
  return {
    getAccessToken: () => tokens.accessToken,
    getRefreshToken: () => tokens.refreshToken,
    setTokenPair: () => undefined,
    clearTokens: () => undefined
  };
}
