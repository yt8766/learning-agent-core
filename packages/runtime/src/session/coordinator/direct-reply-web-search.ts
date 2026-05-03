export type WebSearchResult = {
  url: string;
  title: string;
  summary?: string;
};

export type DirectReplyWebSearchOutput = {
  sources: Array<{
    id: string;
    taskId: string;
    sourceUrl: string;
    sourceType: string;
    trustClass: string;
    summary: string;
    detail: Record<string, unknown>;
    createdAt: string;
  }>;
  topHosts: string[];
  contextSnippet: string;
};

export type DirectReplySearchFn = (query: string) => Promise<{ results: WebSearchResult[] }>;

const MAX_RESULTS = 5;

const SHORT_MESSAGE_RE =
  /^(你好|hi|hello|hey|ok|好的|谢谢|嗯|收到|明白|thanks|thank you|thx|sure|fine|对|是|好|嗯嗯|了解|OK|拜拜|bye|再见|晚安|早|gn|good\s*night|good\s*morning)\s*[.!?。！？~]*$/i;

export function shouldSkipDirectReplyWebSearch(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length <= 4 && !/[\u4e00-\u9fff]{3,}/.test(trimmed)) {
    return true;
  }
  return SHORT_MESSAGE_RE.test(trimmed);
}

export async function runDirectReplyWebSearch(params: {
  query: string;
  searchFn: DirectReplySearchFn;
  taskId?: string;
}): Promise<DirectReplyWebSearchOutput> {
  try {
    const raw = await params.searchFn(params.query);
    const results = Array.isArray(raw?.results) ? raw.results : [];
    const capped = results.filter(r => typeof r.url === 'string').slice(0, MAX_RESULTS);
    const now = new Date().toISOString();

    const sources = capped.map((item, index) => ({
      id: `web:direct:${Date.now()}:${index}`,
      taskId: params.taskId ?? `direct:${Date.now()}`,
      sourceUrl: item.url,
      sourceType: 'web' as const,
      trustClass: 'unverified' as const,
      summary: item.title || '网页搜索结果',
      detail: {
        query: params.query,
        excerpt: item.summary
      },
      createdAt: now
    }));

    const topHosts = Array.from(
      new Set(
        capped
          .map(item => {
            try {
              return new URL(item.url).hostname;
            } catch {
              return '';
            }
          })
          .filter(Boolean)
      )
    ).slice(0, 6);

    const contextSnippet = capped
      .map(item => `- [${item.title}](${item.url})${item.summary ? `: ${item.summary}` : ''}`)
      .join('\n');

    return { sources, topHosts, contextSnippet };
  } catch {
    return { sources: [], topHosts: [], contextSnippet: '' };
  }
}
