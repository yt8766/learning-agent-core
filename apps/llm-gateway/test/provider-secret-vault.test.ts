import { describe, expect, it } from 'vitest';
import { ProviderSecretVault } from '../src/secrets/provider-secret-vault.js';

describe('ProviderSecretVault', () => {
  const key = 'local-provider-secret-vault-key-32';

  it('encrypts provider secrets into an authenticated payload without leaking plaintext', () => {
    const vault = new ProviderSecretVault({ key, keyVersion: 'local-v1' });

    const encrypted = vault.encrypt('sk-provider-secret-value');

    expect(encrypted).toEqual({
      algorithm: 'AES-256-GCM',
      keyVersion: 'local-v1',
      iv: expect.any(String),
      tag: expect.any(String),
      ciphertext: expect.any(String)
    });
    expect(JSON.stringify(encrypted)).not.toContain('sk-provider-secret-value');
    expect(encrypted.iv).not.toHaveLength(0);
    expect(encrypted.tag).not.toHaveLength(0);
    expect(encrypted.ciphertext).not.toHaveLength(0);
  });

  it('decrypts secrets encrypted by the same key version', () => {
    const vault = new ProviderSecretVault({ key, keyVersion: 'local-v1' });

    const encrypted = vault.encrypt('sk-provider-secret-value');

    expect(vault.decrypt(encrypted)).toBe('sk-provider-secret-value');
  });

  it('rejects payloads that were tampered with or encrypted for a different key version', () => {
    const vault = new ProviderSecretVault({ key, keyVersion: 'local-v1' });
    const encrypted = vault.encrypt('sk-provider-secret-value');

    expect(() => vault.decrypt({ ...encrypted, ciphertext: `${encrypted.ciphertext}00` })).toThrow(
      'Provider secret payload could not be decrypted'
    );
    expect(() => vault.decrypt({ ...encrypted, keyVersion: 'local-v2' })).toThrow(
      'Provider secret key version mismatch'
    );
  });

  it('creates a stable irreversible fingerprint without embedding plaintext', () => {
    const vault = new ProviderSecretVault({ key, keyVersion: 'local-v1' });

    const first = vault.fingerprint('sk-provider-secret-value');
    const second = vault.fingerprint('sk-provider-secret-value');

    expect(first).toBe(second);
    expect(first).toMatch(/^hmac-sha256:[a-f0-9]{64}$/);
    expect(first).not.toContain('sk-provider-secret-value');
  });
});
