import { describe, expect, it } from 'vitest';

import {
  ApiKeyAdminSummarySchema,
  CreateApiKeyRequestSchema,
  CreateApiKeyResponseSchema,
  UpdateApiKeyRequestSchema
} from '../src/contracts/admin-api-key.js';

const summary = {
  id: 'key_1',
  name: 'Local key',
  keyPrefix: 'sk-llmgw_abc123',
  status: 'active',
  allowAllModels: false,
  models: ['gpt-main'],
  rpmLimit: 60,
  tpmLimit: 100000,
  dailyTokenLimit: 500000,
  dailyCostLimit: 10,
  usedTokensToday: 100,
  usedCostToday: 0.05,
  requestCountToday: 3,
  expiresAt: null,
  lastUsedAt: null,
  createdAt: '2026-04-25T00:00:00.000Z',
  revokedAt: null
};

describe('admin API key contracts', () => {
  it('parses API key admin summaries without secret material', () => {
    const parsed = ApiKeyAdminSummarySchema.parse(summary);

    expect(parsed).toEqual(summary);
    expect('keyHash' in parsed).toBe(false);
    expect('plaintext' in parsed).toBe(false);
  });

  it('allows create responses to include one-time plaintext', () => {
    const parsed = CreateApiKeyResponseSchema.parse({
      key: summary,
      plaintext: 'sk-llmgw_created-secret'
    });

    expect(parsed.plaintext).toBe('sk-llmgw_created-secret');
  });

  it('rejects negative or zero limits in create and update requests', () => {
    expect(() =>
      CreateApiKeyRequestSchema.parse({
        name: 'bad',
        allowAllModels: true,
        models: [],
        rpmLimit: 0,
        tpmLimit: null,
        dailyTokenLimit: null,
        dailyCostLimit: null,
        expiresAt: null
      })
    ).toThrow();

    expect(() => UpdateApiKeyRequestSchema.parse({ dailyCostLimit: -1 })).toThrow();
  });

  it('accepts revoked summaries as terminal records', () => {
    expect(
      ApiKeyAdminSummarySchema.parse({
        ...summary,
        status: 'revoked',
        revokedAt: '2026-04-25T01:00:00.000Z'
      }).status
    ).toBe('revoked');
  });
});
