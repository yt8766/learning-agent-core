import { describe, expect, it } from 'vitest';
import { assembleAgentRuntimeContext } from '../src/runtime/agentos';
import type { ContextPage } from '@agent/core';

const page = (overrides: Partial<ContextPage>): ContextPage => ({
  id: 'ctx-default',
  kind: 'task',
  authority: 'user',
  trustLevel: 'high',
  freshness: 'current',
  scope: 'task',
  sourceRefs: [],
  tokenCost: 100,
  readonly: true,
  payload: { text: 'default' },
  ...overrides
});

describe('assembleAgentRuntimeContext', () => {
  it('loads allowed pages until token budget and explains omissions', () => {
    const result = assembleAgentRuntimeContext({
      taskId: 'task-1',
      agentId: 'coder',
      bundleId: 'bundle-1',
      createdAt: '2026-05-03T08:00:00.000Z',
      profile: {
        readableKinds: ['task', 'evidence'],
        maxContextTokens: 150
      },
      candidates: [
        page({ id: 'task-page', kind: 'task', tokenCost: 80 }),
        page({ id: 'evidence-page', kind: 'evidence', authority: 'verified', tokenCost: 60 }),
        page({ id: 'memory-page', kind: 'memory', tokenCost: 10 }),
        page({ id: 'large-page', kind: 'evidence', tokenCost: 100 })
      ]
    });

    expect(result.bundle.pages.map(entry => entry.id)).toEqual(['task-page', 'evidence-page']);
    expect(result.manifest.totalTokenCost).toBe(140);
    expect(result.manifest.omittedPages).toEqual([
      { pageId: 'memory-page', reason: 'permission_denied' },
      { pageId: 'large-page', reason: 'token_budget' }
    ]);
  });

  it('omits low-trust and stale pages before lower priority valid pages', () => {
    const result = assembleAgentRuntimeContext({
      taskId: 'task-1',
      agentId: 'researcher',
      bundleId: 'bundle-2',
      createdAt: '2026-05-03T08:00:00.000Z',
      profile: {
        readableKinds: ['knowledge', 'evidence'],
        maxContextTokens: 200
      },
      candidates: [
        page({ id: 'low-trust', kind: 'knowledge', trustLevel: 'low', tokenCost: 20 }),
        page({ id: 'stale', kind: 'evidence', freshness: 'stale', tokenCost: 20 }),
        page({ id: 'verified', kind: 'evidence', authority: 'verified', tokenCost: 50 })
      ]
    });

    expect(result.bundle.pages.map(entry => entry.id)).toEqual(['verified']);
    expect(result.manifest.omittedPages).toContainEqual({ pageId: 'low-trust', reason: 'low_trust' });
    expect(result.manifest.omittedPages).toContainEqual({ pageId: 'stale', reason: 'stale' });
  });
});
