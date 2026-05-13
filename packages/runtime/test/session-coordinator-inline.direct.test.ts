import { describe, expect, it, vi } from 'vitest';

import {
  dedupeById,
  finalizeInlineCapabilityCheckpoint,
  completeInlineCapabilitySession
} from '../src/session/coordinator/session-coordinator-inline';

describe('session-coordinator-inline (direct)', () => {
  describe('dedupeById', () => {
    it('removes duplicates by id', () => {
      const items = [
        { id: 'a', value: 1 },
        { id: 'b', value: 2 },
        { id: 'a', value: 3 }
      ];
      const result = dedupeById(items);
      expect(result).toHaveLength(2);
      expect(result[0].value).toBe(3); // last one wins
      expect(result[1].value).toBe(2);
    });

    it('returns empty array for empty input', () => {
      expect(dedupeById([])).toEqual([]);
    });

    it('preserves unique items', () => {
      const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
      expect(dedupeById(items)).toHaveLength(3);
    });
  });

  describe('finalizeInlineCapabilityCheckpoint', () => {
    it('finalizes checkpoint', () => {
      const checkpoint = {
        graphState: { status: 'running', currentStep: 'execute' },
        thinkState: { title: 'Thinking', content: '...', loading: true, blink: true },
        pendingApproval: { intent: 'write_file' },
        pendingApprovals: [{ id: 'p1' }],
        activeInterrupt: { id: 'int-1' },
        pendingAction: { action: 'some-action' },
        streamStatus: 'streaming'
      } as any;
      finalizeInlineCapabilityCheckpoint(checkpoint, '2026-01-01T00:00:00Z');
      expect(checkpoint.updatedAt).toBe('2026-01-01T00:00:00Z');
      expect(checkpoint.graphState.status).toBe('completed');
      expect(checkpoint.thinkState.loading).toBe(false);
      expect(checkpoint.thinkState.blink).toBe(false);
      expect(checkpoint.pendingApproval).toBeUndefined();
      expect(checkpoint.pendingApprovals).toEqual([]);
      expect(checkpoint.activeInterrupt).toBeUndefined();
      expect(checkpoint.pendingAction).toBeUndefined();
      expect(checkpoint.streamStatus).toBeUndefined();
    });

    it('handles checkpoint without thinkState', () => {
      const checkpoint = {
        graphState: { status: 'running' },
        thinkState: undefined,
        pendingApprovals: []
      } as any;
      finalizeInlineCapabilityCheckpoint(checkpoint, '2026-01-01T00:00:00Z');
      expect(checkpoint.thinkState).toBeUndefined();
    });

    it('handles checkpoint without graphState', () => {
      const checkpoint = {
        graphState: undefined,
        thinkState: undefined,
        pendingApprovals: []
      } as any;
      finalizeInlineCapabilityCheckpoint(checkpoint, '2026-01-01T00:00:00Z');
      expect(checkpoint.graphState.status).toBe('completed');
    });
  });

  describe('completeInlineCapabilitySession', () => {
    it('completes session with user message and response', () => {
      const store = {
        addMessage: vi
          .fn()
          .mockReturnValueOnce({ id: 'msg-user', content: 'Hello', role: 'user' })
          .mockReturnValueOnce({ id: 'msg-assistant', content: 'Hi', role: 'assistant' }),
        getCheckpoint: vi.fn().mockReturnValue({
          graphState: { status: 'running' },
          thinkState: undefined,
          pendingApprovals: [],
          taskId: 'task-1'
        }),
        createCheckpoint: vi.fn(),
        addEvent: vi.fn()
      };
      const session = {
        id: 'session-1',
        status: 'running',
        updatedAt: '',
        title: 'Test',
        currentTaskId: 'task-1'
      } as any;
      const result = completeInlineCapabilitySession({
        store: store as any,
        session,
        sessionId: 'session-1',
        userMessageContent: 'Hello',
        response: { content: 'Hi there' }
      });
      expect(result.userMessage.id).toBe('msg-user');
      expect(result.responseMessage.id).toBe('msg-assistant');
      expect(session.status).toBe('completed');
      expect(store.addEvent).toHaveBeenCalledTimes(3);
    });

    it('creates checkpoint when none exists', () => {
      const store = {
        addMessage: vi
          .fn()
          .mockReturnValueOnce({ id: 'msg-user', content: 'Hello', role: 'user' })
          .mockReturnValueOnce({ id: 'msg-assistant', content: 'Hi', role: 'assistant' }),
        getCheckpoint: vi.fn().mockReturnValue(null),
        createCheckpoint: vi.fn().mockReturnValue({
          graphState: { status: 'running' },
          thinkState: undefined,
          pendingApprovals: [],
          taskId: 'inline-task'
        }),
        addEvent: vi.fn()
      };
      const session = {
        id: 'session-1',
        status: 'running',
        updatedAt: '',
        title: 'Test',
        currentTaskId: undefined
      } as any;
      const result = completeInlineCapabilitySession({
        store: store as any,
        session,
        sessionId: 'session-1',
        userMessageContent: 'Hello',
        response: { content: 'Hi' }
      });
      expect(store.createCheckpoint).toHaveBeenCalledWith('session-1', 'inline-capability:session-1');
    });

    it('uses custom role for response', () => {
      const store = {
        addMessage: vi
          .fn()
          .mockReturnValueOnce({ id: 'msg-user', content: 'Hello', role: 'user' })
          .mockReturnValueOnce({ id: 'msg-system', content: 'System msg', role: 'system' }),
        getCheckpoint: vi.fn().mockReturnValue({
          graphState: { status: 'running' },
          thinkState: undefined,
          pendingApprovals: [],
          taskId: 'task-1'
        }),
        addEvent: vi.fn()
      };
      const session = {
        id: 'session-1',
        status: 'running',
        updatedAt: '',
        title: 'Test',
        currentTaskId: 'task-1'
      } as any;
      completeInlineCapabilitySession({
        store: store as any,
        session,
        sessionId: 'session-1',
        userMessageContent: 'Hello',
        response: { content: 'System msg', role: 'system' }
      });
      expect(store.addMessage).toHaveBeenNthCalledWith(2, 'session-1', 'system', 'System msg', undefined, undefined);
    });
  });
});
