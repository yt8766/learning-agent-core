import type { IntelligenceSourceGroup } from './intelligence.types';

export interface NormalizeMiniMaxSearchPayloadInput {
  queryId: string;
  fetchedAt: string;
  payload: unknown;
}

export interface NormalizedIntelligenceRawEventInput {
  id: string;
  queryId: string;
  contentHash: string;
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  fetchedAt: string;
  sourceName: string;
  sourceUrl?: string;
  sourceGroup: IntelligenceSourceGroup;
  rawPayload: Record<string, unknown>;
}

type JsonSafeValue = null | boolean | number | string | JsonSafeValue[] | { [key: string]: JsonSafeValue };

export function normalizeMiniMaxSearchPayload(
  input: NormalizeMiniMaxSearchPayloadInput
): NormalizedIntelligenceRawEventInput[] {
  const results = readResults(input.payload);

  return results.flatMap(result => {
    if (!result || typeof result !== 'object') {
      return [];
    }

    const raw = result as Record<string, unknown>;
    const title = normalizeText(raw.title);
    const url = normalizeText(raw.url);
    const snippet = normalizeText(raw.summary) || normalizeText(raw.snippet);
    const publishedAt = normalizeOptionalText(raw.publishedAt);
    const sourceName = normalizeText(raw.sourceName) || hostname(url);

    if (!title || !url || !snippet) {
      return [];
    }

    const contentHash = stableHexHash(`${url}|${title}|${publishedAt ?? ''}|${sourceName}`);

    return [
      {
        id: `raw_${contentHash.slice(0, 16)}`,
        queryId: input.queryId,
        contentHash,
        title,
        url,
        snippet,
        publishedAt,
        fetchedAt: input.fetchedAt,
        sourceName,
        sourceUrl: normalizeOptionalText(raw.sourceUrl),
        sourceGroup: normalizeSourceGroup(raw.sourceGroup),
        rawPayload: sanitizeJsonObject(raw)
      }
    ];
  });
}

function readResults(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const results = (payload as { results?: unknown }).results;
  return Array.isArray(results) ? results : [];
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalText(value: unknown): string | undefined {
  const text = normalizeText(value);
  return text || undefined;
}

function normalizeSourceGroup(value: unknown): IntelligenceSourceGroup {
  return value === 'official' || value === 'authority' || value === 'community' ? value : 'unknown';
}

function sanitizeJsonObject(value: Record<string, unknown>): Record<string, JsonSafeValue> {
  const sanitized = sanitizeJsonValue(value, new WeakSet<object>());
  return sanitized && !Array.isArray(sanitized) && typeof sanitized === 'object' ? sanitized : {};
}

function sanitizeJsonValue(value: unknown, seen: WeakSet<object>): JsonSafeValue | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return undefined;
    }

    seen.add(value);
    const result = value.flatMap(item => {
      const sanitized = sanitizeJsonValue(item, seen);
      return sanitized === undefined ? [] : [sanitized];
    });
    seen.delete(value);
    return result;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return undefined;
    }

    seen.add(value);
    const result: Record<string, JsonSafeValue> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      const sanitized = sanitizeJsonValue(item, seen);
      if (sanitized !== undefined) {
        result[key] = sanitized;
      }
    });
    seen.delete(value);
    return result;
  }

  return undefined;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

function stableHexHash(value: string): string {
  let hashA = 0x811c9dc5;
  let hashB = 0x45d9f3b;
  let hashC = 0x9e3779b9;
  let hashD = 0x85ebca6b;
  let hashE = 0xc2b2ae35;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 0x01000193);
    hashB = Math.imul(hashB + code, 0x27d4eb2d);
    hashC = Math.imul(hashC ^ (code + index), 0x165667b1);
    hashD = Math.imul(hashD + (code << (index % 8)), 0x85ebca6b);
    hashE = Math.imul(hashE ^ (code * 31 + index), 0xc2b2ae35);
  }

  return [hashA, hashB, hashC, hashD, hashE].map(part => (part >>> 0).toString(16).padStart(8, '0')).join('');
}
