import { describe, expect, it } from 'vitest';
import { createVirtualApiKey, verifyVirtualApiKey } from '../src/keys/api-key.js';

describe('virtual API keys', () => {
  it('creates a prefixed key and stores only a hash', async () => {
    const created = await createVirtualApiKey('local-secret');

    expect(created.plaintext).toMatch(/^sk-llmgw_/);
    expect(created.prefix).toBe(created.plaintext.slice(0, 16));
    expect(created.hash).not.toContain(created.plaintext);
    expect(created.hash).not.toContain(created.prefix);
  });

  it('verifies a matching key', async () => {
    const created = await createVirtualApiKey('local-secret');

    await expect(verifyVirtualApiKey(created.plaintext, created.hash, 'local-secret')).resolves.toBe(true);
  });

  it('rejects a different key', async () => {
    const created = await createVirtualApiKey('local-secret');

    await expect(verifyVirtualApiKey('sk-llmgw_wrong', created.hash, 'local-secret')).resolves.toBe(false);
  });

  it('rejects the right key when a different secret is used', async () => {
    const created = await createVirtualApiKey('local-secret');

    await expect(verifyVirtualApiKey(created.plaintext, created.hash, 'other-secret')).resolves.toBe(false);
  });
});
