import { describe, expect, it } from 'vitest';

import {
  stripOperationalBoilerplate,
  sanitizeTaskContextForModel
} from '../src/utils/prompts/runtime-output-sanitizer';

describe('runtime-output-sanitizer', () => {
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

    it('removes 本轮已切换 boilerplate', () => {
      const input = '本轮已切换到研究流程。\n内容。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('本轮已切换');
    });

    it('removes 户部战报 boilerplate', () => {
      const input = '户部战报：找到了3条相关记录。\n内容。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('户部战报');
    });

    it('removes 已分派给 boilerplate', () => {
      const input = '已分派给 executor-worker。\n内容。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('已分派给');
    });

    it('removes 原始记录 boilerplate', () => {
      const input = '原始记录：这是原始记录。\n内容。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('原始记录');
    });

    it('removes JSON runId block', () => {
      const input = '{ "runId": "run-123" }\n内容。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('runId');
      expect(result).toContain('内容');
    });

    it('removes inline 已分派给 research prefix', () => {
      const input = '\n已分派给 research：/hubu-search\n内容。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('已分派给 research');
    });

    it('removes inline 户部已开始 prefix', () => {
      const input = '\n户部已开始检索资料与上下文。\n内容。';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('户部已开始');
    });

    it('collapses multiple newlines', () => {
      const input = '内容1\n\n\n\n\n内容2';
      const result = stripOperationalBoilerplate(input);
      expect(result).not.toContain('\n\n\n');
    });

    it('handles empty string', () => {
      expect(stripOperationalBoilerplate('')).toBe('');
    });

    it('handles content with no boilerplate', () => {
      const input = '纯内容，没有运营样板。';
      const result = stripOperationalBoilerplate(input);
      expect(result).toBe(input);
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

    it('returns empty for whitespace only', () => {
      expect(sanitizeTaskContextForModel('   ')).toBe('');
    });

    it('strips boilerplate from content', () => {
      const input = '首辅已在本地技能库中命中了搜索技能。\n实际内容。';
      const result = sanitizeTaskContextForModel(input);
      expect(result).not.toContain('首辅已在本地技能库中命中');
      expect(result).toContain('实际内容');
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

    it('collapses multiple newlines after stripping', () => {
      const input = '内容1\n\n\n\n内容2';
      const result = sanitizeTaskContextForModel(input);
      expect(result).not.toContain('\n\n\n');
    });

    it('trims result', () => {
      const input = '  实际内容  ';
      const result = sanitizeTaskContextForModel(input);
      expect(result).toBe('实际内容');
    });
  });
});
