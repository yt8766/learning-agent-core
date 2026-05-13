import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/api/chat-api', () => ({
  cancelSession: vi.fn().mockResolvedValue({
    id: 's1',
    status: 'cancelled' as const,
    title: 'Session 1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  }),
  deleteSession: vi.fn().mockResolvedValue({}),
  recoverSession: vi.fn().mockResolvedValue({
    id: 's1',
    status: 'running' as const,
    title: 'Session 1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  })
}));

vi.mock('@/hooks/chat-session/chat-session-control-actions', () => ({
  applyCancelledSessionState: vi.fn(),
  applyRecoveredSessionState: vi.fn(),
  clearPendingSessionMessages: vi.fn(),
  insertOptimisticControlMessage: vi.fn(),
  installSuggestedSkillAction: vi.fn().mockResolvedValue(undefined)
}));

import { createLifecycleActions } from '@/hooks/chat-session/chat-session-lifecycle-actions';

function createMockOptions(overrides: Record<string, any> = {}) {
  return {
    activeSessionId: 's1',
    activeSession: {
      id: 's1',
      status: 'idle' as const,
      title: 'Session 1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z'
    },
    checkpoint: undefined,
    draft: '',
    setDraft: vi.fn(),
    setError: vi.fn(),
    setLoading: vi.fn(),
    setSessions: vi.fn(),
    setMessages: vi.fn(),
    setEvents: vi.fn(),
    setCheckpoint: vi.fn(),
    setActiveSessionId: vi.fn(),
    requestStreamReconnect: vi.fn(),
    pendingInitialMessage: { current: null },
    pendingUserIds: { current: {} as Record<string, string> },
    pendingAssistantIds: { current: {} as Record<string, string> },
    optimisticThinkingStartedAt: { current: {} },
    ...overrides
  } as any;
}

describe('chat-session-lifecycle-actions', () => {
  let runLoading: any;
  let refreshCheckpointOnly: any;
  let hydrateSessionSnapshot: any;

  beforeEach(() => {
    runLoading = vi.fn(async (task: () => Promise<any>) => task());
    refreshCheckpointOnly = vi.fn().mockResolvedValue(undefined);
    hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
  });

  describe('recoverActiveSession', () => {
    it('recovers when session is idle', async () => {
      const options = createMockOptions();
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.recoverActiveSession();

      expect(options.requestStreamReconnect).toHaveBeenCalledWith('s1');
      expect(hydrateSessionSnapshot).toHaveBeenCalledWith('s1', false);
    });

    it('returns early when no active session', async () => {
      const options = createMockOptions({ activeSessionId: '' });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.recoverActiveSession();

      expect(options.setError).not.toHaveBeenCalled();
    });

    it('sets error when session is running', async () => {
      const options = createMockOptions({
        activeSession: {
          id: 's1',
          status: 'running' as const,
          title: 'Session 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.recoverActiveSession();

      expect(options.setError).toHaveBeenCalledWith('当前这轮已经在处理中，无需重复恢复。');
    });

    it('sets error when session is waiting_approval', async () => {
      const options = createMockOptions({
        activeSession: {
          id: 's1',
          status: 'waiting_approval' as const,
          title: 'Session 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.recoverActiveSession();

      expect(options.setError).toHaveBeenCalledWith('当前这轮已经在处理中，无需重复恢复。');
    });
  });

  describe('cancelActiveSession', () => {
    it('cancels active session successfully', async () => {
      const options = createMockOptions({
        activeSession: {
          id: 's1',
          status: 'running' as const,
          title: 'Session 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.cancelActiveSession('user requested');

      expect(hydrateSessionSnapshot).toHaveBeenCalledWith('s1', false);
    });

    it('returns early when no active session', async () => {
      const options = createMockOptions({ activeSessionId: '' });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.cancelActiveSession();

      expect(options.setError).not.toHaveBeenCalled();
    });

    it('sets error when session is already cancelled', async () => {
      const options = createMockOptions({
        activeSession: {
          id: 's1',
          status: 'cancelled' as const,
          title: 'Session 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.cancelActiveSession();

      expect(options.setError).toHaveBeenCalledWith('当前这轮已经终止，无需重复操作。');
    });

    it('sets error when session is completed', async () => {
      const options = createMockOptions({
        activeSession: {
          id: 's1',
          status: 'completed' as const,
          title: 'Session 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.cancelActiveSession();

      expect(options.setError).toHaveBeenCalledWith('当前没有可终止的运行中的任务。');
    });

    it('sets error when session is failed', async () => {
      const options = createMockOptions({
        activeSession: {
          id: 's1',
          status: 'failed' as const,
          title: 'Session 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        }
      });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.cancelActiveSession();

      expect(options.setError).toHaveBeenCalledWith('当前没有可终止的运行中的任务。');
    });

    it('sets error when session is idle and no checkpoint taskId', async () => {
      const options = createMockOptions({
        activeSession: {
          id: 's1',
          status: 'idle' as const,
          title: 'Session 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        },
        checkpoint: undefined
      });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.cancelActiveSession();

      expect(options.setError).toHaveBeenCalledWith('当前没有可终止的运行中的任务。');
    });

    it('proceeds when session is idle but has checkpoint taskId', async () => {
      const options = createMockOptions({
        activeSession: {
          id: 's1',
          status: 'idle' as const,
          title: 'Session 1',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z'
        },
        checkpoint: { taskId: 'task-1' }
      });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.cancelActiveSession('stop');

      expect(hydrateSessionSnapshot).toHaveBeenCalled();
    });
  });

  describe('deleteSessionById', () => {
    it('deletes session and cleans up state', async () => {
      const options = createMockOptions();
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.deleteSessionById('s1');

      expect(options.setSessions).toHaveBeenCalled();
      expect(options.setMessages).toHaveBeenCalledWith([]);
      expect(options.setEvents).toHaveBeenCalledWith([]);
      expect(options.setCheckpoint).toHaveBeenCalledWith(undefined);
      expect(options.setActiveSessionId).toHaveBeenCalledWith('');
    });

    it('returns early for empty sessionId', async () => {
      const options = createMockOptions();
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.deleteSessionById('');

      expect(options.setSessions).not.toHaveBeenCalled();
    });

    it('does not clear active session when deleting non-active session', async () => {
      const options = createMockOptions();
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.deleteSessionById('other-session');

      expect(options.setMessages).not.toHaveBeenCalled();
    });

    it('handles deleteSession returning undefined', async () => {
      runLoading = vi.fn(async () => undefined);
      const options = createMockOptions();
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.deleteSessionById('s1');

      expect(options.setSessions).not.toHaveBeenCalled();
    });
  });

  describe('deleteActiveSession', () => {
    it('deletes active session', async () => {
      const options = createMockOptions();
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.deleteActiveSession();

      expect(options.setSessions).toHaveBeenCalled();
    });

    it('does nothing when no active session', async () => {
      const options = createMockOptions({ activeSessionId: '' });
      const actions = createLifecycleActions({ options, runLoading, refreshCheckpointOnly, hydrateSessionSnapshot });
      await actions.deleteActiveSession();

      expect(options.setSessions).not.toHaveBeenCalled();
    });
  });
});
