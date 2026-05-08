import { describe, expect, it } from 'vitest';

import { AuthTokenVerifier } from '../../src/auth/auth-token-verifier';

describe('AuthTokenVerifier', () => {
  it('verifies auth-server JWT payloads', () => {
    const verifier = new AuthTokenVerifier({ secret: 'test-secret', issuer: 'auth-server', audience: 'knowledge' });
    const token = verifier.signForTest({
      sub: 'user_1',
      username: 'alice',
      roles: ['knowledge_user'],
      status: 'enabled',
      aud: ['knowledge'],
      exp: Math.floor(Date.now() / 1000) + 60
    });

    expect(verifier.verify(token)).toMatchObject({ userId: 'user_1', username: 'alice' });
  });
});
