import { describe, expect, it, vi } from 'vitest';

import {
  buildChatHomeShareLinks,
  buildDeleteSessionConfirmConfig,
  buildReplayDownloadFilename,
  buildRuntimeExportRequest,
  buildShareLinksText,
  downloadTextFile,
  getWorkbenchToggleLabel,
  openApprovalFeedbackState,
  resolveApprovalFeedbackSubmission,
  resolveCognitionTargetMessageId,
  resolveNextCognitionExpansion,
  resolveNextCognitionExpansionPatch,
  resetApprovalFeedbackState,
  serializeBrowserReplay,
  shouldShowErrorAlert,
  shouldShowSessionHeaderActions
} from '@/pages/chat-home/chat-home-page-helpers';

describe('chat-home-page-helpers', () => {
  describe('resolveNextCognitionExpansionPatch', () => {
    it('returns undefined when no cognition target message ID', () => {
      expect(
        resolveNextCognitionExpansionPatch({
          wasThinkLoading: false,
          isThinkLoading: false,
          hasCognitionTarget: false,
          isSessionRunning: false
        })
      ).toBeUndefined();
    });

    it('expands when think is loading', () => {
      expect(
        resolveNextCognitionExpansionPatch({
          wasThinkLoading: false,
          isThinkLoading: true,
          hasCognitionTarget: false,
          isSessionRunning: false,
          cognitionTargetMessageId: 'msg-1'
        })
      ).toEqual({ 'msg-1': true });
    });

    it('collapses when think just finished and has cognition target', () => {
      expect(
        resolveNextCognitionExpansionPatch({
          wasThinkLoading: true,
          isThinkLoading: false,
          hasCognitionTarget: true,
          isSessionRunning: true,
          cognitionTargetMessageId: 'msg-1'
        })
      ).toEqual({ 'msg-1': false });
    });

    it('collapses when has cognition target, not loading, and session is not running', () => {
      expect(
        resolveNextCognitionExpansionPatch({
          wasThinkLoading: false,
          isThinkLoading: false,
          hasCognitionTarget: true,
          isSessionRunning: false,
          cognitionTargetMessageId: 'msg-1'
        })
      ).toEqual({ 'msg-1': false });
    });

    it('returns undefined when has cognition target but session is running and not loading', () => {
      expect(
        resolveNextCognitionExpansionPatch({
          wasThinkLoading: false,
          isThinkLoading: false,
          hasCognitionTarget: true,
          isSessionRunning: true,
          cognitionTargetMessageId: 'msg-1'
        })
      ).toBeUndefined();
    });
  });

  describe('resolveNextCognitionExpansion (deprecated)', () => {
    it('returns true when think is loading', () => {
      expect(
        resolveNextCognitionExpansion({
          wasThinkLoading: false,
          isThinkLoading: true,
          hasCognitionTarget: false,
          isSessionRunning: false
        })
      ).toBe(true);
    });

    it('returns false when think just finished and has cognition target', () => {
      expect(
        resolveNextCognitionExpansion({
          wasThinkLoading: true,
          isThinkLoading: false,
          hasCognitionTarget: true,
          isSessionRunning: true
        })
      ).toBe(false);
    });

    it('returns false when has target, not loading, session not running', () => {
      expect(
        resolveNextCognitionExpansion({
          wasThinkLoading: false,
          isThinkLoading: false,
          hasCognitionTarget: true,
          isSessionRunning: false
        })
      ).toBe(false);
    });

    it('returns undefined otherwise', () => {
      expect(
        resolveNextCognitionExpansion({
          wasThinkLoading: false,
          isThinkLoading: false,
          hasCognitionTarget: false,
          isSessionRunning: true
        })
      ).toBeUndefined();
    });
  });

  describe('shouldShowErrorAlert', () => {
    it('returns true when error exists, not dismissed, and has copy', () => {
      expect(shouldShowErrorAlert('fail', '', true)).toBe(true);
    });

    it('returns false when error is dismissed', () => {
      expect(shouldShowErrorAlert('fail', 'fail', true)).toBe(false);
    });

    it('returns false when no error copy', () => {
      expect(shouldShowErrorAlert('fail', '', false)).toBe(false);
    });

    it('returns false when error is empty', () => {
      expect(shouldShowErrorAlert('', '', true)).toBe(false);
    });
  });

  describe('shouldShowSessionHeaderActions', () => {
    it('returns true when active session ID is provided', () => {
      expect(shouldShowSessionHeaderActions('session-1')).toBe(true);
    });

    it('returns false when active session ID is empty', () => {
      expect(shouldShowSessionHeaderActions('')).toBe(false);
    });

    it('returns false when active session ID is undefined', () => {
      expect(shouldShowSessionHeaderActions(undefined)).toBe(false);
    });
  });

  describe('getWorkbenchToggleLabel', () => {
    it('returns collapse label when workbench is shown', () => {
      expect(getWorkbenchToggleLabel(true)).toBe('收起工作区');
    });

    it('returns open label when workbench is hidden', () => {
      expect(getWorkbenchToggleLabel(false)).toBe('打开工作区');
    });
  });

  describe('buildShareLinksText', () => {
    it('includes runtime and approvals URLs', () => {
      const text = buildShareLinksText({
        runtimeUrl: 'http://runtime',
        approvalsUrl: 'http://approvals'
      });

      expect(text).toContain('runtime: http://runtime');
      expect(text).toContain('approvals: http://approvals');
    });

    it('includes observatory and replay URLs when provided', () => {
      const text = buildShareLinksText({
        runtimeUrl: 'http://runtime',
        approvalsUrl: 'http://approvals',
        observatoryUrl: 'http://obs',
        replayUrl: 'http://replay'
      });

      expect(text).toContain('observatory: http://obs');
      expect(text).toContain('replay: http://replay');
    });

    it('excludes optional URLs when not provided', () => {
      const text = buildShareLinksText({
        runtimeUrl: 'http://runtime',
        approvalsUrl: 'http://approvals'
      });

      expect(text).not.toContain('observatory');
      expect(text).not.toContain('replay');
    });
  });

  describe('buildReplayDownloadFilename', () => {
    it('generates correct filename', () => {
      expect(buildReplayDownloadFilename('sess-123')).toBe('browser-replay-sess-123.json');
    });
  });

  describe('buildRuntimeExportRequest', () => {
    it('builds request with checkpoint data', () => {
      const result = buildRuntimeExportRequest({
        executionMode: 'plan',
        activeInterrupt: {
          kind: 'approval',
          payload: { interactionKind: 'approval' }
        }
      } as any);

      expect(result).toEqual({
        executionMode: 'plan',
        interactionKind: 'approval',
        format: 'json'
      });
    });

    it('builds request with undefined checkpoint', () => {
      const result = buildRuntimeExportRequest(undefined);

      expect(result).toEqual({
        executionMode: undefined,
        interactionKind: undefined,
        format: 'json'
      });
    });
  });

  describe('serializeBrowserReplay', () => {
    it('serializes replay data as formatted JSON', () => {
      const replay = { events: [{ type: 'click' }] };
      const result = serializeBrowserReplay(replay);

      expect(result).toBe(JSON.stringify(replay, null, 2));
    });
  });

  describe('openApprovalFeedbackState', () => {
    it('returns feedback intent and draft from reason', () => {
      expect(openApprovalFeedbackState('write_file', 'too risky')).toEqual({
        feedbackIntent: 'write_file',
        feedbackDraft: 'too risky'
      });
    });

    it('defaults draft to empty when no reason', () => {
      expect(openApprovalFeedbackState('install_skill')).toEqual({
        feedbackIntent: 'install_skill',
        feedbackDraft: ''
      });
    });
  });

  describe('resetApprovalFeedbackState', () => {
    it('returns empty intent and draft', () => {
      expect(resetApprovalFeedbackState()).toEqual({
        feedbackIntent: '',
        feedbackDraft: ''
      });
    });
  });

  describe('resolveApprovalFeedbackSubmission', () => {
    it('returns null when no feedback intent', () => {
      expect(resolveApprovalFeedbackSubmission('', '')).toBeNull();
    });

    it('returns submission with trimmed reason', () => {
      expect(resolveApprovalFeedbackSubmission('write_file', '  too dangerous  ')).toEqual({
        intent: 'write_file',
        approved: false,
        reason: 'too dangerous'
      });
    });

    it('returns undefined reason when draft is empty', () => {
      expect(resolveApprovalFeedbackSubmission('write_file', '')).toEqual({
        intent: 'write_file',
        approved: false,
        reason: undefined
      });
    });
  });

  describe('buildDeleteSessionConfirmConfig', () => {
    it('returns config with confirm callback', () => {
      const onConfirm = vi.fn();
      const config = buildDeleteSessionConfirmConfig(onConfirm);

      expect(config.title).toBe('删除当前会话？');
      expect(config.okText).toBe('删除');
      expect(config.cancelText).toBe('取消');
      expect(config.okButtonProps).toEqual({ danger: true });
      expect(config.onOk).toBe(onConfirm);
    });
  });

  describe('downloadTextFile', () => {
    it('creates and triggers a download link', () => {
      const mockAnchor = { href: '', download: '', click: vi.fn() };
      const mockBody = { appendChild: vi.fn(), removeChild: vi.fn() };
      vi.stubGlobal('document', { body: mockBody, createElement: vi.fn(() => mockAnchor) });
      vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

      downloadTextFile('test.json', 'application/json', '{"ok":true}');

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.href).toBe('blob:mock');
      expect(mockAnchor.download).toBe('test.json');
      expect(mockBody.appendChild).toHaveBeenCalledWith(mockAnchor);
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockBody.removeChild).toHaveBeenCalledWith(mockAnchor);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');

      vi.unstubAllGlobals();
    });
  });
});
