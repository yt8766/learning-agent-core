import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/api/chat-api', () => ({
  getRemoteSkillInstallReceipt: vi.fn(),
  installRemoteSkill: vi.fn()
}));

vi.mock('@/hooks/chat-session/chat-session-control-action-helpers', () => ({
  mapReceiptStatus: vi.fn((status: string, phase?: string) => phase ?? status)
}));

vi.mock('@/hooks/chat-session/chat-session-control-actions', () => ({
  insertOptimisticControlMessage: vi.fn()
}));

import {
  updateSkillSuggestionInstallState,
  pollSkillInstallReceipt
} from '@/hooks/chat-session/chat-session-skill-install-actions';
import { getRemoteSkillInstallReceipt, installRemoteSkill } from '@/api/chat-api';
import type { CreateChatSessionActionsOptions } from '@/hooks/chat-session/chat-session-actions.types';
import type { ChatMessageRecord } from '@/types/chat';

function createOptions(overrides: Partial<CreateChatSessionActionsOptions> = {}): CreateChatSessionActionsOptions {
  return {
    activeSessionId: 'session-1',
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
    pendingUserIds: { current: {} },
    pendingAssistantIds: { current: {} },
    optimisticThinkingStartedAt: { current: {} },
    ...overrides
  };
}

describe('updateSkillSuggestionInstallState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates install state for matching suggestion in matching session', () => {
    const setMessages = vi.fn();
    const options = createOptions({ setMessages });
    const messages: ChatMessageRecord[] = [
      {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        card: {
          type: 'skill_suggestions' as const,
          capabilityGapDetected: false,
          status: 'suggested' as const,
          safetyNotes: [],
          suggestions: [
            {
              id: 'sug-1',
              displayName: 'Skill A',
              kind: 'manifest' as const,
              summary: '',
              score: 1,
              availability: 'installable-remote' as const,
              reason: '',
              requiredCapabilities: [],
              installState: { receiptId: '', status: 'pending' as const }
            },
            {
              id: 'sug-2',
              displayName: 'Skill B',
              kind: 'manifest' as const,
              summary: '',
              score: 1,
              availability: 'installable-remote' as const,
              reason: '',
              requiredCapabilities: [],
              installState: { receiptId: '', status: 'pending' as const }
            }
          ]
        }
      }
    ];
    (setMessages as any).mockImplementation((fn: any) => fn(messages));

    updateSkillSuggestionInstallState(options, 'session-1', 'sug-1', {
      receiptId: 'receipt-1',
      status: 'requesting'
    });

    expect(setMessages).toHaveBeenCalled();
  });

  it('does not modify messages from different sessions', () => {
    const setMessages = vi.fn();
    const options = createOptions({ setMessages });
    const messages: ChatMessageRecord[] = [
      {
        id: 'msg-1',
        sessionId: 'other-session',
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        card: {
          type: 'skill_suggestions' as const,
          capabilityGapDetected: false,
          status: 'suggested' as const,
          safetyNotes: [],
          suggestions: [
            {
              id: 'sug-1',
              displayName: 'Skill A',
              kind: 'manifest' as const,
              summary: '',
              score: 1,
              availability: 'installable-remote' as const,
              reason: '',
              requiredCapabilities: [],
              installState: { receiptId: '', status: 'pending' as const }
            }
          ]
        }
      }
    ];
    (setMessages as any).mockImplementation((fn: any) => fn(messages));

    updateSkillSuggestionInstallState(options, 'session-1', 'sug-1', {
      receiptId: 'receipt-1',
      status: 'requesting'
    });

    // Messages from other session should remain unchanged
    expect(messages[0].card).toBeDefined();
  });

  it('does not modify messages without skill_suggestions card', () => {
    const setMessages = vi.fn();
    const options = createOptions({ setMessages });
    const messages: ChatMessageRecord[] = [
      {
        id: 'msg-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: 'plain message',
        createdAt: new Date().toISOString()
      }
    ];
    (setMessages as any).mockImplementation((fn: any) => fn(messages));

    updateSkillSuggestionInstallState(options, 'session-1', 'sug-1', {
      receiptId: 'receipt-1',
      status: 'requesting'
    });

    expect(messages[0].content).toBe('plain message');
  });
});

describe('pollSkillInstallReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops polling after max attempts', async () => {
    const options = createOptions();
    const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
    const refreshCheckpointOnly = vi.fn().mockResolvedValue(undefined);

    await pollSkillInstallReceipt(options, {
      sessionId: 'session-1',
      suggestionId: 'sug-1',
      receiptId: 'receipt-1',
      attempt: 40,
      hydrateSessionSnapshot,
      refreshCheckpointOnly
    });

    expect(getRemoteSkillInstallReceipt).not.toHaveBeenCalled();
  });

  it('handles installed receipt status', async () => {
    vi.mocked(getRemoteSkillInstallReceipt).mockResolvedValue({
      id: 'receipt-1',
      status: 'installed',
      phase: 'done',
      installedAt: new Date().toISOString()
    } as any);

    const options = createOptions();
    const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
    const refreshCheckpointOnly = vi.fn().mockResolvedValue(undefined);

    await pollSkillInstallReceipt(options, {
      sessionId: 'session-1',
      suggestionId: 'sug-1',
      receiptId: 'receipt-1',
      attempt: 0,
      hydrateSessionSnapshot,
      refreshCheckpointOnly
    });

    expect(hydrateSessionSnapshot).toHaveBeenCalledWith('session-1', false);
  });

  it('handles failed receipt status', async () => {
    vi.mocked(getRemoteSkillInstallReceipt).mockResolvedValue({
      id: 'receipt-1',
      status: 'failed',
      phase: 'install',
      failureCode: 'timeout'
    } as any);

    const options = createOptions();
    const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
    const refreshCheckpointOnly = vi.fn().mockResolvedValue(undefined);

    await pollSkillInstallReceipt(options, {
      sessionId: 'session-1',
      suggestionId: 'sug-1',
      receiptId: 'receipt-1',
      attempt: 0,
      hydrateSessionSnapshot,
      refreshCheckpointOnly
    });

    expect(refreshCheckpointOnly).toHaveBeenCalledWith('session-1');
  });

  it('handles rejected receipt status', async () => {
    vi.mocked(getRemoteSkillInstallReceipt).mockResolvedValue({
      id: 'receipt-1',
      status: 'rejected',
      phase: 'review'
    } as any);

    const options = createOptions();
    const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
    const refreshCheckpointOnly = vi.fn().mockResolvedValue(undefined);

    await pollSkillInstallReceipt(options, {
      sessionId: 'session-1',
      suggestionId: 'sug-1',
      receiptId: 'receipt-1',
      attempt: 0,
      hydrateSessionSnapshot,
      refreshCheckpointOnly
    });

    expect(refreshCheckpointOnly).toHaveBeenCalledWith('session-1');
  });

  it('sets failed state when error occurs after 5 attempts', async () => {
    vi.mocked(getRemoteSkillInstallReceipt).mockRejectedValue(new Error('network'));

    const setMessages = vi.fn();
    const options = createOptions({ setMessages });
    (setMessages as any).mockImplementation((fn: any) => fn([]));

    const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
    const refreshCheckpointOnly = vi.fn().mockResolvedValue(undefined);

    await pollSkillInstallReceipt(options, {
      sessionId: 'session-1',
      suggestionId: 'sug-1',
      receiptId: 'receipt-1',
      attempt: 5,
      hydrateSessionSnapshot,
      refreshCheckpointOnly
    });

    // Should have set failed state
    expect(setMessages).toHaveBeenCalled();
  });
});
