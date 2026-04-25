import { describe, expect, it, vi } from 'vitest';

import { adminActionErrorMessage, runAdminActionWithFeedback } from '../src/admin/admin-action-feedback.js';

const { toastPromiseMock } = vi.hoisted(() => ({
  toastPromiseMock: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    promise: toastPromiseMock
  }
}));

describe('admin action feedback', () => {
  it('uses backend error messages before fallback text', () => {
    expect(adminActionErrorMessage(new Error('Set LLM_GATEWAY_PROVIDER_SECRET_KEY.'), '服务商保存失败。')).toBe(
      'Set LLM_GATEWAY_PROVIDER_SECRET_KEY.'
    );
    expect(adminActionErrorMessage('unknown', '服务商保存失败。')).toBe('服务商保存失败。');
  });

  it('registers toast feedback and reports normalized error messages', async () => {
    const onError = vi.fn();
    const error = new Error('服务商保存失败：缺少加密密钥。');

    await expect(
      runAdminActionWithFeedback(
        async () => {
          throw error;
        },
        { loading: '正在保存服务商...', success: '服务商已保存。', error: '服务商保存失败。' },
        onError
      )
    ).rejects.toThrow(error);

    const toastOptions = toastPromiseMock.mock.calls[0][1];
    expect(toastOptions.error(error)).toBe('服务商保存失败：缺少加密密钥。');
    expect(onError).toHaveBeenCalledWith('服务商保存失败：缺少加密密钥。');
  });
});
