import { describe, expect, it } from 'vitest';

import { buildSubmitMessage, stripLeadingWorkflowCommand } from '@/pages/chat-home/chat-home-submit';

describe('chat-home-submit', () => {
  it('keeps explicit workflow commands and strips them only from display text', () => {
    expect(buildSubmitMessage('/browse 这个产品规划怎么样')).toEqual({
      display: '这个产品规划怎么样',
      payload: '/browse 这个产品规划怎么样'
    });
  });

  it('keeps normal natural-language input as direct chat payload by default', () => {
    expect(buildSubmitMessage('这个产品规划怎么样')).toEqual({
      display: '这个产品规划怎么样',
      payload: '这个产品规划怎么样'
    });
  });

  it('prefixes natural-language input with the planning workflow when plan mode is active', () => {
    expect(buildSubmitMessage('给我一个实现方案', ['plan'])).toEqual({
      display: '给我一个实现方案',
      payload: '/plan-eng-review 给我一个实现方案'
    });
  });

  it('can strip workflow commands case-insensitively', () => {
    expect(stripLeadingWorkflowCommand('/ReViEw 请帮我分析')).toBe('请帮我分析');
  });
});
