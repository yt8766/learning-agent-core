import { describe, expect, it } from 'vitest';
import { selectGatewayProvider } from '../../src/domains/agent-gateway/runtime/agent-gateway-router';

describe('agent gateway router', () => {
  it('selects the healthy provider with the lowest priority number for the requested model', () => {
    const selected = selectGatewayProvider(
      [
        {
          id: 'backup',
          provider: 'Backup',
          modelFamilies: ['gpt-main'],
          status: 'healthy',
          priority: 2,
          baseUrl: 'mock://backup',
          timeoutMs: 1000
        },
        {
          id: 'primary',
          provider: 'Primary',
          modelFamilies: ['gpt-main'],
          status: 'healthy',
          priority: 1,
          baseUrl: 'mock://primary',
          timeoutMs: 1000
        },
        {
          id: 'disabled',
          provider: 'Disabled',
          modelFamilies: ['gpt-main'],
          status: 'disabled',
          priority: 0,
          baseUrl: 'mock://disabled',
          timeoutMs: 1000
        }
      ],
      'gpt-main'
    );

    expect(selected?.id).toBe('primary');
  });
});
