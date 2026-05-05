import type { AuthTokens } from '../types/api';

export const AUTH_STORAGE_KEYS = {
  versionedTokens: 'knowledge_auth_tokens',
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

interface VersionedStoredTokens extends StoredTokens {
  version: 1;
}

export function saveTokens(tokens: AuthTokens, now = Date.now()) {
  const stored: VersionedStoredTokens = {
    version: 1,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt
      ? new Date(tokens.accessTokenExpiresAt).getTime()
      : now + tokens.expiresIn * 1000,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt
      ? new Date(tokens.refreshTokenExpiresAt).getTime()
      : now + tokens.refreshExpiresIn * 1000
  };

  localStorage.setItem(AUTH_STORAGE_KEYS.versionedTokens, JSON.stringify(stored));
  clearLegacyTokenKeys();
}

export function readTokens(): StoredTokens | undefined {
  const versioned = localStorage.getItem(AUTH_STORAGE_KEYS.versionedTokens);
  if (versioned) {
    try {
      return parseVersionedTokens(JSON.parse(versioned));
    } catch {
      clearTokens();
      return undefined;
    }
  }

  return readLegacyTokens();
}

export function clearTokens() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.versionedTokens);
  clearLegacyTokenKeys();
}

export function shouldRefreshAccessToken(refreshBeforeMs = 60_000, now = Date.now()) {
  const tokens = readTokens();
  return !tokens || now >= tokens.accessTokenExpiresAt - refreshBeforeMs;
}

export function isRefreshTokenExpired(now = Date.now()) {
  const tokens = readTokens();
  return !tokens || now >= tokens.refreshTokenExpiresAt;
}

function readLegacyTokens() {
  const accessToken = localStorage.getItem(AUTH_STORAGE_KEYS.accessToken);
  const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.refreshToken);
  const accessTokenExpiresAt = readPositiveTimestamp(AUTH_STORAGE_KEYS.accessTokenExpiresAt);
  const refreshTokenExpiresAt = readPositiveTimestamp(AUTH_STORAGE_KEYS.refreshTokenExpiresAt);

  if (!accessToken || !refreshToken || accessTokenExpiresAt === undefined || refreshTokenExpiresAt === undefined) {
    return undefined;
  }

  const tokens: StoredTokens = {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt
  };

  localStorage.setItem(AUTH_STORAGE_KEYS.versionedTokens, JSON.stringify({ version: 1, ...tokens }));
  clearLegacyTokenKeys();
  return tokens;
}

function parseVersionedTokens(input: unknown): StoredTokens | undefined {
  if (!isRecord(input) || input.version !== 1) {
    clearTokens();
    return undefined;
  }

  const accessToken = typeof input.accessToken === 'string' ? input.accessToken : undefined;
  const refreshToken = typeof input.refreshToken === 'string' ? input.refreshToken : undefined;
  const accessTokenExpiresAt = readPositiveNumber(input.accessTokenExpiresAt);
  const refreshTokenExpiresAt = readPositiveNumber(input.refreshTokenExpiresAt);

  if (!accessToken || !refreshToken || accessTokenExpiresAt === undefined || refreshTokenExpiresAt === undefined) {
    clearTokens();
    return undefined;
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt
  };
}

function clearLegacyTokenKeys() {
  localStorage.removeItem(AUTH_STORAGE_KEYS.accessToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.refreshToken);
  localStorage.removeItem(AUTH_STORAGE_KEYS.accessTokenExpiresAt);
  localStorage.removeItem(AUTH_STORAGE_KEYS.refreshTokenExpiresAt);
}

function readPositiveTimestamp(key: string) {
  const value = localStorage.getItem(key);
  if (!value) {
    return undefined;
  }
  const timestamp = Number(value);
  return readPositiveNumber(timestamp);
}

function readPositiveNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}
