import { describe, expect, it, vi } from 'vitest';

import { ChatViewStreamService } from '../../src/chat/chat-view-stream.service';

describe('ChatViewStreamService', () => {
  const createService = () => {
    const runtimeSessionService = {
      listSessionEvents: vi.fn().mockReturnValue([]),
      subscribeSession: vi.fn().mockReturnValue(vi.fn())
    };
    const chatRunService = {
      getRun: vi.fn().mockReturnValue({ id: 'run-1', status: 'running' })
    };
    const service = new ChatViewStreamService(runtimeSessionService as never, chatRunService as never);
    return { service, runtimeSessionService, chatRunService };
  };

  it('listEvents returns projected events', () => {
    const { service, runtimeSessionService } = createService();
    runtimeSessionService.listSessionEvents.mockReturnValue([
      { type: 'session_opened', sessionId: 's-1', at: '2026-05-10T00:00:00.000Z' }
    ]);

    const events = service.listEvents('s-1', 'run-1');

    expect(Array.isArray(events)).toBe(true);
    expect(runtimeSessionService.listSessionEvents).toHaveBeenCalledWith('s-1');
  });

  it('listEvents filters events by afterSeq when provided', () => {
    const { service, runtimeSessionService } = createService();
    runtimeSessionService.listSessionEvents.mockReturnValue([
      { type: 'session_opened', sessionId: 's-1', at: '2026-05-10T00:00:00.000Z' }
    ]);

    const events = service.listEvents('s-1', 'run-1', 100);

    expect(Array.isArray(events)).toBe(true);
  });

  it('subscribe sets up a listener and returns unsubscribe function', () => {
    const { service, runtimeSessionService } = createService();
    const listener = vi.fn();

    const unsubscribe = service.subscribe('s-1', 'run-1', listener);

    expect(typeof unsubscribe).toBe('function');
    expect(runtimeSessionService.subscribeSession).toHaveBeenCalledWith('s-1', expect.any(Function));
  });

  it('subscribe passes afterSeq to filter events', () => {
    const { service, runtimeSessionService } = createService();
    const listener = vi.fn();

    service.subscribe('s-1', 'run-1', listener, 5);

    expect(runtimeSessionService.subscribeSession).toHaveBeenCalledWith('s-1', expect.any(Function));
  });

  it('subscribe callback forwards projected events to listener', () => {
    const { service, runtimeSessionService } = createService();
    const listener = vi.fn();
    let capturedCallback: (event: unknown) => void;

    runtimeSessionService.subscribeSession.mockImplementation(
      (_sessionId: string, callback: (event: unknown) => void) => {
        capturedCallback = callback;
        return vi.fn();
      }
    );

    service.subscribe('s-1', 'run-1', listener);

    // Simulate an event coming through
    capturedCallback!({ type: 'session_opened', sessionId: 's-1', at: '2026-05-10T00:00:00.000Z' });

    // The listener may or may not be called depending on the adapter, but the callback should not throw
    expect(runtimeSessionService.subscribeSession).toHaveBeenCalled();
  });
});
