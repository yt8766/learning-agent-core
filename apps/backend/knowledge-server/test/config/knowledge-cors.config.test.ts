import { describe, expect, it } from 'vitest';

import { resolveKnowledgeCorsOrigins } from '../../src/config/knowledge-cors.config';

describe('resolveKnowledgeCorsOrigins', () => {
  it('keeps configured origins and adds the local knowledge frontend origin outside production', () => {
    const origins = resolveKnowledgeCorsOrigins({
      nodeEnv: 'development',
      corsOrigins: 'http://127.0.0.1:5174'
    });

    expect(origins).toEqual(
      expect.arrayContaining(['http://127.0.0.1:5174', 'http://localhost:5175', 'http://127.0.0.1:5175'])
    );
    expect(origins).toHaveLength(3);
  });

  it('uses only configured origins in production', () => {
    expect(
      resolveKnowledgeCorsOrigins({
        nodeEnv: 'production',
        corsOrigins: 'https://knowledge.example.com'
      })
    ).toEqual(['https://knowledge.example.com']);
  });
});
