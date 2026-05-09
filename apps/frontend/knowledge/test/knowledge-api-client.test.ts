import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthClient } from '../src/api/auth-client';
import { KnowledgeApiClient } from '../src/api/knowledge-api-client';
import { parseKnowledgeChatSseFrame } from '../src/api/knowledge-chat-stream';
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
      if (String(url).endsWith('/identity/refresh')) {
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
    const authClient = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api', fetcher });
    const apiClient = new KnowledgeApiClient({ baseUrl: 'http://127.0.0.1:3000/api', authClient, fetcher });

    const result = await apiClient.getDashboardOverview();

    expect(result.knowledgeBaseCount).toBe(0);
    expect(calls.some(call => call.url.endsWith('/identity/refresh'))).toBe(true);
    expect(calls.at(-1)?.authorization).toBe('Bearer new');
  });

  it('uses the production fetch path when no custom fetcher is injected', async () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          knowledgeBaseCount: 1,
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
      )
    );
    vi.stubGlobal('fetch', fetcher);
    const authClient = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api' });
    const apiClient = new KnowledgeApiClient({ baseUrl: 'http://127.0.0.1:3000/api', authClient });

    const result = await apiClient.getDashboardOverview();

    expect(result.knowledgeBaseCount).toBe(1);
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/dashboard/overview',
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    );
  });

  it('binds the default browser fetch before API requests', async () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const fetcher = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            knowledgeBaseCount: 1,
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
        )
      );
    }) as typeof fetch;
    vi.stubGlobal('fetch', fetcher);
    const authClient = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api' });
    const apiClient = new KnowledgeApiClient({ baseUrl: 'http://127.0.0.1:3000/api', authClient });

    const result = await apiClient.getDashboardOverview();

    expect(result.knowledgeBaseCount).toBe(1);
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/dashboard/overview',
      expect.objectContaining({ headers: expect.any(Headers) })
    );
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
      if (String(url).endsWith('/identity/refresh')) {
        refreshCalls += 1;
      }
      return new Response(JSON.stringify({ code: 'auth_forbidden', message: 'forbidden' }), { status: 401 });
    };
    const authClient = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api', fetcher });
    const apiClient = new KnowledgeApiClient({ baseUrl: 'http://127.0.0.1:3000/api', authClient, fetcher });

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
      if (String(url).endsWith('/identity/refresh')) {
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
    const authClient = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api', fetcher });
    const apiClient = new KnowledgeApiClient({ baseUrl: 'http://127.0.0.1:3000/api', authClient, fetcher });

    await expect(apiClient.getDashboardOverview()).rejects.toThrow('still expired');

    expect(refreshCalls).toBe(1);
    expect(dashboardCalls).toBe(2);
  });

  it('posts chat requests as SSE and parses knowledge RAG stream events', async () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          streamFromText(
            [
              'event: rag.started',
              'data: {"type":"rag.started","runId":"rag_stream"}',
              '',
              'event: answer.delta',
              'data: {"type":"answer.delta","runId":"rag_stream","delta":"你好"}',
              '',
              ''
            ].join('\n')
          ),
          { status: 200 }
        )
      );
    const authClient = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api', fetcher });
    const apiClient = new KnowledgeApiClient({ baseUrl: 'http://127.0.0.1:3000/api', authClient, fetcher });

    const events = [];
    for await (const event of apiClient.streamChat({
      messages: [{ content: '检索前有什么', role: 'user' }],
      model: 'knowledge-rag'
    })) {
      events.push(event);
    }

    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/knowledge/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messages: [{ content: '检索前有什么', role: 'user' }],
          model: 'knowledge-rag',
          stream: true
        }),
        headers: expect.any(Headers)
      })
    );
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Accept')).toBe('text/event-stream');
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer access');
    expect(events).toEqual([
      { type: 'rag.started', runId: 'rag_stream' },
      { type: 'answer.delta', runId: 'rag_stream', delta: '你好' }
    ]);
  });

  it('loads RAG model profiles and persisted conversation messages from backend endpoints', async () => {
    saveTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 7200,
      refreshExpiresIn: 1209600
    });
    const fetcher = vi.fn<typeof fetch>(async url => {
      if (String(url).endsWith('/rag/model-profiles')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'coding-pro',
                label: '用于编程',
                description: '更专业的回答与控制',
                useCase: 'coding',
                enabled: true
              }
            ]
          }),
          { status: 200 }
        );
      }
      if (String(url).endsWith('/conversations')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'conv_backend',
                userId: 'user_1',
                title: '检索前技术名词',
                activeModelProfileId: 'coding-pro',
                createdAt: '2026-05-01T00:00:00.000Z',
                updatedAt: '2026-05-01T00:01:00.000Z'
              }
            ],
            total: 1,
            page: 1,
            pageSize: 20
          }),
          { status: 200 }
        );
      }
      if (String(url).endsWith('/conversations/conv_backend/messages')) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: 'msg_user_backend',
                conversationId: 'conv_backend',
                userId: 'user_1',
                role: 'user',
                content: '检索前技术名词',
                citations: [],
                createdAt: '2026-05-01T00:00:00.000Z'
              }
            ],
            total: 1,
            page: 1,
            pageSize: 20
          }),
          { status: 200 }
        );
      }
      return new Response('{}', { status: 404 });
    });
    const authClient = new AuthClient({ baseUrl: 'http://127.0.0.1:3000/api', fetcher });
    const apiClient = new KnowledgeApiClient({ baseUrl: 'http://127.0.0.1:3000/api', authClient, fetcher });

    await expect(apiClient.listRagModelProfiles()).resolves.toMatchObject({
      items: [expect.objectContaining({ id: 'coding-pro', label: '用于编程' })]
    });
    await expect(apiClient.listConversations()).resolves.toMatchObject({
      items: [expect.objectContaining({ id: 'conv_backend', activeModelProfileId: 'coding-pro' })]
    });
    await expect(apiClient.listConversationMessages('conv_backend')).resolves.toMatchObject({
      items: [expect.objectContaining({ id: 'msg_user_backend', content: '检索前技术名词' })]
    });
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:3000/api/knowledge/rag/model-profiles', expect.any(Object));
    expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:3000/api/knowledge/conversations', expect.any(Object));
    expect(fetcher).toHaveBeenCalledWith(
      'http://127.0.0.1:3000/api/knowledge/conversations/conv_backend/messages',
      expect.any(Object)
    );
  });

  it('rejects malformed knowledge chat SSE frames before hooks consume them', () => {
    expect(() => parseKnowledgeChatSseFrame('data: {"type":"answer.completed","runId":"rag_stream"}')).toThrow(
      'Invalid knowledge chat stream event.'
    );
  });
});

function streamFromText(text: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    }
  });
}
