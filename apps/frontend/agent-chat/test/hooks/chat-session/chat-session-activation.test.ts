import { describe, expect, it, vi } from 'vitest';

import { activateChatSession } from '@/hooks/chat-session/chat-session-activation';
import type { ChatMessageRecord } from '@/types/chat';

describe('chat-session-activation', () => {
  it('opens the stream immediately for reconnect paths', async () => {
    const stream = { close: vi.fn() } as unknown as EventSource;
    const startSessionPolling = vi.fn();
    const stopSessionPolling = vi.fn();
    const clearStreamReconnectSession = vi.fn();
    const bindStream = vi.fn();

    const result = await activateChatSession({
      activeSessionId: 'session-1',
      isDisposed: () => false,
      plan: {
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: true
      },
      selectSession: vi.fn(),
      hydrateSessionSnapshot: vi.fn(),
      createSessionStream: vi.fn(() => stream),
      bindStream,
      startSessionPolling,
      stopSessionPolling,
      clearStreamReconnectSession,
      insertPendingUserMessage: vi.fn(),
      appendMessage: vi.fn(),
      clearPendingInitialMessage: vi.fn(),
      clearPendingUser: vi.fn(),
      mergeOrAppendMessage: vi.fn(),
      setMessages: vi.fn(),
      markSessionStatus: vi.fn()
    });

    expect(clearStreamReconnectSession).toHaveBeenCalled();
    expect(startSessionPolling).toHaveBeenCalledWith('session-1', 'checkpoint');
    expect(bindStream).toHaveBeenCalledWith(stream, 'session-1');
    expect(stopSessionPolling).not.toHaveBeenCalled();
    expect(result?.stream).toBe(stream);
  });

  it('hydrates history sessions and avoids opening a stream when detail is terminal', async () => {
    const stopSessionPolling = vi.fn();
    const selectSession = vi.fn();
    const hydrateSessionSnapshot = vi.fn().mockResolvedValue({ status: 'completed' });

    const result = await activateChatSession({
      activeSessionId: 'session-1',
      isDisposed: () => false,
      plan: {
        shouldSelectSession: true,
        shouldRefreshDetail: true,
        shouldOpenStreamImmediately: false
      },
      selectSession,
      hydrateSessionSnapshot,
      createSessionStream: vi.fn(),
      bindStream: vi.fn(),
      startSessionPolling: vi.fn(),
      stopSessionPolling,
      clearStreamReconnectSession: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      appendMessage: vi.fn(),
      clearPendingInitialMessage: vi.fn(),
      clearPendingUser: vi.fn(),
      mergeOrAppendMessage: vi.fn(),
      setMessages: vi.fn(),
      markSessionStatus: vi.fn()
    });

    expect(selectSession).toHaveBeenCalledWith('session-1');
    expect(hydrateSessionSnapshot).toHaveBeenCalledWith('session-1', true);
    expect(stopSessionPolling).toHaveBeenCalledWith('session-1');
    expect(result).toBeUndefined();
  });

  it('appends the pending initial message and marks the session running', async () => {
    const stream = { close: vi.fn() } as unknown as EventSource;
    let messages: ChatMessageRecord[] = [];
    const nextUserMessage: ChatMessageRecord = {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'user',
      content: 'hello',
      createdAt: '2026-04-02T00:00:00.000Z'
    };
    const clearPendingInitialMessage = vi.fn();
    const insertPendingUserMessage = vi.fn();
    const clearPendingUser = vi.fn();
    const setMessages = vi.fn((next: (current: ChatMessageRecord[]) => ChatMessageRecord[]) => {
      messages = next(messages);
    });
    const mergeOrAppendMessage = vi.fn((current: ChatMessageRecord[], message: ChatMessageRecord) => [
      ...current,
      message
    ]);
    const markSessionStatus = vi.fn();

    const result = await activateChatSession({
      activeSessionId: 'session-1',
      pendingInitialSessionId: 'session-1',
      pendingInitialMessageContent: 'hello',
      isDisposed: () => false,
      plan: {
        shouldSelectSession: true,
        shouldRefreshDetail: true,
        shouldOpenStreamImmediately: false
      },
      selectSession: vi.fn(),
      hydrateSessionSnapshot: vi.fn().mockResolvedValue({ status: 'running' }),
      createSessionStream: vi.fn(() => stream),
      bindStream: vi.fn(),
      startSessionPolling: vi.fn(),
      stopSessionPolling: vi.fn(),
      clearStreamReconnectSession: vi.fn(),
      insertPendingUserMessage,
      appendMessage: vi.fn().mockResolvedValue(nextUserMessage),
      clearPendingInitialMessage,
      clearPendingUser,
      mergeOrAppendMessage,
      setMessages,
      markSessionStatus
    });

    expect(clearPendingInitialMessage).toHaveBeenCalled();
    expect(insertPendingUserMessage).toHaveBeenCalledWith('session-1', 'hello');
    expect(clearPendingUser).toHaveBeenCalledWith('session-1');
    expect(markSessionStatus).toHaveBeenCalledWith('session-1', 'running');
    expect(messages).toEqual([nextUserMessage]);
    expect(result?.stream).toBe(stream);
  });

  it('stops work when disposal happens after select or after append resolution', async () => {
    const disposedAfterSelect = true;
    const selectSession = vi.fn();
    const hydrateSessionSnapshot = vi.fn();
    const firstResult = await activateChatSession({
      activeSessionId: 'session-1',
      isDisposed: () => disposedAfterSelect,
      plan: {
        shouldSelectSession: true,
        shouldRefreshDetail: true,
        shouldOpenStreamImmediately: false
      },
      selectSession,
      hydrateSessionSnapshot,
      createSessionStream: vi.fn(),
      bindStream: vi.fn(),
      startSessionPolling: vi.fn(),
      stopSessionPolling: vi.fn(),
      clearStreamReconnectSession: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      appendMessage: vi.fn(),
      clearPendingInitialMessage: vi.fn(),
      clearPendingUser: vi.fn(),
      mergeOrAppendMessage: vi.fn(),
      setMessages: vi.fn(),
      markSessionStatus: vi.fn()
    });

    expect(selectSession).toHaveBeenCalledWith('session-1');
    expect(hydrateSessionSnapshot).not.toHaveBeenCalled();
    expect(firstResult).toBeUndefined();

    let disposedAfterAppend = false;
    const clearPendingUser = vi.fn();
    const setMessages = vi.fn();
    const markSessionStatus = vi.fn();
    const secondResult = await activateChatSession({
      activeSessionId: 'session-1',
      pendingInitialSessionId: 'session-1',
      pendingInitialMessageContent: 'hello',
      isDisposed: () => disposedAfterAppend,
      plan: {
        shouldSelectSession: false,
        shouldRefreshDetail: false,
        shouldOpenStreamImmediately: false
      },
      selectSession: vi.fn(),
      hydrateSessionSnapshot: vi.fn(),
      createSessionStream: vi.fn(() => ({ close: vi.fn() }) as unknown as EventSource),
      bindStream: vi.fn(),
      startSessionPolling: vi.fn(),
      stopSessionPolling: vi.fn(),
      clearStreamReconnectSession: vi.fn(),
      insertPendingUserMessage: vi.fn(),
      appendMessage: vi.fn().mockImplementation(async () => {
        disposedAfterAppend = true;
        return {
          id: 'msg-2',
          sessionId: 'session-1',
          role: 'user',
          content: 'hello',
          createdAt: '2026-04-02T00:00:00.000Z'
        } satisfies ChatMessageRecord;
      }),
      clearPendingInitialMessage: vi.fn(),
      clearPendingUser,
      mergeOrAppendMessage: vi.fn(),
      setMessages,
      markSessionStatus
    });

    expect(clearPendingUser).not.toHaveBeenCalled();
    expect(setMessages).not.toHaveBeenCalled();
    expect(markSessionStatus).not.toHaveBeenCalled();
    expect(secondResult?.stream).toBeTruthy();
  });
});
