import { describe, expect, it } from 'vitest';

import { GatewayModelAdminRecordSchema, UpsertGatewayModelRequestSchema } from '../src/contracts/admin-model.js';
import { GatewayModelCapabilitySchema } from '../src/contracts/index.js';

const model = {
  id: 'model_gpt_main',
  alias: 'gpt-main',
  providerId: 'provider_openai',
  providerModel: 'gpt-4.1',
  enabled: true,
  contextWindow: 128000,
  inputPricePer1mTokens: 2,
  outputPricePer1mTokens: null,
  capabilities: ['chat_completions', 'streaming', 'json_mode'],
  fallbackAliases: ['cheap-fast'],
  adminOnly: false,
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T01:00:00.000Z'
};

const modelRequest = {
  alias: 'cheap-fast',
  providerId: 'provider_openai',
  providerModel: 'gpt-4o-mini',
  enabled: true,
  contextWindow: 64000,
  inputPricePer1mTokens: 0,
  outputPricePer1mTokens: 0,
  capabilities: ['chat_completions'],
  fallbackAliases: [],
  adminOnly: false
};

describe('admin model contracts', () => {
  it('parses gateway model admin records and upsert requests', () => {
    expect(GatewayModelAdminRecordSchema.parse(model)).toEqual(model);

    expect(UpsertGatewayModelRequestSchema.parse(modelRequest)).toMatchObject({
      alias: 'cheap-fast',
      contextWindow: 64000,
      inputPricePer1mTokens: 0,
      outputPricePer1mTokens: 0
    });
  });

  it('enforces lowercase slug aliases', () => {
    expect(() =>
      UpsertGatewayModelRequestSchema.parse({
        ...modelRequest,
        alias: 'GPT_Main'
      })
    ).toThrow();

    expect(() =>
      UpsertGatewayModelRequestSchema.parse({
        ...modelRequest,
        alias: 'gpt.main'
      })
    ).toThrow();
  });

  it('requires a positive context window and nullable nonnegative prices', () => {
    expect(() =>
      UpsertGatewayModelRequestSchema.parse({
        ...modelRequest,
        contextWindow: 0
      })
    ).toThrow();

    expect(() =>
      UpsertGatewayModelRequestSchema.parse({
        ...modelRequest,
        inputPricePer1mTokens: -1
      })
    ).toThrow();

    expect(
      UpsertGatewayModelRequestSchema.parse({ ...modelRequest, inputPricePer1mTokens: null }).inputPricePer1mTokens
    ).toBeNull();
  });

  it('keeps capabilities as an enum and fallback aliases as strings', () => {
    expect(GatewayModelCapabilitySchema.parse('tool_calling')).toBe('tool_calling');

    expect(() =>
      UpsertGatewayModelRequestSchema.parse({
        ...modelRequest,
        capabilities: ['unknown_capability']
      })
    ).toThrow();

    expect(() =>
      UpsertGatewayModelRequestSchema.parse({
        ...modelRequest,
        fallbackAliases: ['cheap-fast', 42]
      })
    ).toThrow();
  });
});
