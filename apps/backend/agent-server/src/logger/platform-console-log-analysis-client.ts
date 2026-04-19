import type { PlatformConsoleLogAnalysis } from './platform-console-log-analysis';

export async function fetchPlatformConsoleLogAnalysis(options: {
  baseUrl: string;
  days?: number;
  fetcher?: typeof fetch;
}): Promise<PlatformConsoleLogAnalysis> {
  const fetcher = options.fetcher ?? fetch;
  const days = Math.max(1, options.days ?? 7);
  const url = new URL('/api/platform/console/log-analysis', normalizeBaseUrl(options.baseUrl));
  url.searchParams.set('days', String(days));

  const response = await fetcher(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Platform console log analysis request failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  return (await response.json()) as PlatformConsoleLogAnalysis;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}
