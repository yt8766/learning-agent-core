import type { AdminAccount, AdminTokenPair } from '@agent/core';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';

export type AdminAuthState = 'anonymous' | 'authenticating' | 'authenticated' | 'refreshing' | 'expired';

export type AdminAuthSnapshot = {
  state: AdminAuthState;
  account?: AdminAccount;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
};

type AdminAuthStoreState = {
  snapshot: AdminAuthSnapshot;
  persistTokens: boolean;
  setAuthenticating: () => void;
  setAuthenticated: (account: AdminAccount, tokens: AdminTokenPair, options?: { persist?: boolean }) => void;
  setRefreshing: () => void;
  setTokenPair: (tokens: AdminTokenPair) => void;
  clear: (state?: AdminAuthState) => void;
};

const ADMIN_AUTH_STORAGE_KEY = 'agent-admin:auth';

type PersistedAdminAuth = {
  account: AdminAccount;
  tokens: AdminTokenPair;
};

const initialSnapshot = readPersistedSnapshot();

export const useAdminAuthStore = create<AdminAuthStoreState>((set, get) => ({
  snapshot: initialSnapshot,
  persistTokens: initialSnapshot.state === 'authenticated',
  setAuthenticating: () =>
    set(current => ({
      snapshot: { ...current.snapshot, state: 'authenticating' }
    })),
  setAuthenticated: (account, tokens, options = {}) => {
    const persistTokens = options.persist ?? true;
    set({
      persistTokens,
      snapshot: {
        state: 'authenticated',
        account,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt
      }
    });
    writePersistedTokens(account, tokens, persistTokens);
  },
  setRefreshing: () =>
    set(current => ({
      snapshot: { ...current.snapshot, state: 'refreshing' }
    })),
  setTokenPair: tokens => {
    const current = get();
    const snapshot: AdminAuthSnapshot = {
      ...current.snapshot,
      state: current.snapshot.account ? 'authenticated' : current.snapshot.state,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt
    };
    set({ snapshot });
    if (snapshot.account) {
      writePersistedTokens(snapshot.account, tokens, current.persistTokens);
    }
  },
  clear: (state = 'anonymous') => {
    removePersistedAuth();
    set({
      persistTokens: false,
      snapshot: { state }
    });
  }
}));

export const adminAuthStore = {
  getSnapshot(): AdminAuthSnapshot {
    return useAdminAuthStore.getState().snapshot;
  },
  subscribe(listener: () => void): () => void {
    return useAdminAuthStore.subscribe(() => listener());
  },
  setAuthenticating(): void {
    useAdminAuthStore.getState().setAuthenticating();
  },
  setAuthenticated(account: AdminAccount, tokens: AdminTokenPair, options: { persist?: boolean } = {}): void {
    useAdminAuthStore.getState().setAuthenticated(account, tokens, options);
  },
  setRefreshing(): void {
    useAdminAuthStore.getState().setRefreshing();
  },
  setTokenPair(tokens: AdminTokenPair): void {
    useAdminAuthStore.getState().setTokenPair(tokens);
  },
  clear(state: AdminAuthState = 'anonymous'): void {
    useAdminAuthStore.getState().clear(state);
  }
};

export function useAdminAuthSnapshot() {
  return useSyncExternalStore(adminAuthStore.subscribe, adminAuthStore.getSnapshot, adminAuthStore.getSnapshot);
}

function readPersistedSnapshot(): AdminAuthSnapshot {
  const persisted = readPersistedAuth();
  if (!persisted) {
    return { state: 'anonymous' };
  }
  return {
    state: 'authenticated',
    account: persisted.account,
    accessToken: persisted.tokens.accessToken,
    refreshToken: persisted.tokens.refreshToken,
    accessTokenExpiresAt: persisted.tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: persisted.tokens.refreshTokenExpiresAt
  };
}

function readPersistedAuth(): PersistedAdminAuth | null {
  const storage = getBrowserStorage();
  if (!storage) {
    return null;
  }
  const raw = storage.getItem(ADMIN_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAdminAuth>;
    if (!parsed.account || !parsed.tokens?.accessToken || !parsed.tokens.refreshToken) {
      return null;
    }
    return parsed as PersistedAdminAuth;
  } catch {
    removePersistedAuth();
    return null;
  }
}

function writePersistedTokens(account: AdminAccount, tokens: AdminTokenPair, persistTokens: boolean): void {
  if (!persistTokens) {
    removePersistedAuth();
    return;
  }
  getBrowserStorage()?.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify({ account, tokens }));
}

function removePersistedAuth(): void {
  getBrowserStorage()?.removeItem(ADMIN_AUTH_STORAGE_KEY);
}

function getBrowserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
