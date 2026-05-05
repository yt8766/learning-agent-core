import { describe, expect, it, vi } from 'vitest';

import { isStreamTerminalEvent, syncEvent } from '../src/runtime/codex-chat-events';
import { readPayloadText, toUiMessage } from '../src/runtime/codex-chat-message';
import { fallbackTitleFromMessage, sanitizeGeneratedTitle, toConversationLabel } from '../src/runtime/codex-chat-title';
import type { ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '../src/types/chat';

describe('codex chat runtime helpers', () => {
  it('sanitizes generated titles and falls back to message text', () => {
    expect(sanitizeGeneratedTitle('data: {"content":"标题： “修复 SSE 流式问题！”"}\n\n')).toBe('修复 SSE 流式问题');
    expect(sanitizeGeneratedTitle('```json\n{"title":"隐藏标题"}\n```\n标题： 实际标题')).toBe('实际标题');
    expect(fallbackTitleFromMessage('  请帮我分析：前端 SSE 断流问题！  ')).toBe('请帮我分析前端SSE断流问题');
    expect(toConversationLabel({ title: '  ', id: 's1' } as ChatSessionRecord)).toBe('新对话');
  });

  it('reads payload text from supported stream payload fields', () => {
    expect(readPayloadText({ content: 'content' })).toBe('content');
    expect(readPayloadText({ delta: 'delta' })).toBe('delta');
    expect(readPayloadText({ text: 'text' })).toBe('text');
    expect(readPayloadText({ message: 'message' })).toBe('message');
    expect(readPayloadText({ finalResponse: 'final' })).toBe('final');
    expect(readPayloadText({ content: 42 })).toBe('');
  });

  it('maps persisted records to UI messages with visible reasoning split out', () => {
    const record: ChatMessageRecord = {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'assistant',
      content: '<think>先分析</think>可见回答',
      createdAt: '2026-05-05T10:00:00.000Z'
    };

    expect(toUiMessage(record)).toEqual({
      id: 'msg-1',
      status: 'success',
      message: {
        role: 'assistant',
        content: '可见回答',
        reasoning: '先分析'
      }
    });
  });

  it('syncs assistant stream and terminal events into UI messages', () => {
    vi.setSystemTime(new Date('2026-05-05T10:00:05.000Z'));
    const startedAt = Date.now() - 5000;
    const initial = [
      {
        id: 'assistant-session-1',
        status: 'loading' as const,
        message: {
          role: 'assistant' as const,
          content: '',
          thinkingDurationMs: startedAt
        }
      }
    ];

    const deltaEvent = createEvent('final_response_delta', { messageId: 'assistant-session-1', delta: '你好' });
    const completedEvent = createEvent('final_response_completed', {
      messageId: 'assistant-session-1',
      finalResponse: '你好，完成'
    });

    expect(isStreamTerminalEvent(completedEvent.type)).toBe(true);
    const afterDelta = syncEvent(initial, deltaEvent);
    expect(afterDelta[0]?.message.content).toBe('你好');
    expect(afterDelta[0]?.status).toBe('updating');

    const afterCompleted = syncEvent(afterDelta, completedEvent);
    expect(afterCompleted[0]?.message.content).toBe('你好，完成');
    expect(afterCompleted[0]?.status).toBe('success');
    expect(afterCompleted[0]?.message.thinkingDurationMs).toBe(5000);
  });

  it('syncs approval events into blocked assistant messages', () => {
    const messages = [
      {
        id: 'assistant-session-1',
        status: 'success' as const,
        message: { role: 'assistant' as const, content: '准备执行' }
      }
    ];

    const next = syncEvent(
      messages,
      createEvent('approval_required', {
        interruptId: 'approval-1',
        toolName: 'run_terminal',
        reason: '命令会修改文件'
      })
    );

    expect(next.at(-1)).toMatchObject({
      id: 'approval-approval-1',
      status: 'success',
      message: {
        role: 'assistant',
        approvalPending: true,
        content: expect.stringContaining('run_terminal 需要人工审批')
      }
    });
  });
});

function createEvent(type: string, payload: Record<string, unknown>): ChatEventRecord {
  return {
    id: `${type}-1`,
    sessionId: 'session-1',
    type,
    at: '2026-05-05T10:00:00.000Z',
    payload
  };
}
