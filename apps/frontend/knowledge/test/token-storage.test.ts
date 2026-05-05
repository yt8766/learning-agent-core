import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_STORAGE_KEYS,
  clearTokens,
  readTokens,
  saveTokens,
  shouldRefreshAccessToken
} from '../src/api/token-storage';
import { installLocalStorageMock } from './local-storage-mock';

describe('token storage', () => {
  beforeEach(() => {
    installLocalStorageMock();
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('saves tokens with absolute expiry timestamps', () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 120,
      refreshExpiresIn: 600
    });

    expect(readTokens()).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      accessTokenExpiresAt: Date.now() + 120_000,
      refreshTokenExpiresAt: Date.now() + 600_000
    });
  });

  it('detects access tokens that should refresh soon', () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 30,
      refreshExpiresIn: 600
    });

    expect(shouldRefreshAccessToken(60_000)).toBe(true);
  });

  it('clears tokens', () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 120,
      refreshExpiresIn: 600
    });
    clearTokens();

    expect(readTokens()).toBeUndefined();
  });

  it('reads legacy four-key tokens and migrates them to versioned storage', () => {
    localStorage.setItem(AUTH_STORAGE_KEYS.accessToken, 'access');
    localStorage.setItem(AUTH_STORAGE_KEYS.refreshToken, 'refresh');
    localStorage.setItem(AUTH_STORAGE_KEYS.accessTokenExpiresAt, String(Date.now() + 60_000));
    localStorage.setItem(AUTH_STORAGE_KEYS.refreshTokenExpiresAt, String(Date.now() + 120_000));

    const tokens = readTokens();

    expect(tokens?.accessToken).toBe('access');
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.versionedTokens)).toContain('"version":1');
  });

  it('clears corrupted versioned storage', () => {
    localStorage.setItem(AUTH_STORAGE_KEYS.versionedTokens, '{broken');

    expect(readTokens()).toBeUndefined();
    expect(localStorage.getItem(AUTH_STORAGE_KEYS.versionedTokens)).toBeNull();
  });

  it('ignores partial token records', () => {
    localStorage.setItem('knowledge_access_token', 'access');
    localStorage.setItem('knowledge_refresh_token', 'refresh');

    expect(readTokens()).toBeUndefined();
  });
});
