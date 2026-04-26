import { describe, expect, it, vi } from 'vitest';

import { buildConversationAnchors, scrollToConversationAnchor } from '@/pages/chat-home/chat-home-anchor-rail-helpers';
import type { ChatMessageRecord } from '@/types/chat';

function message(partial: Partial<ChatMessageRecord> & Pick<ChatMessageRecord, 'id' | 'role'>): ChatMessageRecord {
  return {
    sessionId: 'session-1',
    content: '',
    createdAt: '2026-04-26T00:00:00.000Z',
    ...partial
  } as ChatMessageRecord;
}

describe('chat-home conversation anchor rail helpers', () => {
  it('hides the rail until at least two conversation anchors can be built', () => {
    expect(
      buildConversationAnchors([
        message({
          id: 'user-1',
          role: 'user',
          content: '请帮我检查当前任务'
        })
      ])
    ).toEqual([]);
  });

  it('builds role and card anchors with stable ids, tones and truncated labels', () => {
    const anchors = buildConversationAnchors([
      message({
        id: 'user-1',
        role: 'user',
        content: '请帮我检查当前任务的上下文、风险、证据、审批和后续执行路径，并给出一个很长的目标描述'
      }),
      message({
        id: 'assistant-1',
        role: 'assistant',
        content: '我会先整理当前上下文'
      }),
      message({
        id: 'approval-1',
        role: 'system',
        card: {
          type: 'approval_request',
          intent: 'write_file',
          reason: '需要写入文件'
        }
      }),
      message({
        id: 'evidence-1',
        role: 'assistant',
        card: {
          type: 'evidence_digest',
          sources: [
            {
              id: 'source-1',
              sourceType: 'doc',
              trustClass: 'internal',
              summary: '规范来源'
            }
          ]
        }
      }),
      message({
        id: 'governance-1',
        role: 'system',
        card: {
          type: 'plan_question',
          title: '确认执行边界',
          questions: []
        }
      })
    ]);

    expect(anchors).toEqual([
      expect.objectContaining({
        id: 'chatx-message-anchor-user-1',
        messageId: 'user-1',
        tone: 'user'
      }),
      expect.objectContaining({
        id: 'chatx-message-anchor-assistant-1',
        messageId: 'assistant-1',
        tone: 'assistant',
        label: '我会先整理当前上下文'
      }),
      expect.objectContaining({
        id: 'chatx-message-anchor-approval-1',
        tone: 'approval',
        label: '审批请求'
      }),
      expect.objectContaining({
        id: 'chatx-message-anchor-evidence-1',
        tone: 'evidence',
        label: 'Evidence digest'
      }),
      expect.objectContaining({
        id: 'chatx-message-anchor-governance-1',
        tone: 'governance',
        label: '确认执行边界'
      })
    ]);
    expect(anchors[0]?.label.endsWith('...')).toBe(true);
    expect(anchors[0]?.label.length).toBeLessThanOrEqual(39);
  });

  it('scrolls to the target anchor and updates the active anchor id', () => {
    const scrollIntoView = vi.fn();
    const setActiveId = vi.fn();
    const getElementById = vi.fn(() => ({ scrollIntoView }));

    vi.stubGlobal('document', { getElementById });

    scrollToConversationAnchor(
      {
        id: 'chatx-message-anchor-user-1',
        messageId: 'user-1',
        label: '用户消息',
        tone: 'user'
      },
      setActiveId
    );

    expect(getElementById).toHaveBeenCalledWith('chatx-message-anchor-user-1');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(setActiveId).toHaveBeenCalledWith('chatx-message-anchor-user-1');

    vi.unstubAllGlobals();
  });
});
