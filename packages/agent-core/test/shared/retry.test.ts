import { describe, expect, it, vi } from 'vitest';

import { withLlmRetry } from '../../src/utils/retry';

describe('withLlmRetry', () => {
  it('appends error feedback and retries retryable errors', async () => {
    const invoke = vi.fn().mockRejectedValueOnce(new Error('Schema parse failed')).mockResolvedValueOnce({ ok: true });

    const result = await withLlmRetry(invoke, [{ role: 'user', content: 'hello' }]);

    expect(result).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1]?.[0]?.[1]?.content).toContain('上一次生成失败');
  });

  it('does not retry non-retryable errors by default', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('rate limited by policy gate'));

    await expect(withLlmRetry(invoke, [{ role: 'user', content: 'hello' }])).rejects.toThrow(
      'rate limited by policy gate'
    );
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
