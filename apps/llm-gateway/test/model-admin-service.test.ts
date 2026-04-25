import { describe, expect, it } from 'vitest';

import {
  assertGatewayModelEnabledTransition,
  buildGatewayModelAdminRecord,
  normalizeGatewayModelAdminUpsert
} from '../src/models/model-admin-service.js';

const now = '2026-04-25T00:00:00.000Z';

describe('model admin service', () => {
  it('normalizes aliases, fallback aliases, prices, context window, and capabilities', () => {
    expect(
      normalizeGatewayModelAdminUpsert({
        alias: ' GPT_Main ',
        providerId: ' provider_openai ',
        providerModel: ' gpt-4.1 ',
        enabled: true,
        contextWindow: '128000',
        inputPricePer1mTokens: '2.50',
        outputPricePer1mTokens: '',
        capabilities: ['streaming', 'chat_completions', 'streaming'],
        fallbackAliases: [' Cheap Fast ', 'cheap_fast', 'GPT_Main', ''],
        adminOnly: false
      })
    ).toEqual({
      alias: 'gpt-main',
      providerId: 'provider_openai',
      providerModel: 'gpt-4.1',
      enabled: true,
      contextWindow: 128000,
      inputPricePer1mTokens: 2.5,
      outputPricePer1mTokens: null,
      capabilities: ['streaming', 'chat_completions'],
      fallbackAliases: ['cheap-fast'],
      adminOnly: false
    });
  });

  it('rejects invalid normalized model settings through the admin contract', () => {
    expect(() =>
      normalizeGatewayModelAdminUpsert({
        alias: 'bad alias',
        providerId: 'provider_openai',
        providerModel: 'gpt-4.1',
        enabled: true,
        contextWindow: '-1',
        inputPricePer1mTokens: null,
        outputPricePer1mTokens: null,
        capabilities: ['chat_completions'],
        fallbackAliases: [],
        adminOnly: false
      })
    ).toThrow();

    expect(() =>
      normalizeGatewayModelAdminUpsert({
        alias: 'gpt-main',
        providerId: 'provider_openai',
        providerModel: 'gpt-4.1',
        enabled: true,
        contextWindow: 128000,
        inputPricePer1mTokens: null,
        outputPricePer1mTokens: null,
        capabilities: ['unknown'],
        fallbackAliases: [],
        adminOnly: false
      })
    ).toThrow();
  });

  it('builds model admin records with normalized array fields', () => {
    expect(
      buildGatewayModelAdminRecord({
        id: 'model_gpt_main',
        alias: 'gpt-main',
        providerId: 'provider_openai',
        providerModel: 'gpt-4.1',
        enabled: true,
        contextWindow: 128000,
        inputPricePer1mTokens: 2,
        outputPricePer1mTokens: null,
        capabilities: ['tool_calling', 'streaming', 'tool_calling'],
        fallbackAliases: ['cheap-fast', 'cheap-fast', 'gpt-main'],
        adminOnly: false,
        createdAt: now,
        updatedAt: now
      })
    ).toEqual({
      id: 'model_gpt_main',
      alias: 'gpt-main',
      providerId: 'provider_openai',
      providerModel: 'gpt-4.1',
      enabled: true,
      contextWindow: 128000,
      inputPricePer1mTokens: 2,
      outputPricePer1mTokens: null,
      capabilities: ['tool_calling', 'streaming'],
      fallbackAliases: ['cheap-fast'],
      adminOnly: false,
      createdAt: now,
      updatedAt: now
    });
  });

  it('allows model enablement transitions without rewriting settings', () => {
    expect(() => assertGatewayModelEnabledTransition(true, false)).not.toThrow();
    expect(() => assertGatewayModelEnabledTransition(false, true)).not.toThrow();
    expect(() => assertGatewayModelEnabledTransition(true, true)).not.toThrow();
  });
});
