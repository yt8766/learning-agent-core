import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestMock, eventSourceMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  eventSourceMock: vi.fn()
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      request: requestMock
    }))
  }
}));

import {
  approveSession,
  allowApprovalCapability,
  allowApprovalConnector,
  appendMessage,
  buildApprovalsCenterExportPath,
  buildApprovalsCenterExportUrl,
  buildBrowserReplayPath,
  buildBrowserReplayUrl,
  buildRuntimeCenterExportPath,
  buildRuntimeCenterExportUrl,
  cancelSession,
  confirmLearning,
  createSession,
  createSessionStream,
  deleteSession,
  exportApprovalsCenter,
  exportRuntimeCenter,
  getBrowserReplay,
  listAvailableChatModels,
  getCheckpoint,
  getRemoteSkillInstallReceipt,
  installRemoteSkill,
  listEvents,
  listMessages,
  listSessions,
  recoverSession,
  rejectSession,
  respondInterrupt,
  selectSession,
  updateSession
} from '@/api/chat-api';

// Legacy aliases in input should normalize into canonical executionPlan.mode query values.
describe('chat-api url builders', () => {
  beforeEach(() => {
    requestMock.mockReset();
    eventSourceMock.mockReset();
    vi.unstubAllGlobals();
    vi.stubGlobal('EventSource', eventSourceMock);
  });

  it('builds runtime and approvals export urls with interrupt-native filters', () => {
    expect(
      buildRuntimeCenterExportUrl({
        executionMode: 'planning-readonly',
        interactionKind: 'plan-question',
        format: 'json'
      })
    ).toContain('/platform/runtime-center/export?days=30&executionMode=plan&interactionKind=plan-question&format=json');

    expect(
      buildApprovalsCenterExportUrl({
        executionMode: 'planning-readonly',
        interactionKind: 'plan-question',
        format: 'json'
      })
    ).toContain('/platform/approvals-center/export?executionMode=plan&interactionKind=plan-question&format=json');
  });

  it('builds browser replay urls for active sessions', () => {
    expect(buildBrowserReplayUrl('session-42')).toContain('/platform/browser-replays/session-42');
    expect(buildBrowserReplayPath('session 42')).toBe('/platform/browser-replays/session%2042');
  });

  it('builds export paths with defaults and preserves unknown execution modes', () => {
    expect(buildRuntimeCenterExportPath()).toBe('/platform/runtime-center/export?days=30&format=json');
    expect(
      buildApprovalsCenterExportPath({
        executionMode: 'custom-mode',
        format: 'csv'
      })
    ).toBe('/platform/approvals-center/export?executionMode=custom-mode&format=csv');
  });

  it('dedupes cached session and message requests and encodes session ids in urls', async () => {
    vi.useFakeTimers();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    let resolveRequest!: (value: { data: Array<{ id: string }> }) => void;
    requestMock.mockReturnValueOnce(
      new Promise(resolve => {
        resolveRequest = resolve;
      })
    );

    const sessionsA = listSessions();
    void listSessions();
    expect(requestMock).toHaveBeenCalledTimes(1);

    resolveRequest({ data: [{ id: 'session-1' }] });

    await expect(sessionsA).resolves.toEqual([{ id: 'session-1' }]);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/chat/sessions',
        method: 'GET',
        timeout: 5000
      })
    );

    const sessionsFromCache = await listSessions();
    expect(sessionsFromCache).toEqual([{ id: 'session-1' }]);
    expect(requestMock).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(2_500);
    requestMock.mockResolvedValueOnce({ data: [{ id: 'session-2' }] });
    await expect(listSessions()).resolves.toEqual([{ id: 'session-2' }]);
    expect(requestMock).toHaveBeenCalledTimes(2);

    requestMock.mockResolvedValueOnce({ data: [{ id: 'msg-1' }] });
    await expect(listMessages('session/1')).resolves.toEqual([{ id: 'msg-1' }]);
    expect(requestMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        url: '/chat/messages?sessionId=session%2F1',
        method: 'GET',
        timeout: 5000
      })
    );

    vi.useRealTimers();
  });

  it('issues post requests, event streams and cached checkpoint/event fetches', async () => {
    requestMock
      .mockResolvedValueOnce({ data: { id: 'message-1' } })
      .mockResolvedValueOnce({ data: undefined })
      .mockResolvedValueOnce({ data: [{ id: 'evt-1' }] })
      .mockResolvedValueOnce({ data: { replay: true } })
      .mockResolvedValueOnce({ data: { ok: true } })
      .mockResolvedValueOnce({ data: { ok: true } });

    await expect(appendMessage('session-1', 'hello', { modelId: 'minimax/MiniMax-M2.7' })).resolves.toEqual({
      id: 'message-1'
    });
    await expect(getCheckpoint('session-1')).resolves.toBeUndefined();
    await expect(listEvents('session-1')).resolves.toEqual([{ id: 'evt-1' }]);
    await expect(getBrowserReplay('session-1')).resolves.toEqual({ replay: true });
    await expect(allowApprovalCapability('conn/1', 'cap/2')).resolves.toEqual({ ok: true });
    await expect(allowApprovalConnector('conn/1')).resolves.toEqual({ ok: true });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        url: '/chat/messages',
        method: 'POST',
        data: { message: 'hello', sessionId: 'session-1', modelId: 'minimax/MiniMax-M2.7' }
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        url: '/chat/checkpoint?sessionId=session-1',
        method: 'GET',
        timeout: 5000
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        url: '/chat/events?sessionId=session-1',
        method: 'GET',
        timeout: 5000
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        url: '/platform/browser-replays/session-1',
        method: 'GET'
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        url: '/platform/connectors-center/conn%2F1/capabilities/cap%2F2/policy/allow',
        method: 'POST'
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        url: '/platform/connectors-center/conn%2F1/policy/allow',
        method: 'POST'
      })
    );

    createSessionStream('session/1');
    expect(eventSourceMock).toHaveBeenCalledWith(
      expect.stringContaining('/chat/stream?sessionId=session%2F1'),
      expect.objectContaining({ withCredentials: true })
    );
  });

  it('covers the remaining session and export wrapper calls', async () => {
    requestMock
      .mockResolvedValueOnce({ data: { id: 'session-created' } })
      .mockResolvedValueOnce({
        data: [{ id: 'minimax/MiniMax-M2.7', displayName: 'MiniMax-M2.7', providerId: 'minimax' }]
      })
      .mockResolvedValueOnce({ data: { id: 'session-selected' } })
      .mockResolvedValueOnce({ data: { id: 'approved' } })
      .mockResolvedValueOnce({ data: { id: 'rejected' } })
      .mockResolvedValueOnce({ data: { id: 'interrupted' } })
      .mockResolvedValueOnce({ data: { id: 'receipt-1' } })
      .mockResolvedValueOnce({ data: { id: 'learning-confirmed' } })
      .mockResolvedValueOnce({ data: { id: 'recovered' } })
      .mockResolvedValueOnce({ data: { id: 'cancelled' } })
      .mockResolvedValueOnce({ data: undefined })
      .mockResolvedValueOnce({ data: { id: 'updated' } })
      .mockResolvedValueOnce({ data: { id: 'remote-install' } })
      .mockResolvedValueOnce({ data: { filename: 'runtime.json' } })
      .mockResolvedValueOnce({ data: { filename: 'approvals.csv' } });

    await expect(createSession('hello', 'title')).resolves.toEqual({
      id: 'session-created'
    });
    await expect(listAvailableChatModels()).resolves.toEqual([
      { id: 'minimax/MiniMax-M2.7', displayName: 'MiniMax-M2.7', providerId: 'minimax' }
    ]);
    await expect(selectSession('session-1')).resolves.toEqual({
      id: 'session-selected'
    });
    await expect(approveSession('session-1', 'terminal.exec', 'ok', 'always')).resolves.toEqual({
      id: 'approved'
    });
    await expect(rejectSession('session-1', 'terminal.exec', 'stop')).resolves.toEqual({
      id: 'rejected'
    });
    await expect(
      respondInterrupt('session-1', {
        endpoint: 'approve',
        intent: 'terminal.exec',
        feedback: 'continue',
        interrupt: {
          interruptId: 'interrupt-1',
          action: 'feedback',
          payload: { value: 'continue' }
        }
      })
    ).resolves.toEqual({ id: 'interrupted' });
    await expect(getRemoteSkillInstallReceipt('receipt/1')).resolves.toEqual({
      id: 'receipt-1'
    });
    await expect(confirmLearning('session-1', ['cand-1'])).resolves.toEqual({
      id: 'learning-confirmed'
    });
    await expect(recoverSession('session-1')).resolves.toEqual({
      id: 'recovered'
    });
    await expect(cancelSession('session-1', 'user stopped')).resolves.toEqual({
      id: 'cancelled'
    });
    await expect(deleteSession('session/1')).resolves.toBeUndefined();
    await expect(updateSession('session/1', 'renamed')).resolves.toEqual({
      id: 'updated'
    });
    await expect(
      installRemoteSkill({
        repo: 'owner/repo',
        skillName: 'skill-a',
        triggerReason: 'capability_gap_detected'
      })
    ).resolves.toEqual({ id: 'remote-install' });
    await expect(
      exportRuntimeCenter({
        executionMode: 'standard',
        interactionKind: 'interrupt',
        format: 'json'
      })
    ).resolves.toEqual({ filename: 'runtime.json' });
    await expect(
      exportApprovalsCenter({
        executionMode: 'imperial_direct',
        interactionKind: 'approval',
        format: 'csv'
      })
    ).resolves.toEqual({ filename: 'approvals.csv' });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ url: '/chat/sessions', method: 'POST', data: { message: 'hello', title: 'title' } })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ url: '/chat/models', method: 'GET', timeout: 5000 })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ url: '/chat/sessions/session-1', method: 'GET' })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        url: '/chat/approve',
        method: 'POST',
        data: expect.objectContaining({ approvalScope: 'always', actor: 'agent-chat-user' })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        url: '/chat/reject',
        method: 'POST',
        data: expect.objectContaining({ feedback: 'stop', actor: 'agent-chat-user' })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        url: '/chat/approve',
        method: 'POST',
        data: expect.objectContaining({ interrupt: expect.objectContaining({ action: 'feedback' }) })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      7,
      expect.objectContaining({
        url: '/platform/skill-sources-center/receipts/receipt%2F1',
        method: 'GET',
        timeout: 5000
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      11,
      expect.objectContaining({ url: '/chat/sessions/session%2F1', method: 'DELETE' })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      12,
      expect.objectContaining({ url: '/chat/sessions/session%2F1', method: 'PATCH', data: { title: 'renamed' } })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      13,
      expect.objectContaining({
        url: '/platform/skill-sources-center/install-remote',
        method: 'POST',
        data: expect.objectContaining({ repo: 'owner/repo', actor: 'agent-chat-user' })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      14,
      expect.objectContaining({
        url: '/platform/runtime-center/export?days=30&executionMode=execute&interactionKind=interrupt&format=json',
        method: 'GET'
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      15,
      expect.objectContaining({
        url: '/platform/approvals-center/export?executionMode=imperial_direct&interactionKind=approval&format=csv',
        method: 'GET'
      })
    );
  });
});
