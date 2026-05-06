import { describe, expect, it, vi } from 'vitest';

import type { ChatEventRecord } from '@agent/core';

import { ChatService } from '../../src/chat/chat.service';
import { buildChatResponseStepEvent, buildChatResponseStepSnapshot } from '../../src/chat/chat-response-steps.adapter';

const at = '2026-05-03T09:00:00.000Z';

describe('ChatService response step projections', () => {
  it('projects historical response steps and a completion snapshot from ordered session events', () => {
    const service = createRealChatServiceWithEvents([
      {
        id: 'event-token-1',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-05-02T08:29:59.000Z',
        payload: { messageId: 'assistant-1', content: '你' }
      },
      {
        id: 'event-tool-1',
        sessionId: 'session-1',
        type: 'tool_called',
        at: '2026-05-02T08:30:00.000Z',
        payload: {
          messageId: 'assistant-1',
          title: 'Read chat-message-adapter.tsx',
          path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx',
          agentScope: 'main',
          agentId: 'supervisor',
          agentLabel: '首辅',
          ownerLabel: '主 Agent',
          nodeId: 'request-received',
          nodeLabel: '接收请求',
          toNodeId: 'route-selection'
        }
      },
      {
        id: 'event-done-1',
        sessionId: 'session-1',
        type: 'final_response_completed',
        at: '2026-05-02T08:31:00.000Z',
        payload: { messageId: 'assistant-1' }
      }
    ] as ChatEventRecord[]);

    const events = service.listEvents('session-1');

    expect(events).toContainEqual(
      expect.objectContaining({
        id: 'response-step-event-event-tool-1',
        type: 'node_progress',
        payload: expect.objectContaining({
          projection: 'chat_response_step',
          action: 'started',
          step: expect.objectContaining({
            messageId: 'assistant-1',
            sequence: 0,
            phase: 'explore',
            status: 'running',
            title: 'Read chat-message-adapter.tsx',
            agentScope: 'main',
            agentId: 'supervisor',
            agentLabel: '首辅',
            ownerLabel: '主 Agent',
            nodeId: 'request-received',
            nodeLabel: '接收请求',
            toNodeId: 'route-selection'
          })
        })
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        id: 'response-step-snapshot-assistant-1',
        type: 'node_progress',
        payload: expect.objectContaining({
          projection: 'chat_response_steps',
          messageId: 'assistant-1',
          status: 'completed',
          summary: expect.objectContaining({
            completedCount: expect.any(Number),
            runningCount: expect.any(Number)
          })
        })
      })
    );
  });

  it('projects realtime response steps using the assistant message id from payloads', () => {
    let pushedListener: ((event: ChatEventRecord) => void) | undefined;
    const runtimeSessionService = {
      listSessionEvents: vi.fn(() => []),
      subscribeSession: vi.fn((_sessionId: string, listener: (event: ChatEventRecord) => void) => {
        pushedListener = listener;
        return vi.fn();
      })
    };
    const service = new ChatService(runtimeSessionService as never, {} as never, {} as never);
    const received: ChatEventRecord[] = [];

    service.subscribe('session-1', event => {
      received.push(event);
    });
    pushedListener?.({
      id: 'event-tool-1',
      sessionId: 'session-1',
      type: 'tool_called',
      at: '2026-05-02T08:30:00.000Z',
      payload: {
        messageId: 'assistant-from-payload',
        title: 'Read chat-message-adapter.tsx',
        path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx'
      }
    } as ChatEventRecord);

    expect(received).toContainEqual(
      expect.objectContaining({
        id: 'response-step-event-event-tool-1',
        type: 'node_progress',
        payload: expect.objectContaining({
          projection: 'chat_response_step',
          step: expect.objectContaining({
            messageId: 'assistant-from-payload',
            sequence: 0
          })
        })
      })
    );
  });

  it('keeps response step snapshots scoped to each assistant message', () => {
    const service = createRealChatServiceWithEvents([
      {
        id: 'event-tool-1',
        sessionId: 'session-1',
        type: 'tool_called',
        at: '2026-05-02T08:30:00.000Z',
        payload: {
          messageId: 'assistant-1',
          title: 'Read first file',
          path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx'
        }
      },
      {
        id: 'event-done-1',
        sessionId: 'session-1',
        type: 'final_response_completed',
        at: '2026-05-02T08:31:00.000Z',
        payload: { messageId: 'assistant-1' }
      },
      {
        id: 'event-tool-2',
        sessionId: 'session-1',
        type: 'tool_called',
        at: '2026-05-02T08:32:00.000Z',
        payload: {
          messageId: 'assistant-2',
          title: 'Read second file',
          path: 'apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx'
        }
      },
      {
        id: 'event-done-2',
        sessionId: 'session-1',
        type: 'final_response_completed',
        at: '2026-05-02T08:33:00.000Z',
        payload: { messageId: 'assistant-2' }
      }
    ] as ChatEventRecord[]);

    const secondSnapshot = service
      .listEvents('session-1')
      .find(event => event.id === 'response-step-snapshot-assistant-2');

    expect(secondSnapshot?.payload).toEqual(
      expect.objectContaining({
        projection: 'chat_response_steps',
        messageId: 'assistant-2',
        steps: expect.arrayContaining([
          expect.objectContaining({
            messageId: 'assistant-2',
            title: 'Read second file',
            sequence: 0
          })
        ])
      })
    );
    expect((secondSnapshot?.payload as { steps?: Array<{ messageId: string }> }).steps).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          messageId: 'assistant-1'
        })
      ])
    );
  });

  it('continues realtime sequence and message ownership from historical events', () => {
    let pushedListener: ((event: ChatEventRecord) => void) | undefined;
    const runtimeSessionService = {
      listSessionEvents: vi.fn(() => [
        {
          id: 'event-tool-history',
          sessionId: 'session-1',
          type: 'tool_called',
          at: '2026-05-02T08:30:00.000Z',
          payload: {
            messageId: 'assistant-1',
            title: 'Read history file',
            path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx'
          }
        }
      ]),
      subscribeSession: vi.fn((_sessionId: string, listener: (event: ChatEventRecord) => void) => {
        pushedListener = listener;
        return vi.fn();
      })
    };
    const service = new ChatService(runtimeSessionService as never, {} as never, {} as never);
    const received: ChatEventRecord[] = [];

    service.subscribe('session-1', event => {
      received.push(event);
    });
    pushedListener?.({
      id: 'event-tool-realtime',
      sessionId: 'session-1',
      type: 'execution_step_started',
      at: '2026-05-02T08:31:00.000Z',
      payload: {
        title: 'Ran realtime command',
        command: 'pnpm exec vitest run'
      }
    } as ChatEventRecord);

    expect(received).toContainEqual(
      expect.objectContaining({
        id: 'response-step-event-event-tool-realtime',
        payload: expect.objectContaining({
          projection: 'chat_response_step',
          step: expect.objectContaining({
            messageId: 'assistant-1',
            sequence: 1,
            title: 'Ran realtime command'
          })
        })
      })
    );
  });

  it('does not let user message ids own later response step projections', () => {
    const service = createRealChatServiceWithEvents([
      {
        id: 'event-user-1',
        sessionId: 'session-1',
        type: 'user_message',
        at: '2026-05-02T08:29:58.000Z',
        payload: { messageId: 'user-1', content: '继续' }
      },
      {
        id: 'event-token-1',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-05-02T08:29:59.000Z',
        payload: { messageId: 'assistant-1', content: '好' }
      },
      {
        id: 'event-tool-1',
        sessionId: 'session-1',
        type: 'tool_called',
        at: '2026-05-02T08:30:00.000Z',
        payload: {
          title: 'Read chat-message-adapter.tsx',
          path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx'
        }
      }
    ] as ChatEventRecord[]);

    const projectedStep = service
      .listEvents('session-1')
      .find(event => event.id === 'response-step-event-event-tool-1');

    expect(projectedStep?.payload).toEqual(
      expect.objectContaining({
        projection: 'chat_response_step',
        step: expect.objectContaining({
          messageId: 'assistant-1'
        })
      })
    );
  });

  it('finalizes running steps before emitting a completed snapshot', () => {
    const service = createRealChatServiceWithEvents([
      {
        id: 'event-token-1',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-05-02T08:29:59.000Z',
        payload: { messageId: 'assistant-1', content: '好' }
      },
      {
        id: 'event-tool-1',
        sessionId: 'session-1',
        type: 'tool_called',
        at: '2026-05-02T08:30:00.000Z',
        payload: {
          title: 'Read chat-message-adapter.tsx',
          path: 'apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx'
        }
      },
      {
        id: 'event-done-1',
        sessionId: 'session-1',
        type: 'final_response_completed',
        at: '2026-05-02T08:31:00.000Z',
        payload: { messageId: 'assistant-1' }
      }
    ] as ChatEventRecord[]);

    const snapshot = service.listEvents('session-1').find(event => event.id === 'response-step-snapshot-assistant-1');
    const steps = (snapshot?.payload as { steps?: Array<{ status: string }> }).steps ?? [];

    expect(steps).not.toEqual(expect.arrayContaining([expect.objectContaining({ status: 'running' })]));
    expect(snapshot?.payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          runningCount: 0
        })
      })
    );
  });
});

describe('chat response steps Agent OS grouping', () => {
  it('marks snapshots with command and verification steps as agent execution', () => {
    const command = buildAgentOsStep('execution_step_started', 0, {
      title: 'Ran pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx',
      command: 'pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx'
    });
    const finished = buildAgentOsStep('final_response_completed', 1, { title: '整理最终回复' });
    const snapshot = buildAgentOsSnapshot([command, finished]);

    expect(snapshot.displayMode).toBe('agent_execution');
    expect(snapshot.summary.title).toBe('已处理 1 个动作');
    expect(snapshot.agentOsGroups?.map(group => group.kind)).toEqual(['execution', 'delivery']);
  });

  it('keeps final-response-only snapshots as answer only', () => {
    const snapshot = buildAgentOsSnapshot([buildAgentOsStep('final_response_completed', 0, {})]);

    expect(snapshot.displayMode).toBe('answer_only');
    expect(snapshot.agentOsGroups).toEqual([]);
    expect(snapshot.summary.title).not.toContain('1 个步骤');
  });
});

function buildAgentOsStep(type: ChatEventRecord['type'], sequence: number, payload: ChatEventRecord['payload']) {
  return buildChatResponseStepEvent(
    { id: `event-${sequence}`, sessionId: 'session-1', type, at, payload } as ChatEventRecord,
    { messageId: 'assistant-1', sequence }
  )!.step;
}

function buildAgentOsSnapshot(steps: ReturnType<typeof buildAgentOsStep>[]) {
  return buildChatResponseStepSnapshot({
    sessionId: 'session-1',
    messageId: 'assistant-1',
    status: 'completed',
    steps,
    updatedAt: at
  });
}

function createRealChatServiceWithEvents(events: ChatEventRecord[]) {
  return new ChatService(
    {
      listSessionEvents: vi.fn(() => events),
      subscribeSession: vi.fn()
    } as never,
    {} as never,
    {} as never
  );
}
