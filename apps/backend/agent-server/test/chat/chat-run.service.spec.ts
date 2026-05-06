import { describe, expect, it } from 'vitest';

import { ChatRunRepository } from '../../src/chat/chat-run.repository';
import { ChatRunService } from '../../src/chat/chat-run.service';

describe('ChatRunService', () => {
  it('creates a run linked to request and response messages', () => {
    const service = new ChatRunService(new ChatRunRepository());

    const run = service.createRun({
      sessionId: 'session-1',
      requestMessageId: 'message-user-1',
      responseMessageId: 'message-assistant-1',
      route: 'supervisor',
      modelId: 'default'
    });

    expect(run).toMatchObject({
      sessionId: 'session-1',
      requestMessageId: 'message-user-1',
      responseMessageId: 'message-assistant-1',
      route: 'supervisor',
      status: 'queued',
      modelId: 'default'
    });
    expect(run.id).toMatch(/^chat_run_/);
  });

  it('lists runs for a session ordered by creation time', () => {
    const service = new ChatRunService(new ChatRunRepository());
    const first = service.createRun({
      sessionId: 'session-1',
      requestMessageId: 'message-user-1',
      route: 'direct_reply'
    });
    const second = service.createRun({
      sessionId: 'session-2',
      requestMessageId: 'message-user-2',
      route: 'supervisor'
    });
    const third = service.createRun({
      sessionId: 'session-1',
      requestMessageId: 'message-user-3',
      route: 'workflow'
    });

    expect(service.listRuns('session-1').map(run => run.id)).toEqual([first.id, third.id]);
    expect(service.listRuns('session-2').map(run => run.id)).toEqual([second.id]);
  });

  it('cancels a run and sets completedAt', () => {
    const service = new ChatRunService(new ChatRunRepository());
    const run = service.createRun({
      sessionId: 'session-1',
      requestMessageId: 'message-user-1',
      route: 'supervisor'
    });

    const cancelled = service.cancelRun(run.id);

    expect(cancelled).toMatchObject({
      id: run.id,
      status: 'cancelled'
    });
    expect(cancelled.completedAt).toEqual(expect.any(String));
  });

  it('throws when cancelling a missing run', () => {
    const service = new ChatRunService(new ChatRunRepository());

    expect(() => service.cancelRun('missing-run')).toThrow('Chat run missing-run not found');
  });
});
