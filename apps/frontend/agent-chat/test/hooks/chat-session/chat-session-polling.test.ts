import { describe, expect, it, vi } from 'vitest';

import { createSessionPollingRunner, shouldSkipStopSessionPolling } from '@/hooks/chat-session/chat-session-polling';
import type { ChatCheckpointRecord } from '@/types/chat';

describe('chat-session-polling', () => {
  it('skips stop requests that target a different polling session', () => {
    expect(shouldSkipStopSessionPolling('session-1', 'session-2')).toBe(true);
    expect(shouldSkipStopSessionPolling('session-1', 'session-1')).toBe(false);
    expect(shouldSkipStopSessionPolling(undefined, 'session-1')).toBe(false);
  });

  it('hydrates detail polling and stops once the session is no longer running', async () => {
    const hydrateSessionSnapshot = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ status: 'completed' });
    const stopSessionPolling = vi.fn();
    const runner = createSessionPollingRunner({
      mode: 'detail',
      sessionId: 'session-1',
      checkpointRefreshInFlight: false,
      hydrateSessionSnapshot,
      refreshCheckpointOnly: vi.fn(),
      deriveSessionStatusFromCheckpoint: vi.fn(),
      stopSessionPolling
    });

    runner();
    await Promise.resolve();
    runner();
    await Promise.resolve();

    expect(hydrateSessionSnapshot).toHaveBeenNthCalledWith(1, 'session-1', false);
    expect(hydrateSessionSnapshot).toHaveBeenNthCalledWith(2, 'session-1', false);
    expect(stopSessionPolling).toHaveBeenCalledWith('session-1');
  });

  it('refreshes checkpoint polling only when no refresh is currently in flight', async () => {
    const refreshCheckpointOnly = vi
      .fn(async (_sessionId: string) => undefined as ChatCheckpointRecord | undefined)
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        graphState: { status: 'running' }
      } as ChatCheckpointRecord)
      .mockResolvedValueOnce({
        sessionId: 'session-1',
        graphState: { status: 'completed' }
      } as ChatCheckpointRecord);
    const deriveSessionStatusFromCheckpoint = vi.fn(
      (checkpoint?: ChatCheckpointRecord) => checkpoint?.graphState?.status as string | undefined
    );
    const stopSessionPolling = vi.fn();

    const activeRunner = createSessionPollingRunner({
      mode: 'checkpoint',
      sessionId: 'session-1',
      checkpointRefreshInFlight: false,
      hydrateSessionSnapshot: vi.fn(),
      refreshCheckpointOnly,
      deriveSessionStatusFromCheckpoint,
      stopSessionPolling
    });
    const blockedRunner = createSessionPollingRunner({
      mode: 'checkpoint',
      sessionId: 'session-1',
      checkpointRefreshInFlight: true,
      hydrateSessionSnapshot: vi.fn(),
      refreshCheckpointOnly,
      deriveSessionStatusFromCheckpoint,
      stopSessionPolling
    });

    activeRunner();
    await Promise.resolve();
    blockedRunner();
    await Promise.resolve();
    activeRunner();
    await Promise.resolve();

    expect(refreshCheckpointOnly).toHaveBeenCalledTimes(2);
    expect(refreshCheckpointOnly).toHaveBeenCalledWith('session-1');
    expect(stopSessionPolling).toHaveBeenCalledTimes(1);
    expect(stopSessionPolling).toHaveBeenCalledWith('session-1');
  });
});
