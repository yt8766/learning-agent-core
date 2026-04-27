import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, requestMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  requestMock: vi.fn()
}));

vi.mock('axios', () => {
  class CanceledError extends Error {
    code = 'ERR_CANCELED';
  }

  return {
    default: {
      create: createMock.mockImplementation(() => ({
        request: requestMock
      })),
      isCancel: vi.fn((error: unknown) => error instanceof CanceledError),
      isAxiosError: vi.fn((error: unknown) => typeof error === 'object' && error !== null && 'response' in error),
      CanceledError
    }
  };
});

import {
  ABORTED_REQUEST_ERROR,
  getHealth,
  getPlatformConsole,
  getPlatformConsoleShell,
  isAbortedAdminRequestError,
  request
} from '@/api/admin-api-core';

describe('admin-api-core', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    requestMock.mockReset();
  });

  it('uses the loopback ipv4 backend as the default api base', () => {
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://127.0.0.1:3000/api',
        withCredentials: true
      })
    );
  });

  it('sends json requests with the default api base and returns parsed payloads', async () => {
    requestMock
      .mockResolvedValueOnce({ data: { status: 'ok', now: '12:00' } })
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockResolvedValueOnce({ data: { ok: true } });

    await expect(getHealth()).resolves.toEqual({ status: 'ok', now: '12:00' });
    await getPlatformConsole(
      14,
      {
        status: 'running',
        model: 'gpt-5.4',
        pricingSource: 'provider',
        runtimeExecutionMode: 'plan',
        runtimeInteractionKind: 'approval',
        approvalsExecutionMode: 'execute',
        approvalsInteractionKind: 'plan-question'
      },
      'full'
    );
    await getPlatformConsoleShell(14, {
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider',
      runtimeExecutionMode: 'plan',
      runtimeInteractionKind: 'approval',
      approvalsExecutionMode: 'execute',
      approvalsInteractionKind: 'plan-question'
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/health',
        method: 'GET'
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/platform/console?days=14&view=full&status=running&model=gpt-5.4&pricingSource=provider&runtimeExecutionMode=plan&runtimeInteractionKind=approval&approvalsExecutionMode=execute&approvalsInteractionKind=plan-question',
        method: 'GET'
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        url: '/platform/console-shell?days=14&status=running&model=gpt-5.4&pricingSource=provider&runtimeExecutionMode=plan&runtimeInteractionKind=approval&approvalsExecutionMode=execute&approvalsInteractionKind=plan-question',
        method: 'GET'
      })
    );
  });

  it('normalizes non-ok and abort failures', async () => {
    const { default: axios } = await import('axios');
    requestMock
      .mockRejectedValueOnce({
        response: {
          status: 503
        }
      })
      .mockRejectedValueOnce(new axios.CanceledError('aborted'));

    await expect(request('/boom')).rejects.toThrow('Request failed: 503');
    await expect(request('/abort')).rejects.toThrow(ABORTED_REQUEST_ERROR);
    expect(isAbortedAdminRequestError(new Error(ABORTED_REQUEST_ERROR))).toBe(true);
    expect(isAbortedAdminRequestError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isAbortedAdminRequestError(new Error('other'))).toBe(false);
  });

  it('aborts the previous in-flight request when cancelPrevious is enabled for the same key', async () => {
    const { default: axios } = await import('axios');
    requestMock
      .mockImplementationOnce((config?: { signal?: AbortSignal }) => {
        const signal = config?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new axios.CanceledError('aborted')), { once: true });
        });
      })
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: { ok: true }
        })
      );

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
    expect(requestMock).toHaveBeenCalledTimes(2);
  });
});
