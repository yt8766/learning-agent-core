import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ABORTED_REQUEST_ERROR,
  getHealth,
  getPlatformConsole,
  isAbortedAdminRequestError,
  request
} from '@/api/admin-api-core';

describe('admin-api-core', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends json requests with the default api base and returns parsed payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ status: 'ok', now: '12:00' })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getHealth()).resolves.toEqual({ status: 'ok', now: '12:00' });
    await getPlatformConsole(14, {
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider',
      runtimeExecutionMode: 'plan',
      runtimeInteractionKind: 'approval',
      approvalsExecutionMode: 'execute',
      approvalsInteractionKind: 'plan-question'
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/health',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/platform/console?days=14&status=running&model=gpt-5.4&pricingSource=provider&runtimeExecutionMode=plan&runtimeInteractionKind=approval&approvalsExecutionMode=execute&approvalsInteractionKind=plan-question',
      expect.objectContaining({
        cancelKey: 'platform-console',
        cancelPrevious: true,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    );
  });

  it('normalizes non-ok and abort failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 503
        })
        .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    );

    await expect(request('/boom')).rejects.toThrow('Request failed: 503');
    await expect(request('/abort')).rejects.toThrow(ABORTED_REQUEST_ERROR);
    expect(isAbortedAdminRequestError(new Error(ABORTED_REQUEST_ERROR))).toBe(true);
    expect(isAbortedAdminRequestError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isAbortedAdminRequestError(new Error('other'))).toBe(false);
  });

  it('aborts the previous in-flight request when cancelPrevious is enabled for the same key', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url: string, init?: RequestInit) => {
        const signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
        });
      })
      .mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: vi.fn().mockResolvedValue({ ok: true })
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const first = request('/platform/console?days=30', {
      cancelKey: 'platform-console',
      cancelPrevious: true
    });
    const second = request('/platform/console?days=30', {
      cancelKey: 'platform-console',
      cancelPrevious: true
    });

    await expect(first).rejects.toThrow(ABORTED_REQUEST_ERROR);
    await expect(second).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
