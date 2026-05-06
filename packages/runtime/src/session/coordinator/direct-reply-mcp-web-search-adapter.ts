import type { McpClientManager } from '@agent/tools';

import type { DirectReplySearchFn, WebSearchResult } from './direct-reply-web-search';

function normalizeSearchResults(rawOutput: unknown): WebSearchResult[] {
  if (rawOutput === null || rawOutput === undefined || typeof rawOutput !== 'object') {
    return [];
  }
  const record = rawOutput as Record<string, unknown>;
  const rawResults = record.results;
  if (!Array.isArray(rawResults)) {
    return [];
  }
  const out: WebSearchResult[] = [];
  for (const item of rawResults) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const r = item as Record<string, unknown>;
    const url = typeof r.url === 'string' ? r.url : '';
    if (!url) {
      continue;
    }
    const title = typeof r.title === 'string' ? r.title : typeof r.sourceName === 'string' ? r.sourceName : url;
    const summary = typeof r.summary === 'string' ? r.summary : typeof r.snippet === 'string' ? r.snippet : undefined;
    out.push({ url, title, summary });
  }
  return out;
}

/**
 * Builds an optional {@link DirectReplySearchFn} when MCP exposes web search capabilities.
 * Prefer `webSearchPrime`, then `minimax:web_search`. Returns `undefined` when neither is available.
 */
export function createDirectReplyWebSearchFromMcp(
  manager: McpClientManager | undefined
): DirectReplySearchFn | undefined {
  if (!manager) {
    return undefined;
  }

  if (manager.hasCapability('webSearchPrime')) {
    return async (query: string) => {
      const result = await manager.invokeCapability('webSearchPrime', {
        taskId: `direct-reply-search-${Date.now()}`,
        toolName: 'webSearchPrime',
        intent: 'direct_reply_web_search',
        input: { query, goal: query },
        requestedBy: 'agent'
      });
      if (!result.ok) {
        return { results: [] };
      }
      return { results: normalizeSearchResults(result.rawOutput) };
    };
  }

  if (manager.hasCapability('minimax:web_search')) {
    return async (query: string) => {
      const result = await manager.invokeCapability('minimax:web_search', {
        taskId: `direct-reply-search-${Date.now()}`,
        toolName: 'web_search',
        intent: 'direct_reply_web_search',
        input: { query },
        requestedBy: 'agent'
      });
      if (!result.ok) {
        return { results: [] };
      }
      return { results: normalizeSearchResults(result.rawOutput) };
    };
  }

  return undefined;
}
