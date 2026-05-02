import { describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/chat-home/chat-home-submit', () => ({
  buildSubmitMessage: (input: string, prefixes: string[] = []) => ({
    display: input.trim(),
    payload: prefixes.length ? `/${prefixes.join('-')} ${input.trim()}` : input.trim()
  }),
  stripLeadingWorkflowCommand: (input: string) => input.replace(/^\/\S+\s*/, '')
}));

import {
  buildQuickActionMenuItems,
  resetComposerState,
  resolveComposerChange,
  resolveComposerPlanModeChange,
  resolveComposerSubmit,
  resolveQuickActionSelection
} from '@/pages/chat-home/chat-home-workbench-composer-helpers';

describe('chat-home-workbench composer helpers', () => {
  const quickActionChips = [
    {
      label: '审查风险',
      value: '/review 请审查我当前会话里的改动和风险',
      icon: '!',
      tone: 'secondary' as const
    },
    {
      label: '列测试点',
      value: '/qa 请帮我列出这个需求的测试点和验收标准',
      icon: '#',
      tone: 'secondary' as const
    }
  ];

  it('maps quick action chips into dropdown menu items', () => {
    expect(buildQuickActionMenuItems(quickActionChips)).toEqual([
      {
        key: '审查风险',
        icon: '!',
        label: '审查风险'
      },
      {
        key: '列测试点',
        icon: '#',
        label: '列测试点'
      }
    ]);
  });

  it('resolves quick action selection into draft-prefill state', () => {
    expect(resolveQuickActionSelection(quickActionChips, '审查风险')).toEqual({
      draft: '请审查我当前会话里的改动和风险',
      suggestedPayload: '/review 请审查我当前会话里的改动和风险',
      planModeEnabled: false
    });
    expect(resolveQuickActionSelection(quickActionChips, 'missing')).toBeNull();
  });

  it('resets and updates composer state without carrying stale suggested payloads', () => {
    expect(resetComposerState()).toEqual({
      draft: '',
      suggestedPayload: null,
      planModeEnabled: false
    });
    expect(resolveComposerChange('继续执行', true)).toEqual({
      draft: '继续执行',
      suggestedPayload: null,
      planModeEnabled: true
    });
    expect(resolveComposerPlanModeChange(false, '继续执行')).toEqual({
      draft: '继续执行',
      suggestedPayload: null,
      planModeEnabled: false
    });
  });

  it('keeps suggested payloads only when plan mode is disabled', () => {
    expect(
      resolveComposerSubmit('请审查我当前会话里的改动和风险', '/review 请审查我当前会话里的改动和风险', false)
    ).toEqual({
      display: '请审查我当前会话里的改动和风险',
      payload: '/review 请审查我当前会话里的改动和风险'
    });

    expect(
      resolveComposerSubmit(
        '请审查我当前会话里的改动和风险，并重点看回归点',
        '/review 请审查我当前会话里的改动和风险',
        false
      )
    ).toEqual({
      display: '请审查我当前会话里的改动和风险，并重点看回归点',
      payload: '请审查我当前会话里的改动和风险，并重点看回归点'
    });

    expect(resolveComposerSubmit('给我一个实现方案', '/review 旧建议', true)).toEqual({
      display: '给我一个实现方案',
      payload: '/plan 给我一个实现方案'
    });
  });

  it('resolves composer submissions from the single chat entry', () => {
    expect(resolveComposerSubmit('你好', null, false)).toEqual({ display: '你好', payload: '你好' });
    expect(resolveComposerSubmit('拆解需求', null, true)).toEqual({
      display: '拆解需求',
      payload: '/plan 拆解需求'
    });
    expect(
      resolveComposerSubmit('请审查我当前会话里的改动和风险', '/review 请审查我当前会话里的改动和风险', false)
    ).toEqual({
      display: '请审查我当前会话里的改动和风险',
      payload: '/review 请审查我当前会话里的改动和风险'
    });
  });
});
