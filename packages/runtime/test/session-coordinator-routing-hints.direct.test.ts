import { describe, expect, it, vi } from 'vitest';

import {
  deriveRequestedHints,
  shouldDeriveSessionTitle,
  shouldGenerateSessionTitle,
  deriveSessionTitle,
  generateSessionTitleFromSummary
} from '../src/session/coordinator/session-coordinator-routing-hints';

describe('session-coordinator-routing-hints (direct)', () => {
  describe('deriveRequestedHints', () => {
    it('returns undefined for empty input', () => {
      expect(deriveRequestedHints('')).toBeUndefined();
    });

    it('returns undefined for whitespace input', () => {
      expect(deriveRequestedHints('   ')).toBeUndefined();
    });

    it('returns undefined when no hints detected', () => {
      expect(deriveRequestedHints('hello world')).toBeUndefined();
    });

    it('detects github mcp connector', () => {
      const hints = deriveRequestedHints('use github mcp connector');
      expect(hints).toBeDefined();
      expect(hints!.requestedConnectorTemplate).toBe('github-mcp-template');
    });

    it('detects browser mcp connector', () => {
      const hints = deriveRequestedHints('use browser mcp');
      expect(hints!.requestedConnectorTemplate).toBe('browser-mcp-template');
    });

    it('detects lark mcp connector', () => {
      const hints = deriveRequestedHints('use lark connector');
      expect(hints!.requestedConnectorTemplate).toBe('lark-mcp-template');
    });

    it('detects technical-architecture specialist', () => {
      const hints = deriveRequestedHints('技术架构设计');
      expect(hints!.requestedSpecialist).toBe('technical-architecture');
    });

    it('detects risk-compliance specialist', () => {
      const hints = deriveRequestedHints('风控合规审查');
      expect(hints!.requestedSpecialist).toBe('risk-compliance');
    });

    it('detects payment-channel specialist', () => {
      const hints = deriveRequestedHints('支付通道配置');
      expect(hints!.requestedSpecialist).toBe('payment-channel');
    });

    it('detects product-strategy specialist', () => {
      const hints = deriveRequestedHints('产品策略规划');
      expect(hints!.requestedSpecialist).toBe('product-strategy');
    });

    it('detects requested skill', () => {
      const hints = deriveRequestedHints('skill:my-skill-name');
      expect(hints!.requestedSkill).toBe('my-skill-name');
    });

    it('detects imperial direct with /exec', () => {
      const hints = deriveRequestedHints('/exec run this');
      expect(hints!.requestedMode).toBe('imperial_direct');
      expect(hints!.imperialDirectIntent).toBeDefined();
      expect(hints!.imperialDirectIntent!.trigger).toBe('slash-exec');
    });

    it('detects imperial direct with Chinese', () => {
      const hints = deriveRequestedHints('直接执行这个任务');
      expect(hints!.requestedMode).toBe('imperial_direct');
    });

    it('detects research-first preferred mode', () => {
      const hints = deriveRequestedHints('research this topic first');
      expect(hints!.preferredMode).toBe('research-first');
    });

    it('detects workflow preferred mode', () => {
      const hints = deriveRequestedHints('走流程');
      expect(hints!.preferredMode).toBe('workflow');
    });

    it('detects direct-reply preferred mode', () => {
      const hints = deriveRequestedHints('直接回答');
      expect(hints!.preferredMode).toBe('direct-reply');
    });

    it('detects plan mode with /plan combined with other hint', () => {
      const hints = deriveRequestedHints('/plan research this topic');
      expect(hints).toBeDefined();
      expect(hints!.requestedMode).toBe('plan');
    });

    it('returns undefined for /plan alone (no other hints)', () => {
      const hints = deriveRequestedHints('/plan make a plan');
      expect(hints).toBeUndefined();
    });

    it('sets counselorSelector strategy to manual for specialist', () => {
      const hints = deriveRequestedHints('技术架构设计');
      expect(hints!.counselorSelector.strategy).toBe('manual');
      expect(hints!.counselorSelector.candidateIds).toContain('technical-architecture');
    });

    it('sets counselorSelector strategy to task-type when no specialist', () => {
      const hints = deriveRequestedHints('skill:test');
      expect(hints!.counselorSelector.strategy).toBe('task-type');
    });
  });

  describe('shouldDeriveSessionTitle', () => {
    it('returns true for undefined', () => {
      expect(shouldDeriveSessionTitle(undefined)).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(shouldDeriveSessionTitle('')).toBe(true);
    });

    it('returns true for default title', () => {
      expect(shouldDeriveSessionTitle('新会话')).toBe(true);
    });

    it('returns true for codex-chat placeholder title', () => {
      expect(shouldDeriveSessionTitle('新对话')).toBe(true);
    });

    it('returns false for custom title', () => {
      expect(shouldDeriveSessionTitle('My Custom Title')).toBe(false);
    });
  });

  describe('shouldGenerateSessionTitle', () => {
    it('returns false when titleSource is manual', () => {
      expect(shouldGenerateSessionTitle({ title: '新会话', titleSource: 'manual' } as any)).toBe(false);
    });

    it('returns false when titleSource is generated', () => {
      expect(shouldGenerateSessionTitle({ title: '新会话', titleSource: 'generated' } as any)).toBe(false);
    });

    it('returns true when title is empty', () => {
      expect(shouldGenerateSessionTitle({ title: '' } as any)).toBe(true);
    });

    it('returns true when title is default', () => {
      expect(shouldGenerateSessionTitle({ title: '新会话' } as any)).toBe(true);
    });

    it('returns true when title is codex-chat placeholder', () => {
      expect(shouldGenerateSessionTitle({ title: '新对话', titleSource: 'placeholder' } as any)).toBe(true);
    });

    it('returns false when title is custom', () => {
      expect(shouldGenerateSessionTitle({ title: 'Custom Title' } as any)).toBe(false);
    });
  });

  describe('deriveSessionTitle', () => {
    it('returns empty for empty input', () => {
      expect(deriveSessionTitle('')).toBe('');
    });

    it('strips /browse prefix', () => {
      // The regex strips "/browse " but leaves the URL
      expect(deriveSessionTitle('/browse https://example.com some topic')).toBe('https://example.com some topic');
    });

    it('strips /review prefix', () => {
      expect(deriveSessionTitle('/review this code')).toBe('this code');
    });

    it('returns 能力介绍 for who-are-you pattern', () => {
      expect(deriveSessionTitle('你是谁，你能做什么')).toBe('能力介绍');
    });

    it('returns 能力介绍 for short who-are-you', () => {
      expect(deriveSessionTitle('你是谁')).toBe('能力介绍');
    });

    it('returns Codex 介绍 for codex question', () => {
      expect(deriveSessionTitle('codex是什么')).toBe('Codex 介绍');
    });

    it('truncates to 48 chars', () => {
      const long = 'A'.repeat(100);
      const title = deriveSessionTitle(long);
      expect(title.length).toBeLessThanOrEqual(48);
    });

    it('normalizes whitespace', () => {
      expect(deriveSessionTitle('  hello   world  ')).toBe('hello world');
    });
  });

  describe('generateSessionTitleFromSummary', () => {
    it('returns fallback title when llm not configured', async () => {
      const llm = { isConfigured: vi.fn().mockReturnValue(false), generateText: vi.fn() };
      const title = await generateSessionTitleFromSummary(llm as any, 'test message');
      expect(title).toBe('test message');
    });

    it('returns fallback title when llm is undefined', async () => {
      const title = await generateSessionTitleFromSummary(undefined, 'test message');
      expect(title).toBe('test message');
    });

    it('returns fallback for empty message', async () => {
      const llm = { isConfigured: vi.fn().mockReturnValue(true), generateText: vi.fn() };
      const title = await generateSessionTitleFromSummary(llm as any, '');
      expect(title).toBe('');
    });

    it('uses llm to generate title when configured', async () => {
      const llm = {
        isConfigured: vi.fn().mockReturnValue(true),
        generateText: vi.fn().mockResolvedValue('Generated Title')
      };
      const title = await generateSessionTitleFromSummary(llm as any, 'test message about coding');
      expect(llm.generateText).toHaveBeenCalled();
      expect(title).toBe('Generated Title');
    });

    it('falls back to deriveSessionTitle when llm throws', async () => {
      const llm = {
        isConfigured: vi.fn().mockReturnValue(true),
        generateText: vi.fn().mockRejectedValue(new Error('LLM error'))
      };
      const title = await generateSessionTitleFromSummary(llm as any, 'test message');
      expect(title).toBe('test message');
    });

    it('sanitizes generated title by removing quotes', async () => {
      const llm = {
        isConfigured: vi.fn().mockReturnValue(true),
        generateText: vi.fn().mockResolvedValue('"Generated Title"')
      };
      const title = await generateSessionTitleFromSummary(llm as any, 'test message');
      expect(title).toBe('Generated Title');
    });

    it('rejects instruction-leak titles', async () => {
      const llm = {
        isConfigured: vi.fn().mockReturnValue(true),
        generateText: vi.fn().mockResolvedValue('用户要求生成一个会话标题')
      };
      const title = await generateSessionTitleFromSummary(llm as any, 'test message');
      expect(title).toBe('test message');
    });
  });
});
