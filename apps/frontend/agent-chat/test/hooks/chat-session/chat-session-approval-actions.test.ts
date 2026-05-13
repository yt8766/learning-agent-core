import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/api/chat-api', () => ({
  approveSession: vi.fn().mockResolvedValue({}),
  allowApprovalCapability: vi.fn().mockResolvedValue({}),
  allowApprovalConnector: vi.fn().mockResolvedValue({}),
  confirmLearning: vi.fn().mockResolvedValue({}),
  rejectSession: vi.fn().mockResolvedValue({}),
  respondInterrupt: vi.fn().mockResolvedValue({})
}));

vi.mock('@/hooks/chat-session/chat-session-control-actions', () => ({
  insertOptimisticControlMessage: vi.fn()
}));

import { createApprovalActions } from '@/hooks/chat-session/chat-session-approval-actions';
import {
  approveSession,
  allowApprovalCapability,
  allowApprovalConnector,
  confirmLearning,
  rejectSession,
  respondInterrupt
} from '@/api/chat-api';
import { insertOptimisticControlMessage } from '@/hooks/chat-session/chat-session-control-actions';
import type { CreateChatSessionActionsOptions } from '@/hooks/chat-session/chat-session-actions.types';
import type { RunLoadingFn } from '@/hooks/chat-session/chat-session-action-utils';

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

function createRunLoading(): RunLoadingFn {
  return vi.fn(async task => task());
}

describe('createApprovalActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateApproval', () => {
    it('calls approveSession when approved is true', async () => {
      const options = createOptions();
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.updateApproval('intent-1', true, 'feedback', 'once');

      expect(approveSession).toHaveBeenCalledWith('session-1', 'intent-1', 'feedback', 'once');
      expect(hydrateSessionSnapshot).toHaveBeenCalledWith('session-1', false);
    });

    it('calls rejectSession when approved is false', async () => {
      const options = createOptions();
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.updateApproval('intent-1', false, 'reason');

      expect(rejectSession).toHaveBeenCalledWith('session-1', 'intent-1', 'reason');
      expect(hydrateSessionSnapshot).toHaveBeenCalledWith('session-1', false);
    });

    it('does nothing when activeSessionId is empty', async () => {
      const options = createOptions({ activeSessionId: '' });
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn();
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.updateApproval('intent-1', true);

      expect(approveSession).not.toHaveBeenCalled();
      expect(hydrateSessionSnapshot).not.toHaveBeenCalled();
    });

    it('does not hydrate when runLoading returns undefined', async () => {
      const options = createOptions();
      const runLoading = vi.fn(async () => undefined) as unknown as RunLoadingFn;
      const hydrateSessionSnapshot = vi.fn();
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.updateApproval('intent-1', true);

      expect(hydrateSessionSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('updatePlanInterrupt', () => {
    it('calls respondInterrupt with approve endpoint for input action', async () => {
      const options = createOptions();
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.updatePlanInterrupt({
        action: 'input',
        interruptId: 'int-1',
        answers: [{ questionId: 'q1', optionId: 'o1', freeform: 'text' }]
      });

      expect(respondInterrupt).toHaveBeenCalledWith('session-1', {
        endpoint: 'approve',
        intent: 'plan_question',
        interrupt: {
          interruptId: 'int-1',
          action: 'input',
          payload: {
            answers: [{ questionId: 'q1', optionId: 'o1', freeform: 'text' }],
            interactionKind: 'plan-question'
          }
        }
      });
      expect(insertOptimisticControlMessage).toHaveBeenCalledWith(options, 'session-1', '已提交计划回答，正在更新方案');
      expect(hydrateSessionSnapshot).toHaveBeenCalledWith('session-1', false);
    });

    it('calls respondInterrupt with approve endpoint for bypass action', async () => {
      const options = createOptions();
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.updatePlanInterrupt({ action: 'bypass' });

      expect(respondInterrupt).toHaveBeenCalledWith('session-1', {
        endpoint: 'approve',
        intent: 'plan_question',
        interrupt: {
          interruptId: undefined,
          action: 'bypass',
          payload: { interactionKind: 'plan-question' }
        }
      });
      expect(insertOptimisticControlMessage).toHaveBeenCalledWith(
        options,
        'session-1',
        '已按推荐项跳过计划，正在继续执行'
      );
    });

    it('calls respondInterrupt with reject endpoint for abort action', async () => {
      const options = createOptions();
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.updatePlanInterrupt({ action: 'abort' });

      expect(respondInterrupt).toHaveBeenCalledWith('session-1', {
        endpoint: 'reject',
        intent: 'plan_question',
        interrupt: {
          interruptId: undefined,
          action: 'abort',
          payload: { interactionKind: 'plan-question' }
        }
      });
      expect(insertOptimisticControlMessage).toHaveBeenCalledWith(options, 'session-1', '计划已取消');
    });

    it('does nothing when activeSessionId is empty', async () => {
      const options = createOptions({ activeSessionId: '' });
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn();
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.updatePlanInterrupt({ action: 'input' });

      expect(respondInterrupt).not.toHaveBeenCalled();
    });

    it('does not insert message or hydrate when runLoading returns undefined', async () => {
      const options = createOptions();
      const runLoading = vi.fn(async () => undefined) as unknown as RunLoadingFn;
      const hydrateSessionSnapshot = vi.fn();
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.updatePlanInterrupt({ action: 'input' });

      expect(insertOptimisticControlMessage).not.toHaveBeenCalled();
      expect(hydrateSessionSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('allowApprovalAndApprove', () => {
    it('allows capability and approves with always scope', async () => {
      const options = createOptions();
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.allowApprovalAndApprove({
        intent: 'intent-1',
        capabilityId: 'cap-1',
        serverId: 'server-1'
      });

      expect(allowApprovalCapability).toHaveBeenCalledWith('server-1', 'cap-1');
      expect(approveSession).toHaveBeenCalledWith('session-1', 'intent-1', undefined, 'always');
      expect(hydrateSessionSnapshot).toHaveBeenCalledWith('session-1', false);
    });

    it('allows connector when only serverId is provided', async () => {
      const options = createOptions();
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.allowApprovalAndApprove({
        intent: 'intent-1',
        serverId: 'server-1'
      });

      expect(allowApprovalConnector).toHaveBeenCalledWith('server-1');
      expect(approveSession).toHaveBeenCalledWith('session-1', 'intent-1', undefined, 'always');
    });

    it('approves directly when neither capabilityId nor serverId provided', async () => {
      const options = createOptions();
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.allowApprovalAndApprove({ intent: 'intent-1' });

      expect(allowApprovalCapability).not.toHaveBeenCalled();
      expect(allowApprovalConnector).not.toHaveBeenCalled();
      expect(approveSession).toHaveBeenCalledWith('session-1', 'intent-1', undefined, 'always');
    });

    it('does nothing when activeSessionId is empty', async () => {
      const options = createOptions({ activeSessionId: '' });
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn();
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.allowApprovalAndApprove({ intent: 'intent-1' });

      expect(approveSession).not.toHaveBeenCalled();
    });
  });

  describe('submitLearningConfirmation', () => {
    it('calls confirmLearning and hydrates', async () => {
      const options = createOptions();
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn().mockResolvedValue(undefined);
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.submitLearningConfirmation();

      expect(confirmLearning).toHaveBeenCalledWith('session-1');
      expect(hydrateSessionSnapshot).toHaveBeenCalledWith('session-1', false);
    });

    it('does nothing when activeSessionId is empty', async () => {
      const options = createOptions({ activeSessionId: '' });
      const runLoading = createRunLoading();
      const hydrateSessionSnapshot = vi.fn();
      const actions = createApprovalActions({ options, runLoading, hydrateSessionSnapshot });

      await actions.submitLearningConfirmation();

      expect(confirmLearning).not.toHaveBeenCalled();
    });
  });
});
