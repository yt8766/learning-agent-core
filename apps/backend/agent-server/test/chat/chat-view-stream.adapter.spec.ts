import { describe, expect, it } from 'vitest';

import { ChatViewStreamEventSchema, type ChatEventRecord, type ChatRunRecord } from '@agent/core';

import { projectChatViewStreamEvents } from '../../src/chat/chat-view-stream.adapter';

const run = {
  id: 'run-1',
  sessionId: 'session-1',
  requestMessageId: 'message-user-1',
  responseMessageId: 'message-assistant-1',
  route: 'supervisor',
  status: 'running',
  createdAt: '2026-05-05T10:00:00.000Z',
  startedAt: '2026-05-05T10:00:01.000Z'
} satisfies ChatRunRecord;

const baseEvent = {
  sessionId: 'session-1',
  at: '2026-05-05T10:00:02.000Z',
  payload: {}
} satisfies Partial<ChatEventRecord>;

describe('chat view stream adapter', () => {
  it('projects assistant token deltas into parsed fragment delta view events with stable envelope fields', () => {
    const events = projectChatViewStreamEvents(
      [
        {
          ...baseEvent,
          id: 'event-token-1',
          type: 'assistant_token',
          payload: { content: '你好' }
        } as ChatEventRecord
      ],
      {
        run,
        nextSeq: 7
      }
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: 'view-event-token-1-fragment_delta-0',
      seq: 7,
      sessionId: 'session-1',
      runId: 'run-1',
      at: '2026-05-05T10:00:02.000Z',
      event: 'fragment_delta',
      data: {
        messageId: 'message-assistant-1',
        fragmentId: 'fragment-run-1-response',
        delta: '你好'
      }
    });
    expect(ChatViewStreamEventSchema.parse(events[0])).toEqual(events[0]);
  });

  it('projects assistant completion into fragment completion, completed run status, and close events', () => {
    const events = projectChatViewStreamEvents(
      [
        {
          ...baseEvent,
          id: 'event-final',
          type: 'final_response_completed',
          payload: { messageId: 'message-assistant-2', content: '完成了' }
        } as ChatEventRecord
      ],
      {
        run: { ...run, responseMessageId: 'message-assistant-2' },
        nextSeq: 0
      }
    );

    expect(events.map(event => event.event)).toEqual(['fragment_completed', 'run_status', 'close']);
    expect(events.map(event => event.seq)).toEqual([0, 1, 2]);
    expect(events[0].data).toMatchObject({
      messageId: 'message-assistant-2',
      fragmentId: 'fragment-run-1-response',
      kind: 'response',
      status: 'completed',
      content: '完成了'
    });
    expect(events[1].data).toMatchObject({ status: 'completed', completedAt: '2026-05-05T10:00:02.000Z' });
    expect(events[2].data).toEqual({ reason: 'completed' });
    expect(events.map(event => ChatViewStreamEventSchema.parse(event))).toEqual(events);
  });

  it('projects assistant message records into the same terminal view stream events', () => {
    const events = projectChatViewStreamEvents(
      [
        {
          ...baseEvent,
          id: 'event-assistant-message',
          type: 'assistant_message',
          payload: { messageId: 'message-assistant-1', content: '这是最终回复' }
        } as ChatEventRecord
      ],
      {
        run,
        nextSeq: 3
      }
    );

    expect(events.map(event => event.event)).toEqual(['fragment_completed', 'run_status', 'close']);
    expect(events.map(event => event.seq)).toEqual([3, 4, 5]);
    expect(events[0].data).toMatchObject({ content: '这是最终回复' });
  });

  it('projects session failures into error and close events', () => {
    const events = projectChatViewStreamEvents(
      [
        {
          ...baseEvent,
          id: 'event-failed',
          type: 'session_failed',
          payload: { code: 'runtime_failed', message: '运行失败' }
        } as ChatEventRecord
      ],
      {
        run,
        nextSeq: 2
      }
    );

    expect(events.map(event => event.event)).toEqual(['error', 'close']);
    expect(events.map(event => event.seq)).toEqual([2, 3]);
    expect(events[0].data).toEqual({ code: 'runtime_failed', message: '运行失败', recoverable: true });
    expect(events[1].data).toEqual({ reason: 'error', retryable: true });
  });

  it('projects node progress chat response projections into step updates', () => {
    const events = projectChatViewStreamEvents(
      [
        {
          ...baseEvent,
          id: 'event-step',
          type: 'node_progress',
          payload: {
            projection: 'chat_response_step',
            action: 'completed',
            step: {
              id: 'step-1',
              title: 'Ran tests',
              status: 'completed'
            }
          }
        } as ChatEventRecord
      ],
      {
        run,
        nextSeq: 0
      }
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'step_updated',
      data: {
        action: 'completed',
        step: {
          id: 'step-1',
          title: 'Ran tests',
          status: 'completed'
        },
        sourceEventId: 'event-step'
      }
    });
    expect(ChatViewStreamEventSchema.parse(events[0])).toEqual(events[0]);
  });

  it('projects tool approval interrupts into natural-language interaction waiting events', () => {
    const events = projectChatViewStreamEvents(
      [
        {
          ...baseEvent,
          id: 'event-interrupt',
          type: 'interrupt_pending',
          payload: {
            kind: 'tool_execution',
            requestId: 'request-1',
            approvalId: 'approval_request-1',
            interruptId: 'interrupt_request-1',
            riskClass: 'high'
          }
        } as ChatEventRecord
      ],
      {
        run,
        nextSeq: 4
      }
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'interaction_waiting',
      seq: 4,
      data: {
        naturalLanguageOnly: true,
        interaction: {
          id: 'agent_tool:request-1',
          sessionId: 'session-1',
          runId: 'run-1',
          kind: 'tool_approval',
          status: 'pending',
          promptMessageId: 'message-assistant-1',
          interruptId: 'interrupt_request-1',
          expectedActions: ['approve', 'reject', 'feedback'],
          requiredConfirmationPhrase: '确认执行',
          createdAt: '2026-05-05T10:00:02.000Z'
        }
      }
    });
    expect(ChatViewStreamEventSchema.parse(events[0])).toEqual(events[0]);
  });

  it('projects tool stream dispatches into whitelisted tool execution started events', () => {
    const events = projectChatViewStreamEvents(
      [
        {
          ...baseEvent,
          id: 'event-tool-dispatched',
          type: 'tool_stream_dispatched',
          payload: {
            toolName: 'shell',
            toolDisplayName: 'Shell',
            command: 'cat secret.txt',
            rawInput: { token: 'secret' },
            userFacingSummary: '正在执行只读命令',
            riskLevel: 'low'
          }
        } as ChatEventRecord
      ],
      {
        run,
        nextSeq: 8
      }
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'tool_execution_started',
      seq: 8,
      data: {
        toolName: 'shell',
        toolDisplayName: 'Shell',
        status: 'running',
        riskLevel: 'low',
        userFacingSummary: '正在执行只读命令'
      }
    });
    expect(events[0]?.data).not.toHaveProperty('rawInput');
    expect(events[0]?.data).not.toHaveProperty('command');
    expect(ChatViewStreamEventSchema.parse(events[0])).toEqual(events[0]);
  });

  it('projects tool stream completions into whitelisted tool execution completed events', () => {
    const events = projectChatViewStreamEvents(
      [
        {
          ...baseEvent,
          id: 'event-tool-completed',
          type: 'tool_stream_completed',
          payload: {
            toolName: 'shell',
            status: 'completed',
            elapsedMs: 120,
            stdout: 'secret output',
            providerRawResponse: { leaked: true },
            userFacingSummary: '验证命令已完成'
          }
        } as ChatEventRecord
      ],
      {
        run,
        nextSeq: 9
      }
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      event: 'tool_execution_completed',
      seq: 9,
      data: {
        toolName: 'shell',
        status: 'completed',
        elapsedMs: 120,
        userFacingSummary: '验证命令已完成'
      }
    });
    expect(events[0]?.data).not.toHaveProperty('stdout');
    expect(events[0]?.data).not.toHaveProperty('providerRawResponse');
    expect(ChatViewStreamEventSchema.parse(events[0])).toEqual(events[0]);
  });
});
