import { describe, expect, it } from 'vitest';

import {
  buildSessionActivationPlan,
  shouldStartDetailPollingAfterIdleClose,
  shouldShowStreamFallbackError,
  shouldStartDetailPollingAfterStreamError
} from '@/hooks/chat-session/chat-session-effects';

describe('chat-session-effects', () => {
  it('uses detail loading flow when activating a history session', () => {
    expect(
      buildSessionActivationPlan({
        activeSessionId: 'session-1'
      })
    ).toEqual({
      shouldSelectSession: true,
      shouldRefreshDetail: true,
      shouldOpenStreamImmediately: false
    });
  });

  it('reconnects stream directly for next-turn sends in the same session', () => {
    expect(
      buildSessionActivationPlan({
        activeSessionId: 'session-1',
        streamReconnectSessionId: 'session-1'
      })
    ).toEqual({
      shouldSelectSession: false,
      shouldRefreshDetail: false,
      shouldOpenStreamImmediately: true
    });
  });

  it('opens stream immediately for a brand-new session with a pending initial message', () => {
    expect(
      buildSessionActivationPlan({
        activeSessionId: 'session-1',
        pendingInitialSessionId: 'session-1'
      })
    ).toEqual({
      shouldSelectSession: false,
      shouldRefreshDetail: false,
      shouldOpenStreamImmediately: true
    });
  });

  it('keeps immediate stream opening when both pending-initial and reconnect markers exist', () => {
    expect(
      buildSessionActivationPlan({
        activeSessionId: 'session-1',
        pendingInitialSessionId: 'session-1',
        streamReconnectSessionId: 'session-1'
      })
    ).toEqual({
      shouldSelectSession: false,
      shouldRefreshDetail: false,
      shouldOpenStreamImmediately: true
    });
  });

  it('does not start fallback polling after an intentional stream dispose', () => {
    expect(
      shouldStartDetailPollingAfterStreamError({
        isDisposed: true,
        detailStatus: 'running'
      })
    ).toBe(false);
  });

  it('starts fallback polling only when the session is still running', () => {
    expect(
      shouldStartDetailPollingAfterStreamError({
        isDisposed: false,
        detailStatus: 'running'
      })
    ).toBe(true);
    expect(
      shouldStartDetailPollingAfterStreamError({
        isDisposed: false,
        detailStatus: 'completed'
      })
    ).toBe(false);
  });

  it('shows the fallback error only when no assistant content has been streamed yet', () => {
    expect(
      shouldShowStreamFallbackError({
        isDisposed: false,
        detailStatus: 'running',
        hasAssistantContent: false
      })
    ).toBe(true);
    expect(
      shouldShowStreamFallbackError({
        isDisposed: false,
        detailStatus: 'running',
        hasAssistantContent: true
      })
    ).toBe(false);
    expect(
      shouldShowStreamFallbackError({
        isDisposed: false,
        detailStatus: 'completed',
        hasAssistantContent: false
      })
    ).toBe(false);
  });

  it('starts detail polling after idle close only when the session is still running', () => {
    expect(shouldStartDetailPollingAfterIdleClose('running')).toBe(true);
    expect(shouldStartDetailPollingAfterIdleClose('completed')).toBe(false);
    expect(shouldStartDetailPollingAfterIdleClose(undefined)).toBe(false);
  });
});
