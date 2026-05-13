import { describe, expect, it } from 'vitest';

import {
  stripOperationalBoilerplate,
  sanitizeTaskContextForModel
} from '../src/utils/prompts/runtime-output-sanitizer';

describe('runtime-output-sanitizer (direct)', () => {
  describe('stripOperationalBoilerplate', () => {
    it('removes 首辅已命中 boilerplate', () => {
      const input = '首辅已在本地技能库中命中了搜索技能。\n实际内容在这里。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('首辅已在本地技能库中命中');
      expect(result).toContain('实际内容在这里');
    });

    it('removes 收到你的任务 boilerplate', () => {
      const input = '收到你的任务，首辅正在拆解目标并准备调度六部。\n实际内容。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('收到你的任务');
      expect(result).toContain('实际内容');
    });

    it('removes JSON runId block', () => {
      const input = '{ "runId": "run-123" }\n内容。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('runId');
      expect(result).toContain('内容');
    });

    it('collapses multiple newlines', () => {
      const input = '内容1\n\n\n\n\n内容2';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('\n\n\n');
    });

    it('handles empty string', () => {
      expect(stripOperationalBoilerplate('')).toBe('');
    });

    it('normalizes CRLF to LF', () => {
      const input = '内容1\r\n内容2';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('\r');
    });
  });

  describe('sanitizeTaskContextForModel', () => {
    it('returns empty for undefined', () => {
      expect(sanitizeTaskContextForModel(undefined)).toBe('');
    });

    it('returns empty for empty string', () => {
      expect(sanitizeTaskContextForModel('')).toBe('');
    });

    it('strips boilerplate and trims', () => {
      const input = '  实际内容  ';
      const result = sanitizeTaskContextForModel(input);
      expect(result).toBe('实际内容');
    });

    it('removes /browse commands', () => {
      const input = '内容\n/browse https://example.com\n更多内容';
      const result = sanitizeTaskContextForModel(input);
      expect(result).not.toContain('/browse');
    });

    it('removes /review commands', () => {
      const input = '内容\n/review\n更多内容';
      const result = sanitizeTaskContextForModel(input);
      expect(result).not.toContain('/review');
    });
  });
});
