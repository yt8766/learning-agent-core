import type { AdminTokenPair } from '@agent/core';

import { adminAuthStore } from '../store/admin-auth-store';

export type AdminTokenManager = {
  getAccessToken(): string | undefined;
  getRefreshToken(): string | undefined;
  setTokenPair(tokens: AdminTokenPair): void;
  clearTokens(): void;
};

export const adminTokenManager: AdminTokenManager = {
  getAccessToken() {
    return adminAuthStore.getSnapshot().accessToken;
  },
  getRefreshToken() {
    return adminAuthStore.getSnapshot().refreshToken;
  },
  setTokenPair(tokens) {
    adminAuthStore.setTokenPair(tokens);
  },
  clearTokens() {
    adminAuthStore.clear('expired');
  }
};
