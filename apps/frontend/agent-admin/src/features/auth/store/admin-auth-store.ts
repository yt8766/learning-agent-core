import type { AdminAccount, AdminTokenPair } from '@agent/core';

export type AdminAuthState = 'anonymous' | 'authenticating' | 'authenticated' | 'refreshing' | 'expired';

export type AdminAuthSnapshot = {
  state: AdminAuthState;
  account?: AdminAccount;
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
};

type Listener = () => void;
const ADMIN_AUTH_STORAGE_KEY = 'agent-admin:auth';

type PersistedAdminAuth = {
  account: AdminAccount;
  tokens: AdminTokenPair;
};

class AdminAuthStore {
  private snapshot: AdminAuthSnapshot = readPersistedSnapshot();
  private readonly listeners = new Set<Listener>();
  private persistTokens = this.snapshot.state === 'authenticated';

  getSnapshot(): AdminAuthSnapshot {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setAuthenticating(): void {
    this.setSnapshot({ ...this.snapshot, state: 'authenticating' });
  }

  setAuthenticated(account: AdminAccount, tokens: AdminTokenPair, options: { persist?: boolean } = {}): void {
    this.persistTokens = options.persist ?? true;
    this.setSnapshot({
      state: 'authenticated',
      account,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt
    });
    this.writePersistedTokens(account, tokens);
  }

  setRefreshing(): void {
    this.setSnapshot({ ...this.snapshot, state: 'refreshing' });
  }

  setTokenPair(tokens: AdminTokenPair): void {
    this.setSnapshot({
      ...this.snapshot,
      state: this.snapshot.account ? 'authenticated' : this.snapshot.state,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt
    });
    if (this.snapshot.account) {
      this.writePersistedTokens(this.snapshot.account, tokens);
    }
  }

  clear(state: AdminAuthState = 'anonymous'): void {
    this.persistTokens = false;
    removePersistedAuth();
    this.setSnapshot({ state });
  }

  private setSnapshot(snapshot: AdminAuthSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private writePersistedTokens(account: AdminAccount, tokens: AdminTokenPair): void {
    if (!this.persistTokens) {
      removePersistedAuth();
      return;
    }
    writePersistedAuth({ account, tokens });
  }
}

export const adminAuthStore = new AdminAuthStore();

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

function writePersistedAuth(value: PersistedAdminAuth): void {
  getBrowserStorage()?.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(value));
}

function removePersistedAuth(): void {
  getBrowserStorage()?.removeItem(ADMIN_AUTH_STORAGE_KEY);
}

function getBrowserStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}
