import { describe, expect, it } from 'vitest';

import { ChatViewStreamEventRepository } from '../../src/chat/chat-view-stream-event.repository';

const timestamp = '2026-05-13T00:00:00.000Z';

function makeEvent(seq: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `view-${seq}`,
    seq,
    event: 'fragment_delta',
    sessionId: 'session-1',
    runId: 'run-1',
    at: timestamp,
    data: {
      messageId: 'assistant-1',
      fragmentId: 'fragment-run-1-response',
      delta: `token-${seq}`
    },
    ...overrides
  } as any;
}

describe('ChatViewStreamEventRepository', () => {
  it('appends and lists events by session, run, and afterSeq', () => {
    const repository = new ChatViewStreamEventRepository();

    repository.append(makeEvent(0));
    repository.append(makeEvent(1));
    repository.append(makeEvent(0, { id: 'other', sessionId: 'session-2', runId: 'run-2' }));

    expect(repository.list('session-1', 'run-1').map(event => event.seq)).toEqual([0, 1]);
    expect(repository.list('session-1', 'run-1', 0).map(event => event.seq)).toEqual([1]);
    expect(repository.list('session-2', 'run-2').map(event => event.id)).toEqual(['other']);
  });

  it('returns the canonical stored event for duplicate ids', () => {
    const repository = new ChatViewStreamEventRepository();
    const original = repository.append(makeEvent(0, { id: 'view-source-1' }));
    const duplicate = repository.append(makeEvent(2, { id: 'view-source-1' }));

    expect(duplicate).toEqual(original);
    expect(repository.list('session-1', 'run-1').map(event => event.seq)).toEqual([0]);
    expect(repository.getLastSeq('session-1', 'run-1')).toBe(0);
  });

  it('preserves close events and reports the latest sequence', () => {
    const repository = new ChatViewStreamEventRepository();

    repository.append(makeEvent(0));
    repository.markClosed(
      'session-1',
      'run-1',
      makeEvent(1, {
        id: 'view-close',
        event: 'close',
        data: {
          reason: 'completed'
        }
      })
    );

    expect(repository.getLastSeq('session-1', 'run-1')).toBe(1);
    expect(repository.list('session-1', 'run-1', 0)[0]?.event).toBe('close');
  });
});
