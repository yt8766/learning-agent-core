import { describe, expect, it } from 'vitest';

import {
  assertApiKeyStatusTransition,
  buildCreateApiKeyResponse,
  normalizeApiKeyModelPermissions
} from '../src/keys/api-key-admin-service.js';

const now = '2026-04-25T00:00:00.000Z';

describe('API key admin service', () => {
  it('builds a create response with one-time plaintext but without hash', () => {
    const response = buildCreateApiKeyResponse({
      plaintext: 'sk-llmgw_created',
      record: {
        id: 'key_1',
        name: 'Local key',
        keyPrefix: 'sk-llmgw_created',
        keyHash: 'secret-hash',
        status: 'active',
        allowAllModels: false,
        models: ['gpt-main'],
        rpmLimit: 60,
        tpmLimit: null,
        dailyTokenLimit: null,
        dailyCostLimit: null,
        usedTokensToday: 0,
        usedCostToday: 0,
        requestCountToday: 0,
        expiresAt: null,
        lastUsedAt: null,
        createdAt: now,
        revokedAt: null
      }
    });

    expect(response.plaintext).toBe('sk-llmgw_created');
    expect(response.key).not.toHaveProperty('keyHash');
    expect(response.key).toMatchObject({ id: 'key_1', keyPrefix: 'sk-llmgw_created' });
  });

  it('treats revoked as a terminal API key status', () => {
    expect(() => assertApiKeyStatusTransition('revoked', 'active')).toThrow(/revoked/i);
    expect(() => assertApiKeyStatusTransition('revoked', 'disabled')).toThrow(/revoked/i);
    expect(() => assertApiKeyStatusTransition('revoked', 'revoked')).not.toThrow();
  });

  it('allows active and disabled keys to move to revoked', () => {
    expect(() => assertApiKeyStatusTransition('active', 'revoked')).not.toThrow();
    expect(() => assertApiKeyStatusTransition('disabled', 'revoked')).not.toThrow();
  });

  it('normalizes model permissions and clears them when all models are allowed', () => {
    expect(normalizeApiKeyModelPermissions({ allowAllModels: true, models: ['gpt-main'] })).toEqual([]);
    expect(
      normalizeApiKeyModelPermissions({
        allowAllModels: false,
        models: ['gpt-main', 'gpt-main', 'minimax-main']
      })
    ).toEqual(['gpt-main', 'minimax-main']);
  });
});
