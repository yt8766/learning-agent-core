import { describe, expect, it } from 'vitest';

import { resolveAuthCorsOrigins } from '../../src/config/auth-cors.config';

describe('resolveAuthCorsOrigins', () => {
  it('keeps configured origins and adds local frontend dev origins outside production', () => {
    const origins = resolveAuthCorsOrigins({
      nodeEnv: 'development',
      corsOrigins: 'http://127.0.0.1:5173,http://localhost:5174'
    });

    expect(origins).toEqual(
      expect.arrayContaining([
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://localhost:5173',
        'http://127.0.0.1:5174',
        'http://localhost:5175',
        'http://127.0.0.1:5175'
      ])
    );
    expect(origins).toHaveLength(6);
  });

  it('deduplicates configured origins against local frontend dev origins', () => {
    expect(
      resolveAuthCorsOrigins({
        nodeEnv: 'development',
        corsOrigins: 'http://127.0.0.1:5175,http://localhost:5175'
      })
    ).toEqual([
      'http://127.0.0.1:5175',
      'http://localhost:5175',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:5174',
      'http://localhost:5174'
    ]);
  });

  it('uses only configured origins in production', () => {
    expect(
      resolveAuthCorsOrigins({
        nodeEnv: 'production',
        corsOrigins: 'https://admin.example.com, https://knowledge.example.com'
      })
    ).toEqual(['https://admin.example.com', 'https://knowledge.example.com']);
  });
});
