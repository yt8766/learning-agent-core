import { describe, expect, it } from 'vitest';

import { getWorkbenchInterruptCopy } from '@/pages/chat-home/chat-home-workbench-sections';

// activeInterrupt in these tests is the persisted 司礼监 / InterruptController projection.
describe('chat-home-workbench-sections helpers', () => {
  it('returns plan-question copy for planning interrupts', () => {
    expect(
      getWorkbenchInterruptCopy({
        activeInterrupt: {
          kind: 'user-input',
          payload: { interactionKind: 'plan-question' }
        },
        planDraft: {
          questionSet: {
            title: '方案确认',
            summary: '需要你确认整体方向。'
          }
        }
      } as any)
    ).toEqual(
      expect.objectContaining({
        tag: '计划提问',
        summary: '方案确认'
      })
    );
  });
});
