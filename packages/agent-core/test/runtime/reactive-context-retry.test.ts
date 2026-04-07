import { describe, expect, it, vi } from 'vitest';

import {
  buildCompactedMessages,
  isLikelyContextOverflow,
  withReactiveContextRetry
} from '../../src/utils/reactive-context-retry';

describe('reactive-context-retry helpers', () => {
  it('detects common context overflow error messages', () => {
    expect(isLikelyContextOverflow(new Error('maximum context length exceeded'))).toBe(true);
    expect(isLikelyContextOverflow('prompt is too long for the current context window')).toBe(true);
    expect(isLikelyContextOverflow(new Error('network timeout'))).toBe(false);
  });

  it('builds compacted messages from leading system context and trailing user history', () => {
    const messages = buildCompactedMessages(
      [
        { role: 'system', content: 'system-rules' },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
        { role: 'user', content: 'x'.repeat(300) }
      ],
      'summary text'
    );

    expect(messages).toEqual([
      { role: 'system', content: 'system-rules' },
      { role: 'system', content: 'Earlier context compacted for retry:\nsummary text' },
      { role: 'assistant', content: 'second' },
      { role: 'user', content: `${'x'.repeat(237)}...` }
    ]);
  });

  it('retries with compacted messages and emits compaction callback on overflow', async () => {
    const onContextCompaction = vi.fn();
    const invoke = vi
      .fn()
      .mockRejectedValueOnce(new Error('context window exceeded'))
      .mockResolvedValueOnce('retry-ok');

    await expect(
      withReactiveContextRetry({
        context: {
          goal: 'Summarize logs',
          onContextCompaction
        } as any,
        trigger: 'llm_generate_text',
        messages: [
          { role: 'system', content: 'rules' },
          { role: 'user', content: 'error stack trace stdout stderr '.repeat(20) },
          { role: 'assistant', content: 'previous answer' },
          { role: 'user', content: 'please retry with context' }
        ],
        invoke
      })
    ).resolves.toBe('retry-ok');

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(onContextCompaction).toHaveBeenCalledWith({
      trigger: 'llm_generate_text',
      result: expect.objectContaining({
        reactiveRetryCount: 1
      })
    });
    expect(invoke.mock.calls[1]?.[0]).toEqual(
      expect.arrayContaining([
        { role: 'system', content: 'rules' },
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Earlier context compacted for retry:')
        })
      ])
    );
  });

  it('rethrows non-overflow errors without retrying', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('provider timeout'));

    await expect(
      withReactiveContextRetry({
        context: { goal: 'Summarize logs' } as any,
        trigger: 'llm_generate_text',
        messages: [{ role: 'user', content: 'hello' }],
        invoke
      })
    ).rejects.toThrow('provider timeout');

    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
