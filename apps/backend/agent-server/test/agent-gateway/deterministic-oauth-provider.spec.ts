import { describe, expect, it } from 'vitest';

import {
  DeterministicGatewayOAuthProvider,
  flowIdFor
} from '../../src/domains/agent-gateway/runtime-engine/oauth/deterministic-oauth-provider';

const now = new Date('2026-05-11T00:00:00.000Z');

function createProvider(overrides: Record<string, unknown> = {}) {
  return new DeterministicGatewayOAuthProvider({
    providerId: 'codex',
    scopes: ['repo', 'read:org'],
    now: () => now,
    ...overrides
  });
}

describe('DeterministicGatewayOAuthProvider', () => {
  describe('start', () => {
    it('returns flowId, verificationUri, userCode, and expiresAt', () => {
      const provider = createProvider();
      const result = provider.start({ providerId: 'codex', credentialFileId: 'cred-1' });

      expect(result.flowId).toBe('oauth-codex-cred-1');
      expect(result.providerId).toBe('codex');
      expect(result.credentialFileId).toBe('cred-1');
      expect(result.verificationUri).toContain('state=oauth-codex-cred-1');
      expect(result.userCode).toBe('CODE-codex-cred-1');
      expect(result.expiresAt).toBeTruthy();
    });

    it('uses deviceVerificationUri when provided', () => {
      const provider = createProvider({ deviceVerificationUri: 'https://custom.verify' });
      const result = provider.start({ providerId: 'codex', credentialFileId: 'cred-1' });

      expect(result.verificationUri).toBe('https://custom.verify');
    });

    it('uses custom authorizationBaseUrl', () => {
      const provider = createProvider({ authorizationBaseUrl: 'https://custom.auth/authorize' });
      const result = provider.start({ providerId: 'codex', credentialFileId: 'cred-1' });

      expect(result.verificationUri).toContain('https://custom.auth/authorize');
    });

    it('uses default authorizationBaseUrl when none provided', () => {
      const provider = createProvider();
      const result = provider.start({ providerId: 'codex', credentialFileId: 'cred-1' });

      expect(result.verificationUri).toContain('https://auth.codex.local/oauth/authorize');
    });

    it('uses custom deviceCodePrefix', () => {
      const provider = createProvider({ deviceCodePrefix: 'PIN' });
      const result = provider.start({ providerId: 'codex', credentialFileId: 'cred-1' });

      expect(result.userCode).toBe('PIN-codex-cred-1');
    });

    it('uses default deviceCodePrefix CODE when none provided', () => {
      const provider = createProvider();
      const result = provider.start({ providerId: 'codex', credentialFileId: 'cred-1' });

      expect(result.userCode).toBe('CODE-codex-cred-1');
    });

    it('kimi provider uses credentialFileId directly as userCode suffix', () => {
      const provider = createProvider({ providerId: 'kimi' });
      const result = provider.start({ providerId: 'kimi', credentialFileId: 'cred-k1' });

      expect(result.userCode).toBe('CODE-cred-k1');
    });

    it('non-kimi provider uses providerId-credentialFileId as userCode suffix', () => {
      const provider = createProvider({ providerId: 'claude' });
      const result = provider.start({ providerId: 'claude', credentialFileId: 'cred-c1' });

      expect(result.userCode).toBe('CODE-claude-cred-c1');
    });

    it('calculates expiresAt as 15 minutes after now', () => {
      const provider = createProvider();
      const result = provider.start({ providerId: 'codex', credentialFileId: 'cred-1' });

      const expectedExpiry = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
      expect(result.expiresAt).toBe(expectedExpiry);
    });
  });

  describe('completeCallback', () => {
    it('returns valid credential on successful callback', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'oauth-codex-cred-1',
        code: 'auth-code-123'
      });

      expect(credential.credentialId).toBe('codex:cred-1');
      expect(credential.providerId).toBe('codex');
      expect(credential.credentialFileId).toBe('cred-1');
      expect(credential.accountEmail).toBe('codex@agent-gateway.local');
      expect(credential.projectId).toBe('codex-project');
      expect(credential.scopes).toEqual(['repo', 'read:org']);
      expect(credential.status).toBe('valid');
      expect(credential.secretRef).toBe('vault://agent-gateway/oauth/cred-1');
      expect(credential.secretPayload.access_token).toBe('codex-access-auth-code-123');
      expect(credential.secretPayload.refresh_token).toBe('codex-refresh-auth-code-123');
      expect(credential.secretPayload.token_type).toBe('Bearer');
    });

    it('uses default code device-flow-complete when code is not provided', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'oauth-codex-cred-1'
      });

      expect(credential.secretPayload.access_token).toBe('codex-access-device-flow-complete');
    });

    it('returns error credential when error is present', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'oauth-codex-cred-1',
        error: 'access_denied'
      });

      expect(credential.status).toBe('error');
      expect(credential.error).toBe('access_denied');
      expect(credential.accountEmail).toBeNull();
      expect(credential.projectId).toBeNull();
      expect(credential.scopes).toEqual([]);
      expect(credential.expiresAt).toBeNull();
      expect(credential.secretPayload.error).toBe('access_denied');
    });

    it('includes redirectUrl in secret payload', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'oauth-codex-cred-1',
        code: 'code-1',
        redirectUrl: 'https://app.example.com/callback'
      });

      expect(credential.secretPayload.redirect_url).toBe('https://app.example.com/callback');
    });

    it('calculates expiresAt as 1 hour after now on success', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'oauth-codex-cred-1',
        code: 'code-1'
      });

      const expectedExpiry = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      expect(credential.expiresAt).toBe(expectedExpiry);
    });

    it('extracts credentialFileId from state prefix', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'oauth-codex-my-cred-file',
        code: 'code-1'
      });

      expect(credential.credentialFileId).toBe('my-cred-file');
    });

    it('uses full state as credentialFileId when prefix does not match', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'some-random-state',
        code: 'code-1'
      });

      expect(credential.credentialFileId).toBe('some-random-state');
    });

    it('error callback includes redirectUrl in secret payload', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'oauth-codex-cred-1',
        error: 'denied',
        redirectUrl: 'https://error.example.com'
      });

      expect(credential.secretPayload.redirect_url).toBe('https://error.example.com');
    });
  });

  describe('pollStatus', () => {
    it('returns pending when not expired', () => {
      const provider = createProvider();
      const startResult = provider.start({ providerId: 'codex', credentialFileId: 'cred-1' });
      const status = provider.pollStatus(startResult, new Date(now.getTime() + 1000));

      expect(status).toBe('pending');
    });

    it('returns expired when past expiresAt', () => {
      const provider = createProvider();
      const startResult = provider.start({ providerId: 'codex', credentialFileId: 'cred-1' });
      const status = provider.pollStatus(startResult, new Date(now.getTime() + 16 * 60 * 1000));

      expect(status).toBe('expired');
    });
  });

  describe('refreshCredential', () => {
    it('refreshes credential by credentialId', async () => {
      const provider = createProvider();
      const credential = await provider.refreshCredential('codex:cred-1');

      expect(credential.status).toBe('valid');
      expect(credential.credentialFileId).toBe('cred-1');
      expect(credential.secretPayload.access_token).toBe('codex-access-refresh');
    });

    it('uses credentialId as credentialFileId when no colon separator', async () => {
      const provider = createProvider();
      const credential = await provider.refreshCredential('standalone-cred');

      expect(credential.credentialFileId).toBe('standalone-cred');
    });
  });

  describe('projectAuthFile', () => {
    it('projects valid credential to auth file with valid status', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'oauth-codex-cred-1',
        code: 'code-1'
      });

      const authFile = provider.projectAuthFile(credential);

      expect(authFile.id).toBe('cred-1');
      expect(authFile.provider).toBe('codex');
      expect(authFile.path).toBe('/agent-gateway/auth-files/cred-1');
      expect(authFile.status).toBe('valid');
      expect(authFile.lastCheckedAt).toBeTruthy();
    });

    it('projects error credential to auth file with missing status', () => {
      const provider = createProvider();
      const credential = provider.completeCallback({
        providerId: 'codex',
        state: 'oauth-codex-cred-1',
        error: 'access_denied'
      });

      const authFile = provider.projectAuthFile(credential);
      expect(authFile.status).toBe('missing');
    });
  });

  describe('providerId', () => {
    it('exposes providerId from options', () => {
      const provider = createProvider({ providerId: 'gemini' });
      expect(provider.providerId).toBe('gemini');
    });
  });
});

describe('flowIdFor', () => {
  it('constructs flowId from providerId and credentialFileId', () => {
    expect(flowIdFor('codex', 'cred-1')).toBe('oauth-codex-cred-1');
  });

  it('handles special characters in credentialFileId', () => {
    expect(flowIdFor('claude', 'cred/with/slash')).toBe('oauth-claude-cred/with/slash');
  });
});
