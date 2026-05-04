import { describe, expect, it } from 'vitest';

import { buildApprovalCardCommands } from '@/chat-runtime/agent-chat-card-commands';
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

  it('preserves accumulated projections when a partial event omits them', () => {
    const cards = [
      {
        surfaceId: 'approval-surface',
        commands: buildApprovalCardCommands('approval-surface', '等待审批')
      }
    ];
    const next = foldAgentChatRuntimeEvent({
      currentMessage: {
        role: 'assistant',
        content: 'Working',
        kind: 'mixed',
        meta: {
          think: { loading: true, messageId: 'm-assistant', thinkingDurationMs: 1200 },
          thoughtChain: [{ id: 'step-1', title: '检索中' }],
          responseSteps: [{ id: 'r-1', label: 'Search docs' }],
          cards
        }
      },
      event: {
        type: 'checkpoint.updated',
        thinkState: { loading: false, messageId: 'm-assistant', thinkingDurationMs: 1800 }
      }
    });

    expect(next.meta?.think).toEqual({ loading: false, messageId: 'm-assistant', thinkingDurationMs: 1800 });
    expect(next.meta?.thoughtChain).toEqual([{ id: 'step-1', title: '检索中' }]);
    expect(next.meta?.responseSteps).toEqual([{ id: 'r-1', label: 'Search docs' }]);
    expect(next.meta?.cards).toBe(cards);
  });
});
