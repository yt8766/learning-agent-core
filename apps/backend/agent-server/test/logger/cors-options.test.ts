import { describe, expect, it } from 'vitest';

import { createCorsOptions, isAllowedCorsOrigin } from '../../src/cors/cors-options';

describe('cors-options', () => {
  it('allows localhost development origins and configured admin origin', () => {
    expect(isAllowedCorsOrigin(undefined)).toBe(true);
    expect(isAllowedCorsOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedCorsOrigin('https://127.0.0.1:5174')).toBe(true);
    expect(isAllowedCorsOrigin('https://admin-local.gosh0.com')).toBe(true);
  });

  it('rejects unrelated origins', () => {
    expect(isAllowedCorsOrigin('https://example.com')).toBe(false);
    expect(isAllowedCorsOrigin('notaurl')).toBe(false);
  });

  it('builds cors options with authorization header and credentials enabled', () => {
    const options = createCorsOptions();

    expect(options.credentials).toBe(true);
    expect(options.allowedHeaders).toEqual(['Content-Type', 'Authorization']);
    expect(options.methods).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
    expect(options.exposedHeaders).toEqual(['set-cookie']);
  });
});
