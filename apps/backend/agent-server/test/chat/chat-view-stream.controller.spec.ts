import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';

import { ChatViewStreamController } from '../../src/chat/chat-view-stream.controller';

describe('ChatViewStreamController', () => {
  it('streams projected view events with explicit SSE event names', () => {
    const unsubscribe = vi.fn();
    const service = {
      listEvents: vi.fn(() => [
        {
          event: 'ready',
          id: 'view-1',
          seq: 0,
          sessionId: 'session-1',
          runId: 'run-1',
          at: '2026-05-05T10:00:00.000Z',
          data: {
            requestMessageId: 'user-1',
            responseMessageId: 'assistant-1'
          }
        }
      ]),
      subscribe: vi.fn((_sessionId, _runId, listener) => {
        listener({
          event: 'fragment_delta',
          id: 'view-2',
          seq: 1,
          sessionId: 'session-1',
          runId: 'run-1',
          at: '2026-05-05T10:00:01.000Z',
          data: {
            messageId: 'assistant-1',
            fragmentId: 'fragment-run-1-response',
            delta: '你好'
          }
        });
        return unsubscribe;
      })
    };
    const controller = new ChatViewStreamController(service as never);
    const response = createSseResponse();
    const request = { on: vi.fn() };

    controller.stream(request as never, response as never, 'session-1', 'run-1');

    expect(response.write).toHaveBeenCalledWith(': view-stream-open\n\n');
    expect(response.write).toHaveBeenCalledWith(`event: ready\ndata: ${JSON.stringify(service.listEvents()[0])}\n\n`);
    expect(response.write).toHaveBeenCalledWith(
      `event: fragment_delta\ndata: ${JSON.stringify({
        event: 'fragment_delta',
        id: 'view-2',
        seq: 1,
        sessionId: 'session-1',
        runId: 'run-1',
        at: '2026-05-05T10:00:01.000Z',
        data: {
          messageId: 'assistant-1',
          fragmentId: 'fragment-run-1-response',
          delta: '你好'
        }
      })}\n\n`
    );
    expect(service.subscribe).toHaveBeenCalledWith('session-1', 'run-1', expect.any(Function), 0);

    const closeHandler = request.on.mock.calls.find(call => call[0] === 'close')?.[1];
    closeHandler?.();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(response.end).toHaveBeenCalledTimes(1);
  });

  it('rejects missing stream identifiers before opening the SSE response', () => {
    const service = {
      listEvents: vi.fn(),
      subscribe: vi.fn()
    };
    const controller = new ChatViewStreamController(service as never);
    const response = createSseResponse();
    const request = { on: vi.fn() };

    expect(() => controller.stream(request as never, response as never, 'session-1', undefined)).toThrow(
      BadRequestException
    );

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(response.write).not.toHaveBeenCalled();
    expect(service.listEvents).not.toHaveBeenCalled();
    expect(service.subscribe).not.toHaveBeenCalled();
  });

  it('passes parsed afterSeq to list and subscribe when no newer history exists', () => {
    const service = {
      listEvents: vi.fn(() => []),
      subscribe: vi.fn(() => vi.fn())
    };
    const controller = new ChatViewStreamController(service as never);
    const response = createSseResponse();
    const request = { on: vi.fn() };

    controller.stream(request as never, response as never, 'session-1', 'run-1', '7');

    expect(service.listEvents).toHaveBeenCalledWith('session-1', 'run-1', 7);
    expect(service.subscribe).toHaveBeenCalledWith('session-1', 'run-1', expect.any(Function), 7);
  });

  it('rejects invalid afterSeq before opening the SSE response', () => {
    const service = {
      listEvents: vi.fn(),
      subscribe: vi.fn()
    };
    const controller = new ChatViewStreamController(service as never);
    const response = createSseResponse();
    const request = { on: vi.fn() };

    expect(() => controller.stream(request as never, response as never, 'session-1', 'run-1', '1.5')).toThrow(
      BadRequestException
    );

    expect(response.setHeader).not.toHaveBeenCalled();
    expect(service.listEvents).not.toHaveBeenCalled();
  });
});

function createSseResponse() {
  return {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    flush: vi.fn(),
    write: vi.fn(),
    end: vi.fn()
  };
}
