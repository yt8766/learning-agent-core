import { describe, expect, it, vi, beforeEach } from 'vitest';
import axios from 'axios';

import {
  delay,
  formatChatError,
  isMissingSessionError,
  normalizeOutboundMessage,
  shouldAttemptImmediateFinalReconcile,
  createRunLoading,
  FINAL_RECONCILE_RETRY_DELAY_MS,
  TERMINAL_SESSION_STATUSES
} from '@/hooks/chat-session/chat-session-action-utils';

vi.mock('@/hooks/chat-session/chat-session-checkpoint', () => ({
  deriveSessionStatusFromCheckpoint: vi.fn((checkpoint: any) => checkpoint._derivedStatus ?? 'idle')
}));

describe('chat-session-action-utils', () => {
  describe('TERMINAL_SESSION_STATUSES', () => {
    it('contains completed, failed, cancelled', () => {
      expect(TERMINAL_SESSION_STATUSES.has('completed')).toBe(true);
      expect(TERMINAL_SESSION_STATUSES.has('failed')).toBe(true);
      expect(TERMINAL_SESSION_STATUSES.has('cancelled')).toBe(true);
      expect(TERMINAL_SESSION_STATUSES.has('running')).toBe(false);
    });
  });

  describe('FINAL_RECONCILE_RETRY_DELAY_MS', () => {
    it('is 500ms', () => {
      expect(FINAL_RECONCILE_RETRY_DELAY_MS).toBe(500);
    });
  });

  describe('delay', () => {
    it('resolves after specified ms', async () => {
      vi.useFakeTimers();
      const promise = delay(100);
      vi.advanceTimersByTime(100);
      await promise;
      vi.useRealTimers();
    });
  });

  describe('formatChatError', () => {
    it('handles 404 for cancel session', () => {
      const error = new axios.AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        data: 'not found'
      } as any);
      const result = formatChatError(error, '终止会话失败');
      expect(result).toBe('当前会话不存在或已被移除。');
    });

    it('handles 400 for cancel session', () => {
      const error = new axios.AxiosError('Bad Request', '400', undefined, undefined, {
        status: 400,
        data: 'bad request'
      } as any);
      const result = formatChatError(error, '终止会话失败');
      expect(result).toBe('当前没有可终止的运行中的任务。');
    });

    it('handles 500+ for cancel session', () => {
      const error = new axios.AxiosError('Server Error', '500', undefined, undefined, {
        status: 500,
        data: 'server error'
      } as any);
      const result = formatChatError(error, '终止会话失败');
      expect(result).toContain('终止请求已发送');
    });

    it('handles axios error without response (network error)', () => {
      const error = new axios.AxiosError('Network Error');
      const result = formatChatError(error, '发送消息失败');
      expect(result).toContain('当前无法连接后端 API');
    });

    it('handles axios error with string response data', () => {
      const error = new axios.AxiosError('Error', '400', undefined, undefined, {
        status: 400,
        data: 'Invalid input'
      } as any);
      const result = formatChatError(error, '发送消息失败');
      expect(result).toBe('发送消息失败：Invalid input');
    });

    it('handles axios error with object response data containing message', () => {
      const error = new axios.AxiosError('Error', '400', undefined, undefined, {
        status: 400,
        data: { message: 'Field validation failed' }
      } as any);
      const result = formatChatError(error, '加载会话失败');
      expect(result).toBe('加载会话失败：Field validation failed');
    });

    it('falls back to error.message for axios error with unknown data shape', () => {
      const error = new axios.AxiosError('Something weird', '400', undefined, undefined, {
        status: 400,
        data: 12345
      } as any);
      const result = formatChatError(error, '加载会话失败');
      expect(result).toBe('加载会话失败：Something weird');
    });

    it('handles standard Error instances', () => {
      const error = new Error('Custom error message');
      const result = formatChatError(error, '默认消息');
      expect(result).toBe('Custom error message');
    });

    it('handles non-Error unknown values', () => {
      const result = formatChatError('string error', '默认消息');
      expect(result).toBe('默认消息');
    });
  });

  describe('isMissingSessionError', () => {
    it('returns true for 404 with session not found message', () => {
      const error = new axios.AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        data: 'Session session-1 not found'
      } as any);
      expect(isMissingSessionError(error)).toBe(true);
    });

    it('returns true for 404 with message in data object', () => {
      const error = new axios.AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        data: { message: 'Session abc not found' }
      } as any);
      expect(isMissingSessionError(error)).toBe(true);
    });

    it('returns false for 404 with unrelated message', () => {
      const error = new axios.AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        data: 'Resource not found'
      } as any);
      expect(isMissingSessionError(error)).toBe(false);
    });

    it('returns false for non-404 status', () => {
      const error = new axios.AxiosError('Server Error', '500', undefined, undefined, {
        status: 500,
        data: 'Session session-1 not found'
      } as any);
      expect(isMissingSessionError(error)).toBe(false);
    });

    it('returns false for non-axios errors', () => {
      expect(isMissingSessionError(new Error('test'))).toBe(false);
      expect(isMissingSessionError('string')).toBe(false);
      expect(isMissingSessionError(null)).toBe(false);
    });
  });

  describe('normalizeOutboundMessage', () => {
    it('converts string to OutboundChatMessage', () => {
      const result = normalizeOutboundMessage('hello');
      expect(result).toEqual({ display: 'hello', payload: 'hello' });
    });

    it('passes through OutboundChatMessage unchanged', () => {
      const input = { display: 'Hello', payload: 'hello', modelId: 'gpt-4' };
      const result = normalizeOutboundMessage(input);
      expect(result).toBe(input);
    });
  });

  describe('shouldAttemptImmediateFinalReconcile', () => {
    it('returns false for undefined checkpoint', () => {
      expect(shouldAttemptImmediateFinalReconcile(undefined)).toBe(false);
    });

    it('returns true when checkpoint has terminal status', () => {
      const checkpoint = { _derivedStatus: 'completed' } as any;
      expect(shouldAttemptImmediateFinalReconcile(checkpoint)).toBe(true);
    });

    it('returns false for non-terminal status', () => {
      const checkpoint = { _derivedStatus: 'running' } as any;
      expect(shouldAttemptImmediateFinalReconcile(checkpoint)).toBe(false);
    });
  });

  describe('createRunLoading', () => {
    it('wraps task with loading state and returns result', async () => {
      const setLoading = vi.fn();
      const setError = vi.fn();
      const handleMissingSession = vi.fn();
      const options = { setLoading, setError } as any;

      const runLoading = createRunLoading(options, handleMissingSession);
      const result = await runLoading(async () => 'success', 'Error message');

      expect(result).toBe('success');
      expect(setLoading).toHaveBeenCalledWith(true);
      expect(setLoading).toHaveBeenCalledWith(false);
      expect(setError).toHaveBeenCalledWith('');
    });

    it('handles error and sets error message', async () => {
      const setLoading = vi.fn();
      const setError = vi.fn();
      const handleMissingSession = vi.fn();
      const options = { setLoading, setError } as any;

      const runLoading = createRunLoading(options, handleMissingSession);
      const result = await runLoading(async () => {
        throw new Error('Task failed');
      }, 'Fallback error');

      expect(result).toBeUndefined();
      expect(setError).toHaveBeenCalledWith('Task failed');
    });

    it('calls handleMissingSession for 404 session errors', async () => {
      const setLoading = vi.fn();
      const setError = vi.fn();
      const handleMissingSession = vi.fn().mockResolvedValue(undefined);
      const options = { setLoading, setError } as any;

      const error = new axios.AxiosError('Not Found', '404', undefined, undefined, {
        status: 404,
        data: 'Session s1 not found'
      } as any);

      const runLoading = createRunLoading(options, handleMissingSession);
      const result = await runLoading(
        async () => {
          throw error;
        },
        'Error',
        { sessionId: 's1' }
      );

      expect(result).toBeUndefined();
      expect(handleMissingSession).toHaveBeenCalledWith('s1');
    });

    it('skips loading when withLoading is false', async () => {
      const setLoading = vi.fn();
      const setError = vi.fn();
      const options = { setLoading, setError } as any;

      const runLoading = createRunLoading(options, vi.fn());
      await runLoading(async () => 'result', 'Error', false);

      expect(setLoading).not.toHaveBeenCalled();
    });

    it('skips loading when runOptions.withLoading is false', async () => {
      const setLoading = vi.fn();
      const setError = vi.fn();
      const options = { setLoading, setError } as any;

      const runLoading = createRunLoading(options, vi.fn());
      await runLoading(async () => 'result', 'Error', { withLoading: false });

      expect(setLoading).not.toHaveBeenCalled();
    });
  });
});
