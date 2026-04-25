import { describe, expect, it } from 'vitest';

import {
  CreateProviderCredentialRequestSchema,
  CreateProviderCredentialResponseSchema,
  ProviderAdminRecordSchema,
  ProviderAdminSummarySchema,
  ProviderCredentialAdminRecordSchema,
  RotateProviderCredentialResponseSchema,
  RotateProviderCredentialRequestSchema,
  UpsertProviderRequestSchema,
  UpsertProviderWithCredentialRequestSchema
} from '../src/contracts/admin-provider.js';

const provider = {
  id: 'provider_openai',
  name: 'OpenAI',
  kind: 'openai',
  status: 'active',
  baseUrl: 'https://api.openai.com/v1',
  timeoutMs: 30000,
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T01:00:00.000Z'
};

const credential = {
  id: 'credential_openai',
  providerId: 'provider_openai',
  keyPrefix: 'sk-live',
  fingerprint: 'fp_abc123',
  keyVersion: 'local-v1',
  status: 'active',
  createdAt: '2026-04-25T00:00:00.000Z',
  rotatedAt: null
};

describe('admin provider contracts', () => {
  it('parses provider admin records and upsert requests', () => {
    expect(ProviderAdminRecordSchema.parse(provider)).toEqual(provider);

    expect(
      UpsertProviderRequestSchema.parse({
        name: 'OpenAI',
        kind: 'openai',
        status: 'disabled',
        baseUrl: 'https://api.openai.com/v1',
        timeoutMs: null
      })
    ).toEqual({
      name: 'OpenAI',
      kind: 'openai',
      status: 'disabled',
      baseUrl: 'https://api.openai.com/v1',
      timeoutMs: null
    });
  });

  it('parses flattened provider admin summaries without credential arrays', () => {
    const parsed = ProviderAdminSummarySchema.parse({
      ...provider,
      credentialId: credential.id,
      credentialKeyPrefix: credential.keyPrefix,
      credentialFingerprint: credential.fingerprint,
      credentialKeyVersion: credential.keyVersion,
      credentialStatus: credential.status,
      credentialCreatedAt: credential.createdAt,
      credentialRotatedAt: credential.rotatedAt
    });

    expect(parsed).toMatchObject({
      id: provider.id,
      credentialKeyPrefix: 'sk-live',
      credentialStatus: 'active'
    });
    expect('credentials' in parsed).toBe(false);
    expect('plaintextApiKey' in parsed).toBe(false);
    expect('encryptedApiKey' in parsed).toBe(false);
  });

  it('parses credential admin records without secret material', () => {
    const parsed = ProviderCredentialAdminRecordSchema.parse(credential);

    expect(parsed).toEqual(credential);
    expect('plaintext' in parsed).toBe(false);
    expect('plaintextApiKey' in parsed).toBe(false);
    expect('encryptedApiKey' in parsed).toBe(false);
  });

  it('rejects secret material in credential admin responses', () => {
    expect(CreateProviderCredentialResponseSchema.parse({ credential })).toEqual({ credential });
    expect(RotateProviderCredentialResponseSchema.parse({ credential })).toEqual({ credential });

    expect(() =>
      CreateProviderCredentialResponseSchema.parse({
        credential,
        plaintextApiKey: 'sk-plaintext'
      })
    ).toThrow();

    expect(() =>
      RotateProviderCredentialResponseSchema.parse({
        credential,
        encryptedApiKey: 'ciphertext'
      })
    ).toThrow();
  });

  it('accepts plaintext only in create and rotate credential requests', () => {
    expect(
      CreateProviderCredentialRequestSchema.parse({
        providerId: 'provider_openai',
        plaintextApiKey: 'sk-created'
      }).plaintextApiKey
    ).toBe('sk-created');

    expect(
      RotateProviderCredentialRequestSchema.parse({
        plaintextApiKey: 'sk-rotated'
      }).plaintextApiKey
    ).toBe('sk-rotated');
  });

  it('keeps base provider upserts secret-free while allowing the route-level provider credential upsert', () => {
    expect(() =>
      UpsertProviderRequestSchema.parse({
        name: 'OpenAI',
        kind: 'openai',
        status: 'active',
        baseUrl: 'https://api.openai.com/v1',
        timeoutMs: null,
        plaintextApiKey: 'sk-plaintext'
      })
    ).toThrow();

    expect(
      UpsertProviderWithCredentialRequestSchema.parse({
        name: 'OpenAI',
        kind: 'openai',
        status: 'active',
        baseUrl: 'https://api.openai.com/v1',
        timeoutMs: null,
        plaintextApiKey: 'sk-plaintext'
      }).plaintextApiKey
    ).toBe('sk-plaintext');
  });
});
