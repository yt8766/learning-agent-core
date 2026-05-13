import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ChatViewStreamEventRepository } from '../../src/chat/chat-view-stream-event.repository';
import { ChatViewStreamService } from '../../src/chat/chat-view-stream.service';

const timestamp = '2026-05-13T00:00:00.000Z';

describe('ChatViewStreamService', () => {
  const createService = () => {
    const runtimeSessionService = {
      listSessionEvents: vi.fn().mockReturnValue([]),
      subscribeSession: vi.fn().mockReturnValue(vi.fn())
    };
    const chatRunService = {
      getRun: vi.fn().mockReturnValue({
        id: 'run-1',
        sessionId: 's-1',
        requestMessageId: 'user-1',
        responseMessageId: 'assistant-1',
        route: 'supervisor',
        status: 'running',
        createdAt: timestamp
      })
    };
    const repository = new ChatViewStreamEventRepository();
    const service = new ChatViewStreamService(runtimeSessionService as never, chatRunService as never, repository);
    return { service, runtimeSessionService, chatRunService, repository };
  };

  it('listEvents lazily backfills projected runtime events into the repository', () => {
    const { service, runtimeSessionService, repository } = createService();
    runtimeSessionService.listSessionEvents.mockReturnValue([
      {
        id: 'source-1',
        type: 'assistant_token',
        sessionId: 's-1',
        at: timestamp,
        payload: {
          messageId: 'assistant-1',
          token: '你好'
        }
      }
    ]);

    const events = service.listEvents('s-1', 'run-1');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      seq: 0,
      event: 'fragment_delta',
      data: {
        delta: '你好'
      }
    });
    expect(repository.list('s-1', 'run-1')).toEqual(events);
  });

  it('listEvents replays repository events by afterSeq without duplicating backfilled events', () => {
    const { service, runtimeSessionService } = createService();
    runtimeSessionService.listSessionEvents.mockReturnValue([
      {
        id: 'source-1',
        type: 'assistant_token',
        sessionId: 's-1',
        at: timestamp,
        payload: {
          messageId: 'assistant-1',
          token: '你好'
        }
      },
      {
        id: 'source-2',
        type: 'assistant_token',
        sessionId: 's-1',
        at: timestamp,
        payload: {
          messageId: 'assistant-1',
          token: '世界'
        }
      }
    ]);

    service.listEvents('s-1', 'run-1');
    const replay = service.listEvents('s-1', 'run-1', 0);

    expect(replay.map(event => event.seq)).toEqual([1]);
    expect(replay[0]?.data).toMatchObject({ delta: '世界' });
  });

  it('subscribe appends realtime projections before forwarding canonical events', () => {
    const { service, runtimeSessionService, repository } = createService();
    const listener = vi.fn();
    let capturedCallback: (event: unknown) => void = () => undefined;

    runtimeSessionService.subscribeSession.mockImplementation(
      (_sessionId: string, callback: (event: unknown) => void) => {
        capturedCallback = callback;
        return vi.fn();
      }
    );

    service.subscribe('s-1', 'run-1', listener);
    capturedCallback({
      id: 'source-1',
      type: 'assistant_token',
      sessionId: 's-1',
      at: timestamp,
      payload: {
        messageId: 'assistant-1',
        token: 'hi'
      }
    });

    expect(repository.list('s-1', 'run-1')).toHaveLength(1);
    expect(listener).toHaveBeenCalledWith(repository.list('s-1', 'run-1')[0]);
  });

  it('subscribe filters canonical realtime events by afterSeq', () => {
    const { service, runtimeSessionService } = createService();
    const listener = vi.fn();
    let capturedCallback: (event: unknown) => void = () => undefined;

    runtimeSessionService.listSessionEvents.mockReturnValue([
      {
        id: 'source-1',
        type: 'assistant_token',
        sessionId: 's-1',
        at: timestamp,
        payload: {
          messageId: 'assistant-1',
          token: 'old'
        }
      }
    ]);
    runtimeSessionService.subscribeSession.mockImplementation(
      (_sessionId: string, callback: (event: unknown) => void) => {
        capturedCallback = callback;
        return vi.fn();
      }
    );

    service.subscribe('s-1', 'run-1', listener, 0);
    capturedCallback({
      id: 'source-2',
      type: 'assistant_token',
      sessionId: 's-1',
      at: timestamp,
      payload: {
        messageId: 'assistant-1',
        token: 'new'
      }
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ seq: 1 });
  });

  it('rejects view stream requests when the run belongs to another session', () => {
    const { service, chatRunService } = createService();
    chatRunService.getRun.mockReturnValue({
      id: 'run-1',
      sessionId: 'other-session',
      requestMessageId: 'user-1',
      route: 'supervisor',
      status: 'running',
      createdAt: timestamp
    });

    expect(() => service.listEvents('s-1', 'run-1')).toThrow(BadRequestException);
  });
});
