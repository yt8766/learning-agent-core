import { describe, expect, it } from 'vitest';

import {
  createHeuristicConversationSummary,
  formatCompressionSummaryText,
  normalizeMessageSnippet,
  parseStructuredCompressionSummary,
  truncateSummary
} from '../src/session/session-compression-helpers';

describe('session-compression-helpers', () => {
  describe('normalizeMessageSnippet', () => {
    it('collapses whitespace and trims', () => {
      expect(normalizeMessageSnippet('  hello   world  ')).toBe('hello world');
    });

    it('truncates at 120 characters with ellipsis', () => {
      const long = 'a'.repeat(200);
      const result = normalizeMessageSnippet(long);
      expect(result).toHaveLength(123); // 120 + '...'
      expect(result).toBe('a'.repeat(120) + '...');
    });

    it('does not truncate short strings', () => {
      expect(normalizeMessageSnippet('short text')).toBe('short text');
    });

    it('handles empty string', () => {
      expect(normalizeMessageSnippet('')).toBe('');
    });
  });

  describe('truncateSummary', () => {
    it('returns the original string when under the limit', () => {
      expect(truncateSummary('short', 100)).toBe('short');
    });

    it('truncates at maxSummaryChars and appends ellipsis', () => {
      const result = truncateSummary('abcdef', 3);
      expect(result).toBe('abc...');
    });

    it('uses default max when not specified', () => {
      const longText = 'x'.repeat(2000);
      const result = truncateSummary(longText);
      expect(result.length).toBeLessThanOrEqual(1203); // 1200 + '...'
    });
  });

  describe('formatCompressionSummaryText', () => {
    it('formats non-empty sections with labels', () => {
      const result = formatCompressionSummaryText(
        {
          periodOrTopic: 'Q2 planning',
          focuses: ['focus A', 'focus B'],
          keyDeliverables: ['deliverable 1'],
          risks: ['risk 1'],
          nextActions: ['action 1'],
          decisionSummary: 'decided X',
          confirmedPreferences: ['pref A'],
          openLoops: ['loop 1'],
          supportingFacts: ['fact 1']
        },
        2000
      );

      expect(result).toContain('主题：Q2 planning');
      expect(result).toContain('一级重点：focus A；focus B');
      expect(result).toContain('关键交付：deliverable 1');
      expect(result).toContain('风险与缺口：risk 1');
      expect(result).toContain('后续动作：action 1');
      expect(result).toContain('已确认决策：decided X');
      expect(result).toContain('用户偏好 / 约束：pref A');
      expect(result).toContain('未完成事项：loop 1');
      expect(result).toContain('补充事实：fact 1');
    });

    it('omits sections that are empty or undefined', () => {
      const result = formatCompressionSummaryText({}, 2000);
      expect(result).toBe('');
    });

    it('truncates when combined output exceeds maxSummaryChars', () => {
      const bigFocuses = Array.from({ length: 50 }, (_, i) => `focus-${i}-${'x'.repeat(50)}`);
      const result = formatCompressionSummaryText({ focuses: bigFocuses }, 200);
      expect(result.length).toBeLessThanOrEqual(203); // 200 + '...'
    });
  });

  describe('parseStructuredCompressionSummary', () => {
    it('parses valid JSON with all fields', () => {
      const json = JSON.stringify({
        period_or_topic: '2026/5/1 - 2026/5/7',
        primary_focuses: ['focus A', 'focus B'],
        key_deliverables: ['deliverable 1'],
        risks_and_gaps: ['risk 1'],
        next_actions: ['action 1'],
        raw_supporting_points: ['fact 1'],
        decision_summary: 'decided X',
        confirmed_preferences: ['pref A'],
        open_loops: ['loop 1'],
        summary: 'Full summary text'
      });

      const result = parseStructuredCompressionSummary(json, 2000);
      expect(result).toBeDefined();
      expect(result!.periodOrTopic).toBe('2026/5/1 - 2026/5/7');
      expect(result!.focuses).toEqual(['focus A', 'focus B']);
      expect(result!.keyDeliverables).toEqual(['deliverable 1']);
      expect(result!.risks).toEqual(['risk 1']);
      expect(result!.nextActions).toEqual(['action 1']);
      expect(result!.supportingFacts).toEqual(['fact 1']);
      expect(result!.decisionSummary).toBe('decided X');
      expect(result!.confirmedPreferences).toEqual(['pref A']);
      expect(result!.openLoops).toEqual(['loop 1']);
      expect(result!.summary).toBe('Full summary text');
    });

    it('normalizes arrays by filtering non-string items and trimming', () => {
      const json = JSON.stringify({
        primary_focuses: ['  trimmed  ', 123, '', null, 'valid'],
        summary: 'ok'
      });

      const result = parseStructuredCompressionSummary(json, 2000);
      expect(result).toBeDefined();
      expect(result!.focuses).toEqual(['trimmed', 'valid']);
    });

    it('returns undefined for malformed JSON', () => {
      expect(parseStructuredCompressionSummary('not json at all', 2000)).toBeUndefined();
    });

    it('returns undefined when JSON has no recognizable structure', () => {
      expect(parseStructuredCompressionSummary('{"foo": "bar"}', 2000)).toBeUndefined();
    });

    it('handles JSON inside code fences', () => {
      const content = '```json\n{"summary": "code fenced summary"}\n```';
      const result = parseStructuredCompressionSummary(content, 2000);
      expect(result).toBeDefined();
      expect(result!.summary).toBe('code fenced summary');
    });

    it('returns undefined when no summary can be generated', () => {
      const json = JSON.stringify({ random_field: true });
      const result = parseStructuredCompressionSummary(json, 2000);
      expect(result).toBeUndefined();
    });

    it('caps arrays at specified max items', () => {
      const json = JSON.stringify({
        primary_focuses: Array.from({ length: 20 }, (_, i) => `item-${i}`),
        summary: 'ok'
      });

      const result = parseStructuredCompressionSummary(json, 2000);
      expect(result!.focuses).toHaveLength(5);
    });

    it('truncates summary when it exceeds maxSummaryChars', () => {
      const json = JSON.stringify({
        summary: 'x'.repeat(2000)
      });

      const result = parseStructuredCompressionSummary(json, 100);
      expect(result!.summary.length).toBeLessThanOrEqual(103); // 100 + '...'
    });
  });

  describe('createHeuristicConversationSummary', () => {
    const makeMessages = (entries: Array<{ role: 'user' | 'assistant'; content: string }>) =>
      entries.map((entry, index) => ({
        id: `msg-${index}`,
        role: entry.role,
        content: entry.content,
        createdAt: new Date().toISOString(),
        sessionId: 'session-1'
      })) as never[];

    it('extracts focuses from numbered list items', () => {
      const messages = makeMessages([
        { role: 'user', content: '1. Implement feature A\n2. Fix bug B\n3. Review PR C' }
      ]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.source).toBe('heuristic');
      expect(result.focuses.length).toBeGreaterThan(0);
      expect(result.focuses.some(f => f.includes('Implement feature A'))).toBe(true);
    });

    it('falls back to user message snippets when no numbered items found', () => {
      const messages = makeMessages([
        { role: 'user', content: 'Please help me with this task' },
        { role: 'assistant', content: 'I will help you' }
      ]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.focuses.length).toBeGreaterThan(0);
      expect(result.source).toBe('heuristic');
    });

    it('detects period or topic from date ranges', () => {
      const messages = makeMessages([{ role: 'user', content: '5/1 - 5/7 weekly review' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.periodOrTopic).toMatch(/5\/1\s*-\s*5\/7/);
    });

    it('detects period or topic from title lines', () => {
      const messages = makeMessages([{ role: 'user', content: '周报 review content' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.periodOrTopic).toBeDefined();
    });

    it('extracts key deliverables with Chinese keywords', () => {
      const messages = makeMessages([{ role: 'user', content: '本次交付完成了新的渠道对接' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.keyDeliverables.length).toBeGreaterThan(0);
    });

    it('extracts risks with Chinese keywords', () => {
      const messages = makeMessages([{ role: 'user', content: '存在风险：数据不一致可能导致亏损' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.risks.length).toBeGreaterThan(0);
    });

    it('extracts next actions with Chinese keywords', () => {
      const messages = makeMessages([{ role: 'user', content: '继续推进优化工作，修复已知问题' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.nextActions.length).toBeGreaterThan(0);
    });

    it('extracts decision summary', () => {
      const messages = makeMessages([{ role: 'user', content: '确认采用新方案，统一为 A 策略' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.decisionSummary).toBeTruthy();
    });

    it('extracts open loops', () => {
      const messages = makeMessages([{ role: 'user', content: '待定：下一步需要确认 API 设计' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.openLoops.length).toBeGreaterThan(0);
    });

    it('extracts confirmed preferences', () => {
      const messages = makeMessages([{ role: 'user', content: '希望优先使用 TypeScript，不要用 JavaScript' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.confirmedPreferences.length).toBeGreaterThan(0);
    });

    it('strips markdown headings from content', () => {
      const messages = makeMessages([{ role: 'user', content: '# Heading 1\n## Heading 2\nActual content here' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      // headings should be filtered out
      expect(result.supportingFacts.some(f => f.includes('#'))).toBe(false);
    });

    it('respects maxSummaryChars in output', () => {
      const messages = makeMessages([{ role: 'user', content: 'x'.repeat(5000) }]);

      const result = createHeuristicConversationSummary(messages, 100);
      expect(result.summary.length).toBeLessThanOrEqual(103); // 100 + '...'
    });

    it('deduplicates repeated items', () => {
      const messages = makeMessages([{ role: 'user', content: '1. Same item\n1. Same item\n1. Same item' }]);

      const result = createHeuristicConversationSummary(messages, 2000);
      const normalizedFocuses = result.focuses.filter(f => f.includes('Same item'));
      expect(normalizedFocuses).toHaveLength(1);
    });

    it('returns source as heuristic', () => {
      const messages = makeMessages([{ role: 'user', content: 'test' }]);
      const result = createHeuristicConversationSummary(messages, 2000);
      expect(result.source).toBe('heuristic');
    });
  });
});
