import { describe, expect, it } from 'vitest';

import { shouldUseSessionDirectReply } from '../src/session/coordinator/session-coordinator-direct-reply';

describe('session-coordinator-direct-reply (direct)', () => {
  describe('shouldUseSessionDirectReply', () => {
    it('returns false for empty message', () => {
      expect(shouldUseSessionDirectReply('')).toBe(false);
    });

    it('returns false for whitespace-only message', () => {
      expect(shouldUseSessionDirectReply('   ')).toBe(false);
    });

    it('returns true for simple greeting', () => {
      expect(shouldUseSessionDirectReply('你好')).toBe(true);
    });

    it('returns false when requestedMode is set', () => {
      expect(shouldUseSessionDirectReply('hello', { requestedMode: 'plan' })).toBe(false);
    });

    it('returns false when imperialDirectIntent is enabled', () => {
      expect(shouldUseSessionDirectReply('hello', { imperialDirectIntent: { enabled: true } } as any)).toBe(false);
    });

    it('returns false when preferredMode is workflow', () => {
      expect(shouldUseSessionDirectReply('hello', { requestedHints: { preferredMode: 'workflow' } } as any)).toBe(
        false
      );
    });

    it('returns false when preferredMode is research-first', () => {
      expect(shouldUseSessionDirectReply('hello', { requestedHints: { preferredMode: 'research-first' } } as any)).toBe(
        false
      );
    });

    it('returns false when requestedSkill is set', () => {
      expect(shouldUseSessionDirectReply('hello', { requestedHints: { requestedSkill: 'my-skill' } } as any)).toBe(
        false
      );
    });

    it('returns false when requestedConnectorTemplate is set', () => {
      expect(
        shouldUseSessionDirectReply('hello', {
          requestedHints: { requestedConnectorTemplate: 'github-mcp-template' }
        } as any)
      ).toBe(false);
    });

    it('returns false when capabilityAttachments exist', () => {
      expect(shouldUseSessionDirectReply('hello', { capabilityAttachments: [{ id: 'a1' }] } as any)).toBe(false);
    });

    it('returns false when capabilityAugmentations exist', () => {
      expect(shouldUseSessionDirectReply('hello', { capabilityAugmentations: [{ id: 'a1' }] } as any)).toBe(false);
    });

    it('returns false for slash commands', () => {
      expect(shouldUseSessionDirectReply('/browse https://example.com')).toBe(false);
      expect(shouldUseSessionDirectReply('/review code')).toBe(false);
      expect(shouldUseSessionDirectReply('/plan make a plan')).toBe(false);
      expect(shouldUseSessionDirectReply('/exec run this')).toBe(false);
    });

    it('returns true for /direct-reply command', () => {
      expect(shouldUseSessionDirectReply('/direct-reply')).toBe(true);
    });

    it('returns false for execution request keywords (Chinese)', () => {
      expect(shouldUseSessionDirectReply('实现这个功能')).toBe(false);
      expect(shouldUseSessionDirectReply('修复这个bug')).toBe(false);
      expect(shouldUseSessionDirectReply('发布新版本')).toBe(false);
    });

    it('returns false for execution request keywords (English)', () => {
      expect(shouldUseSessionDirectReply('implement this feature')).toBe(false);
      expect(shouldUseSessionDirectReply('fix the bug')).toBe(false);
      expect(shouldUseSessionDirectReply('deploy to production')).toBe(false);
    });

    it('returns false for research request keywords (Chinese)', () => {
      expect(shouldUseSessionDirectReply('查资料一下')).toBe(false);
      expect(shouldUseSessionDirectReply('检索相关文档')).toBe(false);
    });

    it('returns true for general conversation', () => {
      expect(shouldUseSessionDirectReply('你能解释一下这个概念吗')).toBe(true);
      expect(shouldUseSessionDirectReply('what is machine learning')).toBe(true);
    });
  });
});
