import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearTokens, readTokens, saveTokens, shouldRefreshAccessToken } from '../src/api/token-storage';
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

  it('ignores partial token records', () => {
    localStorage.setItem('knowledge_access_token', 'access');
    localStorage.setItem('knowledge_refresh_token', 'refresh');

    expect(readTokens()).toBeUndefined();
  });
});
