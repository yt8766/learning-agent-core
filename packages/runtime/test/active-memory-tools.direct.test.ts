import { describe, expect, it, vi } from 'vitest';

import {
  archivalMemorySearch,
  coreMemoryAppend,
  coreMemoryReplace,
  archivalMemorySearchByParams
} from '../src/memory/active-memory-tools';

describe('active-memory-tools (direct)', () => {
  describe('archivalMemorySearch', () => {
    it('returns undefined when no memorySearchService', async () => {
      const result = await archivalMemorySearch(undefined, {
        action: 'archival_memory_search',
        request: { query: 'test' }
      } as any);
      expect(result).toBeUndefined();
    });

    it('calls memorySearchService.search when provided', async () => {
      const mockResult = { coreMemories: [], archivalMemories: [], rules: [] };
      const mockService = { search: vi.fn().mockResolvedValue(mockResult) } as any;
      const result = await archivalMemorySearch(mockService, {
        action: 'archival_memory_search',
        request: { query: 'test' }
      } as any);
      expect(mockService.search).toHaveBeenCalledWith({ query: 'test' });
      expect(result).toBe(mockResult);
    });
  });

  describe('archivalMemorySearchByParams', () => {
    it('returns undefined when no memorySearchService', async () => {
      const result = await archivalMemorySearchByParams(undefined, { query: 'test' });
      expect(result).toBeUndefined();
    });

    it('delegates to archivalMemorySearch with built request', async () => {
      const mockResult = { coreMemories: [], archivalMemories: [], rules: [] };
      const mockService = { search: vi.fn().mockResolvedValue(mockResult) } as any;
      const result = await archivalMemorySearchByParams(mockService, { query: 'test', limit: 5 });
      expect(mockService.search).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });
  });

  describe('coreMemoryAppend', () => {
    it('appends new entry to empty list', () => {
      const result = coreMemoryAppend([], {
        entry: { kind: 'preference', scopeType: 'user', summary: 'likes dark mode' }
      } as any);
      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe('likes dark mode');
    });

    it('appends new entry to existing list', () => {
      const existing = [{ id: 'e1', kind: 'constraint', scopeType: 'user', summary: 'existing', updatedAt: '' }] as any;
      const result = coreMemoryAppend(existing, {
        entry: { kind: 'preference', scopeType: 'user', summary: 'new entry' }
      } as any);
      expect(result).toHaveLength(2);
    });

    it('replaces duplicate entry (same kind+scopeType+summary)', () => {
      const existing = [{ id: 'e1', kind: 'preference', scopeType: 'user', summary: 'same', updatedAt: '' }] as any;
      const result = coreMemoryAppend(existing, {
        entry: { kind: 'preference', scopeType: 'user', summary: 'same' }
      } as any);
      expect(result).toHaveLength(1);
    });

    it('trims to maxEntries', () => {
      const existing = Array.from({ length: 7 }, (_, i) => ({
        id: `e${i}`,
        kind: 'preference',
        scopeType: 'user',
        summary: `entry ${i}`,
        updatedAt: ''
      })) as any;
      const result = coreMemoryAppend(
        existing,
        {
          entry: { kind: 'constraint', scopeType: 'user', summary: 'new' }
        },
        { maxEntries: 5 }
      );
      expect(result).toHaveLength(5);
    });

    it('generates id with kind:scopeType:summary pattern', () => {
      const result = coreMemoryAppend(
        [],
        {
          entry: { kind: 'preference', scopeType: 'user', summary: 'test' }
        } as any,
        { now: '2026-01-01T00:00:00Z' }
      );
      expect(result[0].id).toBe('preference:user:test');
      expect(result[0].updatedAt).toBe('2026-01-01T00:00:00Z');
    });

    it('uses relatedMemoryId in id when present', () => {
      const result = coreMemoryAppend([], {
        entry: { kind: 'skill-experience', scopeType: 'task', summary: 'skill info', relatedMemoryId: 'mem-1' }
      } as any);
      expect(result[0].id).toBe('skill-experience:task:mem-1');
    });
  });

  describe('coreMemoryReplace', () => {
    it('replaces entry matching targetId', () => {
      const existing = [
        { id: 'e1', kind: 'preference', scopeType: 'user', summary: 'old', updatedAt: '' },
        { id: 'e2', kind: 'constraint', scopeType: 'user', summary: 'keep', updatedAt: '' }
      ] as any;
      const result = coreMemoryReplace(existing, {
        targetId: 'e1',
        entry: { kind: 'preference', scopeType: 'user', summary: 'new' },
        auditReason: 'update'
      } as any);
      expect(result).toHaveLength(2);
      const replaced = result.find((e: any) => e.kind === 'preference');
      expect(replaced.summary).toBe('new');
    });

    it('replaces entry matching targetKind and scopeType', () => {
      const existing = [{ id: 'e1', kind: 'preference', scopeType: 'user', summary: 'old', updatedAt: '' }] as any;
      const result = coreMemoryReplace(existing, {
        targetKind: 'preference',
        entry: { kind: 'preference', scopeType: 'user', summary: 'updated' }
      } as any);
      expect(result).toHaveLength(1);
      expect(result[0].summary).toBe('updated');
    });

    it('appends when no existing entry matches', () => {
      const existing = [{ id: 'e1', kind: 'constraint', scopeType: 'user', summary: 'other', updatedAt: '' }] as any;
      const result = coreMemoryReplace(existing, {
        targetId: 'nonexistent',
        entry: { kind: 'preference', scopeType: 'user', summary: 'new' }
      } as any);
      expect(result).toHaveLength(2);
    });

    it('uses auditReason from input.auditReason when entry has none', () => {
      const existing = [{ id: 'e1', kind: 'preference', scopeType: 'user', summary: 'old', updatedAt: '' }] as any;
      const result = coreMemoryReplace(existing, {
        targetId: 'e1',
        entry: { kind: 'preference', scopeType: 'user', summary: 'new' },
        auditReason: 'user update'
      } as any);
      expect(result[0].auditReason).toBe('user update');
    });

    it('trims to maxEntries', () => {
      const existing = Array.from({ length: 8 }, (_, i) => ({
        id: `e${i}`,
        kind: 'preference',
        scopeType: 'user',
        summary: `entry ${i}`,
        updatedAt: ''
      })) as any;
      const result = coreMemoryReplace(
        existing,
        {
          targetId: 'nonexistent',
          entry: { kind: 'constraint', scopeType: 'user', summary: 'new' }
        },
        { maxEntries: 3 }
      );
      expect(result).toHaveLength(3);
    });
  });
});
