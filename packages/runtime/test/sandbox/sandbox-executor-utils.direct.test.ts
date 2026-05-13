import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

import { toWorkspacePath, tokenize, scoreMatch } from '../../src/sandbox/sandbox-executor-utils';

describe('sandbox-executor-utils (direct)', () => {
  describe('toWorkspacePath', () => {
    it('resolves relative path within workspace', () => {
      const result = toWorkspacePath('src/index.ts');
      expect(result).toContain('src');
      expect(result).toContain('index.ts');
    });

    it('resolves to package.json when empty string', () => {
      const result = toWorkspacePath('');
      expect(result).toContain('package.json');
    });

    it('resolves to package.json when non-string', () => {
      const result = toWorkspacePath(undefined);
      expect(result).toContain('package.json');
    });

    it('throws for path traversal', () => {
      expect(() => toWorkspacePath('../../../etc/passwd')).toThrow('Access outside the workspace');
    });

    it('throws for path with .. segment', () => {
      expect(() => toWorkspacePath('src/../../etc')).toThrow('Access outside the workspace');
    });

    it('resolves absolute path within workspace', () => {
      const workspaceRoot = process.cwd();
      const result = toWorkspacePath(resolve(workspaceRoot, 'src'));
      expect(result).toContain('src');
    });
  });

  describe('tokenize', () => {
    it('tokenizes text into lowercase tokens', () => {
      const result = tokenize('Hello World Test');
      expect(result).toContain('hello');
      expect(result).toContain('world');
      expect(result).toContain('test');
    });

    it('removes duplicates', () => {
      const result = tokenize('hello hello world');
      expect(result.filter(t => t === 'hello')).toHaveLength(1);
    });

    it('filters tokens shorter than 2 chars', () => {
      const result = tokenize('a bb ccc');
      expect(result).not.toContain('a');
      expect(result).toContain('bb');
      expect(result).toContain('ccc');
    });

    it('handles empty string', () => {
      expect(tokenize('')).toEqual([]);
    });

    it('handles special characters', () => {
      const result = tokenize('hello-world test_case');
      expect(result).toContain('hello-world');
      expect(result).toContain('test_case');
    });

    it('handles unicode characters', () => {
      const result = tokenize('你好世界 test');
      expect(result).toContain('你好世界');
      expect(result).toContain('test');
    });
  });

  describe('scoreMatch', () => {
    it('returns 1 for exact match', () => {
      expect(scoreMatch('hello world', 'hello world')).toBe(1);
    });

    it('returns partial score for partial match', () => {
      const score = scoreMatch('hello world test', 'hello world');
      expect(score).toBeCloseTo(2 / 3, 2);
    });

    it('returns 0 for no match', () => {
      expect(scoreMatch('hello', 'world')).toBe(0);
    });

    it('returns 0 for empty goal', () => {
      expect(scoreMatch('', 'hello world')).toBe(0);
    });

    it('returns 0 for empty text', () => {
      expect(scoreMatch('hello', '')).toBe(0);
    });

    it('is case insensitive', () => {
      expect(scoreMatch('HELLO', 'hello')).toBe(1);
    });

    it('handles partial token overlap', () => {
      const score = scoreMatch('code generation tool', 'code generation');
      expect(score).toBeCloseTo(2 / 3, 2);
    });
  });
});
