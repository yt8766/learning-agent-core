import { describe, expect, it, vi } from 'vitest';

import {
  buildRuntimeMemorySearchRequest,
  searchRuntimeMemories,
  flattenStructuredMemories,
  limitStructuredRules
} from '../src/memory/runtime-memory-search';

describe('runtime-memory-search (direct)', () => {
  describe('buildRuntimeMemorySearchRequest', () => {
    it('builds basic request with query', () => {
      const request = buildRuntimeMemorySearchRequest({ query: 'test query' });
      expect(request.query).toBe('test query');
      expect(request.scopeContext).toBeDefined();
    });

    it('sets limit', () => {
      const request = buildRuntimeMemorySearchRequest({ query: 'q', limit: 10 });
      expect(request.limit).toBe(10);
    });

    it('sets actorRole', () => {
      const request = buildRuntimeMemorySearchRequest({ query: 'q', actorRole: 'agent-chat-user' });
      expect(request.scopeContext.actorRole).toBe('agent-chat-user');
    });

    it('sets scopeType and allowedScopeTypes', () => {
      const request = buildRuntimeMemorySearchRequest({
        query: 'q',
        scopeType: 'session',
        allowedScopeTypes: ['session', 'user']
      });
      expect(request.scopeContext.scopeType).toBe('session');
      expect(request.scopeContext.allowedScopeTypes).toEqual(['session', 'user']);
    });

    it('adds userId to entityContext', () => {
      const request = buildRuntimeMemorySearchRequest({ query: 'q', userId: 'user-1' });
      expect(request.entityContext).toContainEqual({ entityType: 'user', entityId: 'user-1' });
    });

    it('adds workspaceId to entityContext', () => {
      const request = buildRuntimeMemorySearchRequest({ query: 'q', workspaceId: 'ws-1' });
      expect(request.entityContext).toContainEqual({ entityType: 'workspace', entityId: 'ws-1' });
    });

    it('adds taskId as project entity', () => {
      const request = buildRuntimeMemorySearchRequest({ query: 'q', taskId: 'task-1' });
      expect(request.entityContext).toContainEqual({ entityType: 'project', entityId: 'task-1' });
    });

    it('sets memoryTypes', () => {
      const request = buildRuntimeMemorySearchRequest({
        query: 'q',
        memoryTypes: ['preference', 'constraint']
      });
      expect(request.memoryTypes).toEqual(['preference', 'constraint']);
    });

    it('sets includeRules and includeReflections', () => {
      const request = buildRuntimeMemorySearchRequest({
        query: 'q',
        includeRules: true,
        includeReflections: true
      });
      expect(request.includeRules).toBe(true);
      expect(request.includeReflections).toBe(true);
    });

    it('deduplicates entityContext entries', () => {
      const request = buildRuntimeMemorySearchRequest({
        query: 'q',
        userId: 'user-1',
        entityContext: [{ entityType: 'user', entityId: 'user-1' }]
      });
      const userEntities = request.entityContext?.filter(e => e.entityType === 'user' && e.entityId === 'user-1');
      expect(userEntities).toHaveLength(1);
    });

    it('sets scopeContext ids', () => {
      const request = buildRuntimeMemorySearchRequest({
        query: 'q',
        userId: 'u1',
        workspaceId: 'ws1',
        teamId: 't1',
        orgId: 'o1'
      });
      expect(request.scopeContext.userId).toBe('u1');
      expect(request.scopeContext.workspaceId).toBe('ws1');
      expect(request.scopeContext.teamId).toBe('t1');
      expect(request.scopeContext.orgId).toBe('o1');
    });
  });

  describe('searchRuntimeMemories', () => {
    it('returns undefined when no memorySearchService', async () => {
      const result = await searchRuntimeMemories(undefined, { query: 'test' });
      expect(result).toBeUndefined();
    });

    it('calls memorySearchService.search when provided', async () => {
      const mockResult = { coreMemories: [], archivalMemories: [], rules: [] } as any;
      const mockService = { search: vi.fn().mockResolvedValue(mockResult) } as any;
      const result = await searchRuntimeMemories(mockService, { query: 'test' });
      expect(mockService.search).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });
  });

  describe('flattenStructuredMemories', () => {
    it('returns empty array for undefined result', () => {
      expect(flattenStructuredMemories(undefined)).toEqual([]);
    });

    it('combines core and archival memories', () => {
      const result = {
        coreMemories: [{ id: 'c1', summary: 'core' }],
        archivalMemories: [{ id: 'a1', summary: 'archival' }],
        rules: []
      } as any;
      const flat = flattenStructuredMemories(result);
      expect(flat).toHaveLength(2);
    });

    it('deduplicates by id', () => {
      const result = {
        coreMemories: [{ id: 'same', summary: 'core' }],
        archivalMemories: [{ id: 'same', summary: 'archival' }],
        rules: []
      } as any;
      const flat = flattenStructuredMemories(result);
      expect(flat).toHaveLength(1);
      expect(flat[0].summary).toBe('core');
    });
  });

  describe('limitStructuredRules', () => {
    it('returns empty array for undefined result', () => {
      expect(limitStructuredRules(undefined, 5)).toEqual([]);
    });

    it('limits rules to specified count', () => {
      const result = {
        coreMemories: [],
        archivalMemories: [],
        rules: [
          { id: 'r1', summary: 'rule 1' },
          { id: 'r2', summary: 'rule 2' },
          { id: 'r3', summary: 'rule 3' }
        ]
      } as any;
      const limited = limitStructuredRules(result, 2);
      expect(limited).toHaveLength(2);
    });

    it('deduplicates rules by id', () => {
      const result = {
        coreMemories: [],
        archivalMemories: [],
        rules: [
          { id: 'r1', summary: 'rule 1' },
          { id: 'r1', summary: 'rule 1 dup' },
          { id: 'r2', summary: 'rule 2' }
        ]
      } as any;
      const limited = limitStructuredRules(result, 10);
      expect(limited).toHaveLength(2);
    });
  });
});
