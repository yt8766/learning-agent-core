import { describe, expect, it } from 'vitest';

import { normalizeMiniMaxSearchPayload } from '../../../src/runtime/intelligence';

describe('normalizeMiniMaxSearchPayload', () => {
  it('maps MiniMax CLI result-like payloads into raw event inputs', () => {
    const events = normalizeMiniMaxSearchPayload({
      queryId: 'query_1',
      fetchedAt: '2026-05-10T01:00:00.000Z',
      payload: {
        results: [
          {
            title: 'Claude Code security incident',
            url: 'https://example.com/security',
            summary: 'An incident involving source code exposure.',
            sourceName: 'Example Security',
            publishedAt: '2026-05-09T00:00:00.000Z'
          }
        ]
      }
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      queryId: 'query_1',
      title: 'Claude Code security incident',
      sourceGroup: 'unknown'
    });
    expect(events[0]?.contentHash).toHaveLength(40);
  });

  it('drops malformed results without throwing', () => {
    const events = normalizeMiniMaxSearchPayload({
      queryId: 'query_1',
      fetchedAt: '2026-05-10T01:00:00.000Z',
      payload: { results: [{ title: 'missing url' }, null, 'bad'] }
    });

    expect(events).toEqual([]);
  });

  it('keeps raw payloads JSON-safe when provider results contain non-JSON values', () => {
    const result: Record<string, unknown> = {
      title: 'Provider payload with unsupported values',
      url: 'https://example.com/json-safe',
      summary: 'A result containing values that JSON cannot represent directly.',
      tokenCount: 123n,
      callback: () => 'not json',
      missing: undefined
    };
    result.self = result;

    const events = normalizeMiniMaxSearchPayload({
      queryId: 'query_1',
      fetchedAt: '2026-05-10T01:00:00.000Z',
      payload: { results: [result] }
    });

    expect(events).toHaveLength(1);
    expect(() => JSON.stringify(events[0]?.rawPayload)).not.toThrow();
    expect(events[0]?.rawPayload).toMatchObject({ tokenCount: '123' });
    expect(JSON.stringify(events[0]?.rawPayload)).not.toContain('callback');
    expect(JSON.stringify(events[0]?.rawPayload)).not.toContain('missing');
    expect(JSON.stringify(events[0]?.rawPayload)).not.toContain('self');
  });

  it('keeps content hashes stable when provider summaries drift', () => {
    const sharedResult = {
      title: 'MiniMax model release',
      url: 'https://example.com/minimax-release',
      publishedAt: '2026-05-09T00:00:00.000Z',
      sourceName: 'Example AI'
    };

    const first = normalizeMiniMaxSearchPayload({
      queryId: 'query_1',
      fetchedAt: '2026-05-10T01:00:00.000Z',
      payload: { results: [{ ...sharedResult, summary: 'First generated summary.' }] }
    });
    const second = normalizeMiniMaxSearchPayload({
      queryId: 'query_1',
      fetchedAt: '2026-05-10T01:00:00.000Z',
      payload: { results: [{ ...sharedResult, summary: 'Different provider-generated summary.' }] }
    });

    expect(first[0]?.contentHash).toBe(second[0]?.contentHash);
    expect(first[0]?.id).toBe(second[0]?.id);
  });
});
