import type { ToolExecutionRequest } from '../contracts/governance/types/governance.types';
import type { CliCapabilityBinding, McpCapabilityDefinition } from '@agent/tools';

function readStringField(input: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return '';
}

function normalizeSearchResultEntry(entry: unknown): Record<string, unknown> | undefined {
  if (!entry || typeof entry !== 'object') {
    return undefined;
  }
  const raw = entry as Record<string, unknown>;
  const title =
    typeof raw.title === 'string'
      ? raw.title
      : typeof raw.name === 'string'
        ? raw.name
        : typeof raw.headline === 'string'
          ? raw.headline
          : undefined;
  const url =
    typeof raw.url === 'string'
      ? raw.url
      : typeof raw.link === 'string'
        ? raw.link
        : typeof raw.uri === 'string'
          ? raw.uri
          : undefined;
  const summary =
    typeof raw.summary === 'string'
      ? raw.summary
      : typeof raw.snippet === 'string'
        ? raw.snippet
        : typeof raw.description === 'string'
          ? raw.description
          : typeof raw.content === 'string'
            ? raw.content
            : undefined;
  if (!title?.trim() || !url?.trim() || !summary?.trim()) {
    return undefined;
  }
  const normalized: Record<string, unknown> = { title: title.trim(), url: url.trim(), summary: summary.trim() };
  if (typeof raw.sourceName === 'string' && raw.sourceName.trim().length > 0) {
    normalized.sourceName = raw.sourceName.trim();
  }
  if (raw.sourceType === 'community') {
    normalized.sourceType = 'community';
  }
  if (typeof raw.publishedAt === 'string') {
    normalized.publishedAt = raw.publishedAt;
  } else if (typeof raw.published_at === 'string') {
    normalized.publishedAt = raw.published_at;
  }
  return normalized;
}

function normalizeWebSearchCliOutput(parsed: unknown): { results: Record<string, unknown>[] } {
  if (parsed == null) {
    return { results: [] };
  }
  if (Array.isArray(parsed)) {
    const results = parsed.flatMap(item => {
      const normalized = normalizeSearchResultEntry(item);
      return normalized ? [normalized] : [];
    });
    return { results };
  }
  if (typeof parsed !== 'object') {
    return { results: [] };
  }
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.results)) {
    const results = record.results.flatMap(item => {
      const normalized = normalizeSearchResultEntry(item);
      return normalized ? [normalized] : [];
    });
    return { results };
  }
  if (Array.isArray(record.items)) {
    const results = record.items.flatMap(item => {
      const normalized = normalizeSearchResultEntry(item);
      return normalized ? [normalized] : [];
    });
    return { results };
  }
  const single = normalizeSearchResultEntry(record);
  return { results: single ? [single] : [] };
}

export function createMiniMaxCliBindings(apiKey: string): Map<string, CliCapabilityBinding> {
  return new Map<string, CliCapabilityBinding>([
    [
      'minimax:web_search',
      {
        capabilityId: 'minimax:web_search',
        buildPayload(request: ToolExecutionRequest, _capability: McpCapabilityDefinition) {
          const input = request.input as Record<string, unknown>;
          const query = readStringField(input, ['query', 'q', 'text']);
          const args = ['search', 'query', '--q', query, '--output', 'json', '--api-key', apiKey];
          return { args };
        },
        parseResponse(raw, _capability: McpCapabilityDefinition) {
          const trimmed = raw.stdout.trim();
          if (!trimmed) {
            return { results: [] };
          }
          const parsed: unknown = JSON.parse(trimmed);
          return normalizeWebSearchCliOutput(parsed);
        },
        timeoutMs: 45_000
      }
    ],
    [
      'minimax:understand_image',
      {
        capabilityId: 'minimax:understand_image',
        buildPayload(request: ToolExecutionRequest, _capability: McpCapabilityDefinition) {
          const input = request.input as Record<string, unknown>;
          const image = readStringField(input, ['image', 'url', 'image_url', 'imageUrl']);
          const prompt = readStringField(input, ['prompt', 'text', 'question']);
          const args = [
            'vision',
            'describe',
            '--image',
            image,
            '--prompt',
            prompt,
            '--output',
            'json',
            '--api-key',
            apiKey
          ];
          return { args };
        },
        parseResponse(raw, _capability: McpCapabilityDefinition) {
          const trimmed = raw.stdout.trim();
          if (!trimmed) {
            return {};
          }
          return JSON.parse(trimmed) as unknown;
        },
        timeoutMs: 120_000
      }
    ]
  ]);
}
