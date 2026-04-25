import { describe, expect, it, vi } from 'vitest';
import {
  fetchProviderJson,
  joinProviderUrl,
  parseProviderJsonResponse
} from '../src/providers/provider-http-client.js';

describe('provider HTTP client helpers', () => {
  it('joins a provider base URL and relative path without dropping base path segments', () => {
    expect(joinProviderUrl('https://provider.example.com/v1/', '/chat/completions')).toBe(
      'https://provider.example.com/v1/chat/completions'
    );
    expect(joinProviderUrl('https://provider.example.com/v1', 'models')).toBe('https://provider.example.com/v1/models');
  });

  it('rejects absolute provider paths so callers cannot escape the configured base URL', () => {
    expect(() => joinProviderUrl('https://provider.example.com/v1', 'https://evil.example.com/steal')).toThrow(
      'Provider request path must be relative'
    );
  });

  it('aborts fetches after the configured provider timeout', async () => {
    vi.useFakeTimers();

    const fetchFn = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    try {
      const request = fetchProviderJson({
        baseUrl: 'https://provider.example.com/v1',
        path: '/chat/completions',
        timeoutMs: 25,
        fetchFn
      });
      const rejection = expect(request).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });

      await vi.advanceTimersByTimeAsync(25);
      await rejection;
      expect(fetchFn).toHaveBeenCalledWith(
        'https://provider.example.com/v1/chat/completions',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('parses successful JSON responses and rejects malformed provider JSON', async () => {
    await expect(parseProviderJsonResponse(new Response('{"ok":true}', { status: 200 }))).resolves.toEqual({
      ok: true
    });

    await expect(parseProviderJsonResponse(new Response('{', { status: 200 }))).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE'
    });
  });
});
