import { describe, expect, it } from 'vitest';

import { AgentToolAliasResolver } from '../../src/agent-surface';

describe('AgentToolAliasResolver', () => {
  it('resolves exact aliases before normalized display names', () => {
    const resolver = new AgentToolAliasResolver([
      {
        toolName: 'workspace.search',
        aliases: ['search'],
        displayName: 'Workspace Search'
      },
      {
        toolName: 'web.search',
        aliases: ['web-search'],
        displayName: 'Search'
      }
    ]);

    expect(resolver.resolve('search')?.toolName).toBe('workspace.search');
    expect(resolver.resolve('workspace search')?.toolName).toBe('workspace.search');
    expect(resolver.resolve('WEB_SEARCH')?.toolName).toBe('web.search');
  });

  it('keeps ambiguous aliases unresolved', () => {
    const resolver = new AgentToolAliasResolver([
      { toolName: 'first.search', aliases: ['search'] },
      { toolName: 'second.search', aliases: ['search'] }
    ]);

    expect(resolver.resolve('search')).toBeUndefined();
    expect(resolver.explain('search')).toMatchObject({
      status: 'ambiguous',
      candidates: ['first.search', 'second.search']
    });
  });
});
