import { describe, expect, it } from 'vitest';

import { mergeSystemMessages } from '../src/utils/system-messages';

describe('system-messages (direct)', () => {
  describe('mergeSystemMessages', () => {
    it('returns messages unchanged when no system messages', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ];
      expect(mergeSystemMessages(messages)).toEqual(messages);
    });

    it('returns messages unchanged when only one system message', () => {
      const messages = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'Hello' }
      ];
      expect(mergeSystemMessages(messages)).toEqual(messages);
    });

    it('merges multiple system messages into one', () => {
      const messages = [
        { role: 'system', content: 'First system' },
        { role: 'user', content: 'Hello' },
        { role: 'system', content: 'Second system' }
      ];
      const result = mergeSystemMessages(messages);
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('First system\n\nSecond system');
      expect(result[1].role).toBe('user');
    });

    it('preserves non-system messages in order', () => {
      const messages = [
        { role: 'system', content: 'S1' },
        { role: 'user', content: 'U1' },
        { role: 'system', content: 'S2' },
        { role: 'assistant', content: 'A1' },
        { role: 'system', content: 'S3' }
      ];
      const result = mergeSystemMessages(messages);
      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('system');
      expect(result[0].content).toBe('S1\n\nS2\n\nS3');
      expect(result[1].role).toBe('user');
      expect(result[2].role).toBe('assistant');
    });

    it('uses first system message as template', () => {
      const messages = [
        { role: 'system', content: 'S1', extra: 'first' } as any,
        { role: 'user', content: 'U1' },
        { role: 'system', content: 'S2' }
      ];
      const result = mergeSystemMessages(messages);
      expect(result[0].extra).toBe('first');
    });

    it('handles empty messages array', () => {
      expect(mergeSystemMessages([])).toEqual([]);
    });

    it('handles three consecutive system messages', () => {
      const messages = [
        { role: 'system', content: 'A' },
        { role: 'system', content: 'B' },
        { role: 'system', content: 'C' }
      ];
      const result = mergeSystemMessages(messages);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('A\n\nB\n\nC');
    });
  });
});
