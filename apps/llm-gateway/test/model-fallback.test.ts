import { describe, expect, it } from 'vitest';
import { buildFallbackChain } from '../src/models/model-fallback.js';
import { createModelRegistry, type GatewayModelConfig } from '../src/models/model-registry.js';

function model(alias: string, fallbackAliases: string[] = [], enabled = true): GatewayModelConfig {
  return {
    alias,
    provider: 'mock',
    providerModel: `mock-${alias}`,
    enabled,
    contextWindow: 8192,
    fallbackAliases,
    adminOnly: false
  };
}

describe('model fallback chain', () => {
  it('returns the requested model before depth-first fallback candidates', () => {
    const registry = createModelRegistry([
      model('primary', ['fast', 'safe']),
      model('fast', ['tiny']),
      model('safe'),
      model('tiny')
    ]);

    expect(buildFallbackChain('primary', registry.resolve, 4).map(candidate => candidate.alias)).toEqual([
      'primary',
      'fast',
      'tiny',
      'safe'
    ]);
  });

  it('deduplicates aliases and prevents self references and cycles', () => {
    const registry = createModelRegistry([
      model('primary', ['fast', 'primary', 'safe']),
      model('fast', ['safe', 'primary']),
      model('safe', ['fast'])
    ]);

    expect(buildFallbackChain('primary', registry.resolve, 8).map(candidate => candidate.alias)).toEqual([
      'primary',
      'fast',
      'safe'
    ]);
  });

  it('skips disabled or missing fallback models and stops at max depth', () => {
    const registry = createModelRegistry([
      model('primary', ['fast', 'disabled', 'missing']),
      model('fast', ['tiny']),
      model('tiny', ['deep']),
      model('deep'),
      model('disabled', [], false)
    ]);

    expect(buildFallbackChain('primary', registry.resolve, 1).map(candidate => candidate.alias)).toEqual([
      'primary',
      'fast'
    ]);
  });

  it('returns an empty chain when the requested alias cannot be resolved', () => {
    const registry = createModelRegistry([model('primary')]);

    expect(buildFallbackChain('missing', registry.resolve, 4)).toEqual([]);
  });
});
