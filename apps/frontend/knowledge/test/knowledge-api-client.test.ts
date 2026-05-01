import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthClient } from '../src/api/auth-client';
import { KnowledgeApiClient } from '../src/api/knowledge-api-client';
import { saveTokens } from '../src/api/token-storage';
import { installLocalStorageMock } from './local-storage-mock';

describe('KnowledgeApiClient', () => {
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

  it('refreshes token and retries once on auth_token_expired', async () => {
    saveTokens({
      accessToken: 'old',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const calls: Array<{ url: string; authorization?: string }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      const authorization = new Headers(init?.headers).get('Authorization') ?? undefined;
      calls.push({ url: String(url), authorization });
      if (String(url).endsWith('/dashboard/overview') && authorization === 'Bearer old') {
        return new Response(JSON.stringify({ code: 'auth_token_expired', message: 'expired' }), { status: 401 });
      }
      if (String(url).endsWith('/auth/refresh')) {
        return new Response(
          JSON.stringify({
            tokens: {
              accessToken: 'new',
              refreshToken: 'new_refresh',
              tokenType: 'Bearer',
              expiresIn: 7200,
              refreshExpiresIn: 1209600
            }
          }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          knowledgeBaseCount: 0,
          documentCount: 0,
          readyDocumentCount: 0,
          failedDocumentCount: 0,
          todayQuestionCount: 0,
          activeAlertCount: 0,
          recentFailedJobs: [],
          recentLowScoreTraces: [],
          recentEvalRuns: [],
          topMissingKnowledgeQuestions: []
        }),
        { status: 200 }
      );
    };
    const authClient = new AuthClient({ baseUrl: '/api/knowledge/v1', fetcher });
    const apiClient = new KnowledgeApiClient({ baseUrl: '/api/knowledge/v1', authClient, fetcher });

    const result = await apiClient.getDashboardOverview();

    expect(result.knowledgeBaseCount).toBe(0);
    expect(calls.some(call => call.url.endsWith('/auth/refresh'))).toBe(true);
    expect(calls.at(-1)?.authorization).toBe('Bearer new');
  });

  it('does not refresh on unrelated unauthorized responses', async () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    let refreshCalls = 0;
    const fetcher: typeof fetch = async url => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshCalls += 1;
      }
      return new Response(JSON.stringify({ code: 'auth_forbidden', message: 'forbidden' }), { status: 401 });
    };
    const authClient = new AuthClient({ baseUrl: '/api/knowledge/v1', fetcher });
    const apiClient = new KnowledgeApiClient({ baseUrl: '/api/knowledge/v1', authClient, fetcher });

    await expect(apiClient.getDashboardOverview()).rejects.toThrow('forbidden');

    expect(refreshCalls).toBe(0);
  });

  it('retries expired access token only once', async () => {
    saveTokens({
      accessToken: 'old',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    let dashboardCalls = 0;
    let refreshCalls = 0;
    const fetcher: typeof fetch = async url => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return new Response(
          JSON.stringify({
            tokens: {
              accessToken: 'new',
              refreshToken: 'new_refresh',
              tokenType: 'Bearer',
              expiresIn: 7200,
              refreshExpiresIn: 1209600
            }
          }),
          { status: 200 }
        );
      }
      dashboardCalls += 1;
      return new Response(JSON.stringify({ code: 'auth_token_expired', message: 'still expired' }), { status: 401 });
    };
    const authClient = new AuthClient({ baseUrl: '/api/knowledge/v1', fetcher });
    const apiClient = new KnowledgeApiClient({ baseUrl: '/api/knowledge/v1', authClient, fetcher });

    await expect(apiClient.getDashboardOverview()).rejects.toThrow('still expired');

    expect(refreshCalls).toBe(1);
    expect(dashboardCalls).toBe(2);
  });
});
