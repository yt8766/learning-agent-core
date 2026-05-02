import type { AuthTokens } from '../types/api';

export const AUTH_STORAGE_KEYS = {
  accessToken: 'knowledge_access_token',
  refreshToken: 'knowledge_refresh_token',
  accessTokenExpiresAt: 'knowledge_access_token_expires_at',
  refreshTokenExpiresAt: 'knowledge_refresh_token_expires_at'
} as const;

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export function saveTokens(tokens: AuthTokens, now = Date.now()) {
  localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, tokens.accessToken);
  localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, tokens.refreshToken);
  localStorage.setItem(
    AUTH_STORAGE_KEYS.accessTokenExpiresAt,
    String(
      tokens.accessTokenExpiresAt ? new Date(tokens.accessTokenExpiresAt).getTime() : now + tokens.expiresIn * 1000
    )
  );
  localStorage.setItem(
    AUTH_STORAGE_KEYS.refreshTokenExpiresAt,
    String(
      tokens.refreshTokenExpiresAt
        ? new Date(tokens.refreshTokenExpiresAt).getTime()
        : now + tokens.refreshExpiresIn * 1000
    )
  );
}

export function readTokens(): StoredTokens | undefined {
  const accessToken = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
  const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);
  const accessTokenExpiresAt = readPositiveTimestamp(AUTH_STORAGE_KEYS.accessTokenExpiresAt);
  const refreshTokenExpiresAt = readPositiveTimestamp(AUTH_STORAGE_KEYS.refreshTokenExpiresAt);

  if (!accessToken || !refreshToken || accessTokenExpiresAt === undefined || refreshTokenExpiresAt === undefined) {
    return undefined;
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt
  };
}

export function clearTokens() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.accessTokenExpiresAt);
  localStorage.removeItem(AUTH_STORAGE_KEYS.refreshTokenExpiresAt);
}

export function shouldRefreshAccessToken(refreshBeforeMs = 60_000, now = Date.now()) {
  const tokens = readTokens();
  return !tokens || now >= tokens.accessTokenExpiresAt - refreshBeforeMs;
}

export function isRefreshTokenExpired(now = Date.now()) {
  const tokens = readTokens();
  return !tokens || now >= tokens.refreshTokenExpiresAt;
}

function readPositiveTimestamp(key: string) {
  const value = localStorage.getItem(key);
  if (!value) {
    return undefined;
  }
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
}
