import { describe, expect, it } from 'vitest';

import {
  MCP_DISCOVERY_QUERIES,
  resolveMcpSearchSourceMeta
} from '../../../src/runtime/briefing/briefing-mcp-search-policy';

describe('runtime tech briefing MCP search policy', () => {
  it('uses targeted discovery queries for frontend security and AI devtool security', () => {
    expect(MCP_DISCOVERY_QUERIES['frontend-security']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('axios'),
        expect.stringContaining('Apifox'),
        expect.stringContaining('source map')
      ])
    );
    expect(MCP_DISCOVERY_QUERIES['devtool-security']).toEqual(
      expect.arrayContaining([expect.stringContaining('Claude Code'), expect.stringContaining('Cursor MCP')])
    );
  });

  it('maps trusted official search domains without leaking vendor-specific payloads', () => {
    expect(resolveMcpSearchSourceMeta('ai-tech', 'https://www.anthropic.com/news/claude-model-update')).toEqual(
      expect.objectContaining({
        name: 'Anthropic News',
        sourceGroup: 'official',
        authorityTier: 'official-blog'
      })
    );
    expect(resolveMcpSearchSourceMeta('frontend-security', 'https://docs.apifox.com/security/incident')).toEqual(
      expect.objectContaining({
        name: 'Apifox 官方公告',
        sourceGroup: 'official',
        authorityTier: 'official-advisory'
      })
    );
    expect(resolveMcpSearchSourceMeta('ai-tech', 'https://example.com/marketing')).toBeUndefined();
  });
});
