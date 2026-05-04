import { describe, expect, it } from 'vitest';

import { foldAgentChatRuntimeEvent } from '@/chat-runtime/agent-chat-event-adapter';

describe('foldAgentChatRuntimeEvent', () => {
  it('projects checkpoint, thought chain and response steps onto one assistant message', () => {
    const next = foldAgentChatRuntimeEvent({
      currentMessage: {
        role: 'assistant',
        content: 'Working',
        kind: 'mixed',
        meta: {}
      },
      event: {
        type: 'checkpoint.updated',
        thinkState: { loading: true, messageId: 'm-assistant', thinkingDurationMs: 1200 },
        thoughtChain: [{ id: 'step-1', title: '检索中' }],
        responseSteps: [{ id: 'r-1', label: 'Search docs' }]
      }
    });

    expect(next.meta?.think?.loading).toBe(true);
    expect(next.meta?.thoughtChain).toHaveLength(1);
    expect(next.meta?.responseSteps).toHaveLength(1);
  });
});
