import { describe, expect, it } from 'vitest';

import { ThoughtChainFrameSchema } from '../../../src/shared/schemas/thought-chain-frame-schema';

describe('thought chain frame schema', () => {
  it('accepts valid thought chain frames with optional fields', () => {
    expect(
      ThoughtChainFrameSchema.parse({
        key: 'frame-1',
        title: '户部检索',
        description: '正在汇总检索结论',
        content: '命中了 3 条候选资料',
        footer: 'evidence ready',
        status: 'success',
        collapsible: true,
        blink: false
      })
    ).toEqual({
      key: 'frame-1',
      title: '户部检索',
      description: '正在汇总检索结论',
      content: '命中了 3 条候选资料',
      footer: 'evidence ready',
      status: 'success',
      collapsible: true,
      blink: false
    });
  });

  it('rejects invalid status values and missing required fields', () => {
    expect(() =>
      ThoughtChainFrameSchema.parse({
        key: 'frame-2',
        status: 'done'
      })
    ).toThrow();

    expect(() =>
      ThoughtChainFrameSchema.parse({
        title: '缺少 key'
      })
    ).toThrow();
  });
});
