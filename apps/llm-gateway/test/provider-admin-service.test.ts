import { describe, expect, it } from 'vitest';

import {
  assertProviderCredentialStatusTransition,
  assertProviderStatusTransition,
  buildCreateProviderCredentialResponse,
  buildProviderAdminRecord,
  buildProviderCredentialAdminRecord,
  buildRotateProviderCredentialResponse,
  normalizeProviderAdminUpsert
} from '../src/providers/provider-admin-service.js';

const now = '2026-04-25T00:00:00.000Z';

const providerRecord = {
  id: 'provider_openai',
  name: 'OpenAI',
  kind: 'openai',
  status: 'active',
  baseUrl: 'https://api.openai.com/v1/',
  timeoutMs: 30000,
  createdAt: now,
  updatedAt: now
} as const;

const credentialRecord = {
  id: 'credential_openai',
  providerId: 'provider_openai',
  keyPrefix: 'sk-live',
  fingerprint: 'fp_abc123',
  keyVersion: 'local-v1',
  status: 'active',
  plaintextApiKey: 'sk-plaintext',
  encryptedApiKey: 'ciphertext',
  createdAt: now,
  rotatedAt: null
} as const;

describe('provider admin service', () => {
  it('normalizes provider upserts before contract parsing', () => {
    expect(
      normalizeProviderAdminUpsert({
        name: '  OpenAI  ',
        kind: 'openai',
        status: 'active',
        baseUrl: 'https://api.openai.com/v1/',
        timeoutMs: 0
      })
    ).toEqual({
      name: 'OpenAI',
      kind: 'openai',
      status: 'active',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: null
    });
  });

  it('builds provider records through the admin contract', () => {
    expect(buildProviderAdminRecord(providerRecord)).toEqual(providerRecord);
  });

  it('redacts provider credential secrets from records and responses', () => {
    const credential = buildProviderCredentialAdminRecord(credentialRecord);

    expect(credential).toEqual({
      id: 'credential_openai',
      providerId: 'provider_openai',
      keyPrefix: 'sk-live',
      fingerprint: 'fp_abc123',
      keyVersion: 'local-v1',
      status: 'active',
      createdAt: now,
      rotatedAt: null
    });
    expect(credential).not.toHaveProperty('plaintextApiKey');
    expect(credential).not.toHaveProperty('encryptedApiKey');

    const createResponse = buildCreateProviderCredentialResponse(credentialRecord);
    const rotateResponse = buildRotateProviderCredentialResponse(credentialRecord);

    expect(JSON.stringify(createResponse)).not.toContain('sk-plaintext');
    expect(JSON.stringify(createResponse)).not.toContain('ciphertext');
    expect(JSON.stringify(rotateResponse)).not.toContain('sk-plaintext');
    expect(JSON.stringify(rotateResponse)).not.toContain('ciphertext');
  });

  it('allows active and disabled providers to transition between each other', () => {
    expect(() => assertProviderStatusTransition('active', 'disabled')).not.toThrow();
    expect(() => assertProviderStatusTransition('disabled', 'active')).not.toThrow();
    expect(() => assertProviderStatusTransition('active', 'active')).not.toThrow();
  });

  it('treats rotated and revoked credentials as terminal for reactivation', () => {
    expect(() => assertProviderCredentialStatusTransition('active', 'rotated')).not.toThrow();
    expect(() => assertProviderCredentialStatusTransition('active', 'revoked')).not.toThrow();
    expect(() => assertProviderCredentialStatusTransition('rotated', 'revoked')).not.toThrow();
    expect(() => assertProviderCredentialStatusTransition('rotated', 'active')).toThrow(/terminal/i);
    expect(() => assertProviderCredentialStatusTransition('revoked', 'active')).toThrow(/terminal/i);
  });
});
