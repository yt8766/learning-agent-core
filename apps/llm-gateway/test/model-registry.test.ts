import { describe, expect, it } from 'vitest';
import { createModelRegistry } from '../src/models/model-registry.js';
import { isModelAllowedForKey } from '../src/models/model-permissions.js';
import { createMemoryGatewayRepository, seeded } from '../src/repositories/memory-gateway-repository.js';

describe('model registry', () => {
  const registry = createModelRegistry([
    {
      alias: 'gpt-main',
      provider: 'openai',
      providerModel: 'gpt-5.1-codex',
      enabled: true,
      contextWindow: 128000,
      fallbackAliases: ['cheap-fast'],
      adminOnly: false
    },
    {
      alias: 'mimo-main',
      provider: 'mimo',
      providerModel: 'MiMo-V2.5-Pro',
      enabled: true,
      contextWindow: 128000,
      fallbackAliases: [],
      adminOnly: false
    },
    {
      alias: 'disabled-main',
      provider: 'mock',
      providerModel: 'disabled-model',
      enabled: false,
      contextWindow: 4096,
      fallbackAliases: [],
      adminOnly: false
    }
  ]);

  it('resolves an enabled alias', () => {
    expect(registry.resolve('gpt-main')?.provider).toBe('openai');
  });

  it('returns undefined for an unknown or disabled alias', () => {
    expect(registry.resolve('missing')).toBeUndefined();
    expect(registry.resolve('disabled-main')).toBeUndefined();
  });

  it('lists only enabled models', () => {
    expect(registry.listEnabled().map(model => model.alias)).toEqual(['gpt-main', 'mimo-main']);
  });

  it('checks key model permissions', () => {
    expect(isModelAllowedForKey(['gpt-main'], 'gpt-main')).toBe(true);
    expect(isModelAllowedForKey(['gpt-main'], 'mimo-main')).toBe(false);
  });

  it('allows wildcard model permissions', () => {
    expect(isModelAllowedForKey(['*'], 'mimo-main')).toBe(true);
  });
});

describe('memory gateway repository', () => {
  it('creates an isolated seeded repository with a usable gpt-main mock model', async () => {
    const fixture = await seeded('local-secret');
    const key = await fixture.repository.findApiKeyByPrefix(fixture.seedKeyPlaintext.slice(0, 16));
    const model = await fixture.repository.findModelByAlias('gpt-main');

    expect(fixture.seedKeyPlaintext).toMatch(/^sk-llmgw_/);
    expect(key?.keyHash).toBeTruthy();
    expect(model).toMatchObject({
      alias: 'gpt-main',
      provider: 'mock',
      providerModel: 'mock-gpt-main',
      enabled: true
    });
  });

  it('keeps memory repository writes isolated from caller-owned objects', async () => {
    const repository = createMemoryGatewayRepository();
    await repository.saveModel({
      alias: 'gpt-main',
      provider: 'mock',
      providerModel: 'mock-gpt-main',
      enabled: true,
      contextWindow: 8192,
      fallbackAliases: [],
      adminOnly: false
    });

    const saved = await repository.findModelByAlias('gpt-main');
    saved?.fallbackAliases.push('mutated');
    const loadedAgain = await repository.findModelByAlias('gpt-main');

    expect(loadedAgain?.fallbackAliases).toEqual([]);
  });
});
