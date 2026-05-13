import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock, patchMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  patchMock: vi.fn()
}));

vi.mock('@/utils/http-client', () => ({
  http: {
    post: postMock,
    patch: patchMock
  },
  API_BASE: '/api',
  toApiUrl: (path: string) => `/api${path}`
}));

import { overrideChatMemory, patchChatProfile, recordChatMemoryFeedback } from '@/api/chat-memory-api';

describe('chat-memory-api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    postMock.mockReset();
    patchMock.mockReset();
  });

  describe('recordChatMemoryFeedback', () => {
    it('posts feedback with encoded memory ID', async () => {
      postMock.mockResolvedValueOnce({ data: { ok: true } });

      const result = await recordChatMemoryFeedback('mem/with:special+chars', 'adopted');

      expect(postMock).toHaveBeenCalledWith('/memory/mem%2Fwith%3Aspecial%2Bchars/feedback', {
        kind: 'adopted'
      });
      expect(result).toEqual({ ok: true });
    });

    it('sends dismissed feedback kind', async () => {
      postMock.mockResolvedValueOnce({ data: { ok: true } });

      await recordChatMemoryFeedback('mem-1', 'dismissed');

      expect(postMock).toHaveBeenCalledWith('/memory/mem-1/feedback', { kind: 'dismissed' });
    });

    it('sends corrected feedback kind', async () => {
      postMock.mockResolvedValueOnce({ data: { ok: true } });

      await recordChatMemoryFeedback('mem-2', 'corrected');

      expect(postMock).toHaveBeenCalledWith('/memory/mem-2/feedback', { kind: 'corrected' });
    });
  });

  describe('overrideChatMemory', () => {
    it('posts override with default actor when none provided', async () => {
      postMock.mockResolvedValueOnce({ data: { ok: true } });

      const result = await overrideChatMemory('mem-1', {
        summary: 'new summary',
        content: 'new content',
        reason: 'correction'
      });

      expect(postMock).toHaveBeenCalledWith('/memory/mem-1/override', {
        summary: 'new summary',
        content: 'new content',
        reason: 'correction',
        actor: 'agent-chat-user'
      });
      expect(result).toEqual({ ok: true });
    });

    it('preserves explicit actor when provided', async () => {
      postMock.mockResolvedValueOnce({ data: { ok: true } });

      await overrideChatMemory('mem-2', {
        summary: 'updated',
        content: 'updated',
        reason: 'fix',
        actor: 'custom-actor'
      });

      expect(postMock).toHaveBeenCalledWith('/memory/mem-2/override', {
        summary: 'updated',
        content: 'updated',
        reason: 'fix',
        actor: 'custom-actor'
      });
    });

    it('encodes memory ID in URL path', async () => {
      postMock.mockResolvedValueOnce({ data: { ok: true } });

      await overrideChatMemory('a/b', {
        summary: 's',
        content: 'c',
        reason: 'r'
      });

      expect(postMock).toHaveBeenCalledWith('/memory/a%2Fb/override', expect.any(Object));
    });

    it('passes optional fields when provided', async () => {
      postMock.mockResolvedValueOnce({ data: { ok: true } });

      await overrideChatMemory('mem-3', {
        summary: 's',
        content: 'c',
        reason: 'r',
        tags: ['workspace:a', 'project:b'],
        memoryType: 'constraint',
        scopeType: 'session'
      });

      expect(postMock).toHaveBeenCalledWith('/memory/mem-3/override', {
        summary: 's',
        content: 'c',
        reason: 'r',
        tags: ['workspace:a', 'project:b'],
        memoryType: 'constraint',
        scopeType: 'session',
        actor: 'agent-chat-user'
      });
    });
  });

  describe('patchChatProfile', () => {
    it('patches profile with default actor when none provided', async () => {
      patchMock.mockResolvedValueOnce({ data: { ok: true } });

      const result = await patchChatProfile('user-1', {
        communicationStyle: 'concise'
      });

      expect(patchMock).toHaveBeenCalledWith('/profiles/user-1', {
        communicationStyle: 'concise',
        actor: 'agent-chat-user'
      });
      expect(result).toEqual({ ok: true });
    });

    it('preserves explicit actor when provided', async () => {
      patchMock.mockResolvedValueOnce({ data: { ok: true } });

      await patchChatProfile('user-2', {
        communicationStyle: 'detailed',
        actor: 'admin-user'
      });

      expect(patchMock).toHaveBeenCalledWith('/profiles/user-2', {
        communicationStyle: 'detailed',
        actor: 'admin-user'
      });
    });

    it('encodes user ID in URL path', async () => {
      patchMock.mockResolvedValueOnce({ data: { ok: true } });

      await patchChatProfile('user/with/slashes', {
        executionStyle: 'careful'
      });

      expect(patchMock).toHaveBeenCalledWith('/profiles/user%2Fwith%2Fslashes', expect.any(Object));
    });
  });
});
