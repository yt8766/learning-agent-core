import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-chat-session', () => ({
  formatSessionTime: (value?: string) => (value ? `formatted:${value}` : '--')
}));

vi.mock('@/pages/chat-home/chat-home-helpers', () => ({
  buildEventSummary: (event: { type: string }) => `summary:${event.type}`
}));

const mockBuildApprovalsCenterExportUrl = vi.fn();
const mockBuildAdminRuntimeObservatoryUrl = vi.fn();
const mockBuildBrowserReplayUrl = vi.fn();
const mockBuildRuntimeCenterExportUrl = vi.fn();
const mockGetRuntimeDrawerExportFilters = vi.fn();

vi.mock('@/api/chat-api', () => ({
  buildApprovalsCenterExportUrl: (params: Record<string, unknown>) => mockBuildApprovalsCenterExportUrl(params),
  buildAdminRuntimeObservatoryUrl: (params: { taskId: string }) => mockBuildAdminRuntimeObservatoryUrl(params),
  buildBrowserReplayUrl: (sessionId: string) => mockBuildBrowserReplayUrl(sessionId),
  buildRuntimeCenterExportUrl: (params: Record<string, unknown>) => mockBuildRuntimeCenterExportUrl(params)
}));

vi.mock('@/pages/runtime-panel/chat-runtime-drawer', () => ({
  getRuntimeDrawerExportFilters: (checkpoint?: unknown) => mockGetRuntimeDrawerExportFilters(checkpoint)
}));

import {
  buildApprovalsExportRequest,
  buildChatHomeShareLinks,
  buildDeleteSessionConfirmConfig,
  buildReplayDownloadFilename,
  buildRuntimeExportRequest,
  buildShareLinksText,
  buildCognitionDurationLabel,
  resolveNextCognitionExpansion,
  buildStreamEventItems,
  downloadTextFile,
  getWorkbenchToggleLabel,
  openApprovalFeedbackState,
  resetApprovalFeedbackState,
  resolveCognitionTargetMessageId,
  resolveApprovalFeedbackSubmission,
  serializeBrowserReplay,
  shouldShowSessionHeaderActions,
  shouldShowErrorAlert
} from '@/pages/chat-home/chat-home-page-helpers';

describe('chat-home-page helpers', () => {
  it('prefers thinkState message id and falls back to thought chain message id', () => {
    expect(
      resolveCognitionTargetMessageId(
        {
          thinkState: {
            messageId: 'assistant-1',
            title: 'thinking',
            content: 'content',
            loading: true,
            blink: true,
            thinkingDurationMs: 1000
          }
        } as never,
        [{ key: 'step-1', title: 'old', description: 'old', messageId: 'assistant-2' }] as never
      )
    ).toBe('assistant-1');

    expect(
      resolveCognitionTargetMessageId(undefined, [
        { key: 'step-1', title: 'old', description: 'old', messageId: 'assistant-2' }
      ] as never)
    ).toBe('assistant-2');

    expect(resolveCognitionTargetMessageId(undefined, undefined)).toBe('');
  });

  it('builds running and settled cognition duration labels', () => {
    expect(
      buildCognitionDurationLabel(
        {
          updatedAt: '2026-04-08T00:00:00.000Z',
          thinkState: {
            messageId: 'assistant-1',
            title: 'thinking',
            content: 'content',
            loading: true,
            blink: true,
            thinkingDurationMs: 1500
          }
        } as never,
        undefined,
        new Date('2026-04-08T00:00:02.400Z').getTime()
      )
    ).toBe('4s');

    expect(
      buildCognitionDurationLabel(
        {
          updatedAt: '2026-04-08T00:00:00.000Z',
          thinkState: {
            messageId: 'assistant-1',
            title: 'thinking',
            content: 'content',
            loading: false,
            blink: false,
            thinkingDurationMs: 2100
          }
        } as never,
        undefined,
        Date.now()
      )
    ).toBe('约 2 秒');

    expect(
      buildCognitionDurationLabel(
        undefined,
        [{ key: 'step-1', title: 'old', description: 'old', thinkingDurationMs: 900 }] as never,
        Date.now()
      )
    ).toBe('约 1 秒');
  });

  it('collapses cognition when model thinking finishes while the session is still running', () => {
    expect(
      resolveNextCognitionExpansion({
        wasThinkLoading: true,
        isThinkLoading: false,
        hasCognitionTarget: true,
        isSessionRunning: true
      })
    ).toBe(false);
  });

  it('maps stream events into reversed, formatted items', () => {
    expect(
      buildStreamEventItems([
        {
          id: 'evt-1',
          type: 'user_message',
          at: '2026-04-08T00:00:00.000Z',
          payload: { content: 'hello' }
        },
        {
          id: 'evt-2',
          type: 'assistant_message',
          at: '2026-04-08T00:00:01.000Z',
          payload: { content: 'world' }
        }
      ] as never)
    ).toEqual([
      {
        id: 'evt-2',
        type: 'assistant_message',
        summary: 'summary:assistant_message',
        at: 'formatted:2026-04-08T00:00:01.000Z',
        raw: '{\n  "content": "world"\n}'
      },
      {
        id: 'evt-1',
        type: 'user_message',
        summary: 'summary:user_message',
        at: 'formatted:2026-04-08T00:00:00.000Z',
        raw: '{\n  "content": "hello"\n}'
      }
    ]);
  });

  it('builds error visibility, share links text and replay filename', () => {
    expect(shouldShowErrorAlert('provider timeout', '', true)).toBe(true);
    expect(shouldShowErrorAlert('provider timeout', 'provider timeout', true)).toBe(false);
    expect(shouldShowErrorAlert('provider timeout', '', false)).toBe(false);

    expect(
      buildShareLinksText({
        runtimeUrl: '/runtime-export',
        approvalsUrl: '/approvals-export',
        observatoryUrl: '/admin#/runtime?runtimeTaskId=task-1',
        replayUrl: '/replay'
      })
    ).toBe(
      [
        '当前运行视角链接',
        'runtime: /runtime-export',
        'approvals: /approvals-export',
        'observatory: /admin#/runtime?runtimeTaskId=task-1',
        'replay: /replay'
      ].join('\n')
    );
    expect(
      buildShareLinksText({
        runtimeUrl: '/runtime-export',
        approvalsUrl: '/approvals-export'
      })
    ).toBe(['当前运行视角链接', 'runtime: /runtime-export', 'approvals: /approvals-export'].join('\n'));

    expect(buildReplayDownloadFilename('session-1')).toBe('browser-replay-session-1.json');
  });

  it('builds export requests and share links from runtime drawer filters', () => {
    mockGetRuntimeDrawerExportFilters.mockReturnValue({
      executionMode: 'plan',
      interactionKind: 'plan-question'
    });
    mockBuildRuntimeCenterExportUrl.mockReturnValue('/runtime-export');
    mockBuildApprovalsCenterExportUrl.mockReturnValue('/approvals-export');
    mockBuildAdminRuntimeObservatoryUrl.mockReturnValue('/admin#/runtime?runtimeTaskId=task-1');
    mockBuildBrowserReplayUrl.mockReturnValue('/replay');

    expect(buildRuntimeExportRequest({ taskId: 'task-1' } as never)).toEqual({
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'json'
    });
    expect(buildApprovalsExportRequest({ taskId: 'task-1' } as never)).toEqual({
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'json'
    });
    expect(buildChatHomeShareLinks({ taskId: 'task-1' } as never, 'session-1')).toEqual({
      runtimeUrl: '/runtime-export',
      approvalsUrl: '/approvals-export',
      observatoryUrl: '/admin#/runtime?runtimeTaskId=task-1',
      replayUrl: '/replay'
    });
    expect(buildChatHomeShareLinks({ taskId: 'task-1' } as never, '')).toEqual({
      runtimeUrl: '/runtime-export',
      approvalsUrl: '/approvals-export',
      observatoryUrl: '/admin#/runtime?runtimeTaskId=task-1',
      replayUrl: ''
    });
    expect(buildChatHomeShareLinks(undefined, '')).toEqual({
      runtimeUrl: '/runtime-export',
      approvalsUrl: '/approvals-export',
      observatoryUrl: '',
      replayUrl: ''
    });
    expect(mockBuildRuntimeCenterExportUrl).toHaveBeenCalledWith({
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'json'
    });
    expect(mockBuildApprovalsCenterExportUrl).toHaveBeenCalledWith({
      executionMode: 'plan',
      interactionKind: 'plan-question',
      format: 'json'
    });
    expect(mockBuildAdminRuntimeObservatoryUrl).toHaveBeenCalledWith({
      taskId: 'task-1',
      executionMode: 'plan',
      interactionKind: 'plan-question'
    });
    expect(mockBuildBrowserReplayUrl).toHaveBeenCalledWith('session-1');
  });

  it('builds header and feedback helper state for chat home page chrome', async () => {
    expect(shouldShowSessionHeaderActions('session-1')).toBe(true);
    expect(shouldShowSessionHeaderActions('')).toBe(false);
    expect(getWorkbenchToggleLabel(true)).toBe('收起工作区');
    expect(getWorkbenchToggleLabel(false)).toBe('打开工作区');

    expect(openApprovalFeedbackState('enable_connector', '先别继续')).toEqual({
      feedbackIntent: 'enable_connector',
      feedbackDraft: '先别继续'
    });
    expect(openApprovalFeedbackState('enable_connector')).toEqual({
      feedbackIntent: 'enable_connector',
      feedbackDraft: ''
    });
    expect(resetApprovalFeedbackState()).toEqual({
      feedbackIntent: '',
      feedbackDraft: ''
    });

    expect(resolveApprovalFeedbackSubmission('', 'ignored')).toBeNull();
    expect(resolveApprovalFeedbackSubmission('enable_connector', '   ')).toEqual({
      intent: 'enable_connector',
      approved: false,
      reason: undefined
    });
    expect(resolveApprovalFeedbackSubmission('enable_connector', '  先补测试  ')).toEqual({
      intent: 'enable_connector',
      approved: false,
      reason: '先补测试'
    });

    const onConfirm = vi.fn(async () => undefined);
    const config = buildDeleteSessionConfirmConfig(onConfirm);
    expect(config).toMatchObject({
      title: '删除当前会话？',
      content: '删除后，这个会话的聊天记录、事件流和检查点都会一并移除。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消'
    });
    await config.onOk();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('serializes replay payloads and downloads text files through the document bridge', () => {
    expect(serializeBrowserReplay({ steps: [{ id: 1 }] })).toBe('{\n  "steps": [\n    {\n      "id": 1\n    }\n  ]\n}');

    const appendChild = vi.fn();
    const removeChild = vi.fn();
    const click = vi.fn();
    const anchor = { href: '', download: '', click } as unknown as HTMLAnchorElement;
    const createElement = vi.fn(() => anchor);
    const createObjectURL = vi.fn(() => 'blob:download');
    const revokeObjectURL = vi.fn();

    const previousDocument = globalThis.document;
    const previousUrl = globalThis.URL;

    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement,
        body: { appendChild, removeChild }
      },
      configurable: true
    });
    Object.defineProperty(globalThis, 'URL', {
      value: {
        createObjectURL,
        revokeObjectURL
      },
      configurable: true
    });

    downloadTextFile('runtime.json', 'application/json', '{"ok":true}');

    expect(createElement).toHaveBeenCalledWith('a');
    expect(anchor.href).toBe('blob:download');
    expect(anchor.download).toBe('runtime.json');
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');

    Object.defineProperty(globalThis, 'document', { value: previousDocument, configurable: true });
    Object.defineProperty(globalThis, 'URL', { value: previousUrl, configurable: true });
  });
});
