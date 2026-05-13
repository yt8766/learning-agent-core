import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  isAgentChatDebugEnabled,
  debugAgentChat,
  summarizeDebugMessage,
  summarizeDebugMessages,
  summarizeDebugEvent,
  summarizeDebugSessions
} from '@/utils/agent-chat-debug';

describe('agent-chat-debug', () => {
  const originalWindow = globalThis as typeof globalThis & { __AGENT_CHAT_DEBUG__?: boolean };

  beforeEach(() => {
    delete originalWindow.__AGENT_CHAT_DEBUG__;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    delete originalWindow.__AGENT_CHAT_DEBUG__;
  });

  describe('isAgentChatDebugEnabled', () => {
    it('returns false when no debug flag is set', () => {
      expect(isAgentChatDebugEnabled()).toBe(false);
    });

    it('returns true when window debug flag is true', () => {
      originalWindow.__AGENT_CHAT_DEBUG__ = true;
      expect(isAgentChatDebugEnabled()).toBe(true);
    });

    it('returns true when localStorage flag is "1"', () => {
      const mockLocalStorage = {
        getItem: (key: string) => (key === 'agent-chat-debug' ? '1' : null)
      } as unknown as Storage;
      Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, configurable: true });
      expect(isAgentChatDebugEnabled()).toBe(true);
      delete (globalThis as any).localStorage;
    });

    it('returns true when localStorage flag is "true"', () => {
      const mockLocalStorage = {
        getItem: (key: string) => (key === 'agent-chat-debug' ? 'true' : null)
      } as unknown as Storage;
      Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, configurable: true });
      expect(isAgentChatDebugEnabled()).toBe(true);
      delete (globalThis as any).localStorage;
    });

    it('returns false when localStorage flag is "0"', () => {
      const mockLocalStorage = {
        getItem: (key: string) => (key === 'agent-chat-debug' ? '0' : null)
      } as unknown as Storage;
      Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, configurable: true });
      expect(isAgentChatDebugEnabled()).toBe(false);
      delete (globalThis as any).localStorage;
    });

    it('returns false when localStorage is unavailable', () => {
      const originalLocalStorage = globalThis.localStorage;
      delete (globalThis as any).localStorage;
      expect(isAgentChatDebugEnabled()).toBe(false);
      (globalThis as any).localStorage = originalLocalStorage;
    });
  });

  describe('debugAgentChat', () => {
    it('does nothing when debug is disabled', () => {
      const spy = vi.spyOn(console, 'log');
      debugAgentChat('test-label', { key: 'value' });
      expect(spy).not.toHaveBeenCalled();
    });

    it('logs with payload when debug is enabled', () => {
      originalWindow.__AGENT_CHAT_DEBUG__ = true;
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      debugAgentChat('test-label', { key: 'value' });
      expect(spy).toHaveBeenCalledWith('[agent-chat-debug] test-label', { key: 'value' });
    });

    it('logs without payload when debug is enabled and payload is undefined', () => {
      originalWindow.__AGENT_CHAT_DEBUG__ = true;
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      debugAgentChat('test-label');
      expect(spy).toHaveBeenCalledWith('[agent-chat-debug] test-label');
    });

    it('handles null payload', () => {
      originalWindow.__AGENT_CHAT_DEBUG__ = true;
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      debugAgentChat('test-label', null);
      expect(spy).toHaveBeenCalledWith('[agent-chat-debug] test-label', null);
    });

    it('handles array payload', () => {
      originalWindow.__AGENT_CHAT_DEBUG__ = true;
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      debugAgentChat('test-label', [1, 2, 3]);
      expect(spy).toHaveBeenCalledWith('[agent-chat-debug] test-label', [1, 2, 3]);
    });
  });

  describe('summarizeDebugMessage', () => {
    it('summarizes a complete message', () => {
      const result = summarizeDebugMessage({
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'Hello world',
        createdAt: '2026-03-28T00:00:00.000Z',
        taskId: 'task-1',
        card: { type: 'approval_request', intent: 'write_file' }
      });

      expect(result).toEqual({
        id: 'msg-1',
        role: 'assistant',
        taskId: 'task-1',
        cardType: 'approval_request',
        contentPreview: 'Hello world',
        createdAt: '2026-03-28T00:00:00.000Z'
      });
    });

    it('truncates content preview to 120 chars', () => {
      const longContent = 'a'.repeat(200);
      const result = summarizeDebugMessage({
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: longContent,
        createdAt: '2026-03-28T00:00:00.000Z'
      });

      expect(result.contentPreview).toHaveLength(120);
    });

    it('handles non-string content', () => {
      const result = summarizeDebugMessage({
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'user',
        content: undefined as any,
        createdAt: '2026-03-28T00:00:00.000Z'
      });

      expect(result.contentPreview).toBe('');
    });

    it('handles message without card or taskId', () => {
      const result = summarizeDebugMessage({
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'system',
        content: 'test',
        createdAt: '2026-03-28T00:00:00.000Z'
      });

      expect(result.cardType).toBeUndefined();
      expect(result.taskId).toBeUndefined();
    });
  });

  describe('summarizeDebugMessages', () => {
    it('maps messages to summaries', () => {
      const messages = [
        { id: 'msg-1', sessionId: 's1', role: 'user' as const, content: 'hi', createdAt: '2026-03-28T00:00:00.000Z' },
        {
          id: 'msg-2',
          sessionId: 's1',
          role: 'assistant' as const,
          content: 'hello',
          createdAt: '2026-03-28T00:00:01.000Z'
        }
      ];

      const result = summarizeDebugMessages(messages);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });
  });

  describe('summarizeDebugEvent', () => {
    it('summarizes an event with payload fields', () => {
      const result = summarizeDebugEvent({
        id: 'evt-1',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-03-28T00:00:00.000Z',
        payload: {
          messageId: 'msg-1',
          taskId: 'task-1',
          content: 'Some content here'
        }
      } as any);

      expect(result).toEqual({
        id: 'evt-1',
        type: 'assistant_token',
        sessionId: 'session-1',
        at: '2026-03-28T00:00:00.000Z',
        messageId: 'msg-1',
        taskId: 'task-1',
        contentPreview: 'Some content here'
      });
    });

    it('handles event without payload fields', () => {
      const result = summarizeDebugEvent({
        id: 'evt-2',
        sessionId: 'session-1',
        type: 'session_finished',
        at: '2026-03-28T00:00:00.000Z',
        payload: {}
      } as any);

      expect(result.messageId).toBeUndefined();
      expect(result.taskId).toBeUndefined();
      expect(result.contentPreview).toBeUndefined();
    });

    it('truncates content preview to 120 chars', () => {
      const result = summarizeDebugEvent({
        id: 'evt-3',
        sessionId: 'session-1',
        type: 'assistant_token',
        at: '2026-03-28T00:00:00.000Z',
        payload: { content: 'x'.repeat(200) }
      } as any);

      expect(result.contentPreview).toHaveLength(120);
    });
  });

  describe('summarizeDebugSessions', () => {
    it('summarizes session records', () => {
      const sessions = [
        {
          id: 's1',
          title: 'Session 1',
          status: 'running' as const,
          currentTaskId: 'task-1',
          createdAt: '2026-03-28T00:00:00.000Z',
          updatedAt: '2026-03-28T00:01:00.000Z'
        }
      ];

      const result = summarizeDebugSessions(sessions);
      expect(result).toEqual([
        {
          id: 's1',
          title: 'Session 1',
          status: 'running',
          currentTaskId: 'task-1',
          updatedAt: '2026-03-28T00:01:00.000Z'
        }
      ]);
    });
  });
});
