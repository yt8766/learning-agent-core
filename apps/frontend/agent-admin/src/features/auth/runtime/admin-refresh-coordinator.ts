import type { AdminRefreshResponse, AdminTokenPair } from '@agent/core';

import { refreshAdminAuth } from '../api/admin-auth.api';
import { adminAuthStore } from '../store/admin-auth-store';
import type { AdminTokenManager } from './admin-token-manager';
import { adminTokenManager } from './admin-token-manager';

export type AdminRefreshCoordinator = {
  refresh(): Promise<AdminTokenPair>;
};

export function createAdminRefreshCoordinator(
  tokenManager: AdminTokenManager,
  refreshRequest: (refreshToken?: string) => Promise<AdminRefreshResponse>
): AdminRefreshCoordinator {
  let refreshPromise: Promise<AdminTokenPair> | undefined;

  return {
    refresh() {
      if (!refreshPromise) {
        adminAuthStore.setRefreshing();
        refreshPromise = refreshRequest(tokenManager.getRefreshToken())
          .then(response => {
            tokenManager.setTokenPair(response.tokens);
            return response.tokens;
          })
          .catch(error => {
            tokenManager.clearTokens();
            throw error;
          })
          .finally(() => {
            refreshPromise = undefined;
          });
      }
      return refreshPromise;
    }
  };
}

export const adminRefreshCoordinator = createAdminRefreshCoordinator(adminTokenManager, refreshAdminAuth);
