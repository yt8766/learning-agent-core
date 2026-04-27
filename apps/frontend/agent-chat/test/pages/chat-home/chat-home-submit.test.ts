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
      payload: '/plan 给我一个实现方案'
    });
  });

  it('prefixes natural-language input with the browse workflow when search mode is active', () => {
    expect(buildSubmitMessage('帮我查一下最新信息', ['browse'])).toEqual({
      display: '帮我查一下最新信息',
      payload: '/browse 帮我查一下最新信息'
    });
  });

  it('prefers browse workflow when both supported composer modes are active', () => {
    expect(buildSubmitMessage('先查资料再整理方案', ['plan', 'browse'])).toEqual({
      display: '先查资料再整理方案',
      payload: '/browse 先查资料再整理方案'
    });
  });

  it('keeps the lightweight /plan command as an explicit workflow command', () => {
    expect(buildSubmitMessage('/plan 给我一个实现方案')).toEqual({
      display: '给我一个实现方案',
      payload: '/plan 给我一个实现方案'
    });
  });

  it('keeps longer planning commands compatible when stripping display text', () => {
    expect(stripLeadingWorkflowCommand('/plan-eng-review 给我方案')).toBe('给我方案');
    expect(buildSubmitMessage('/plan-ceo-review 复核方案')).toEqual({
      display: '复核方案',
      payload: '/plan-ceo-review 复核方案'
    });
  });

  it('can strip workflow commands case-insensitively', () => {
    expect(stripLeadingWorkflowCommand('/ReViEw 请帮我分析')).toBe('请帮我分析');
  });
});
