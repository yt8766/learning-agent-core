import type { JsonObject, JsonValue } from '@agent/core';

export function normalizeMetadataValue(value: unknown): JsonValue | undefined {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof URL) return value.toString();
  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    for (const item of value) {
      const normalized = normalizeMetadataValue(item);
      if (normalized !== undefined) result.push(normalized);
    }
    return result;
  }
  if (typeof value === 'object') {
    return normalizeMetadata(value as Record<string, unknown>);
  }
  return String(value);
}

export function normalizeMetadata(raw: Record<string, unknown>): JsonObject {
  const result: JsonObject = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeMetadataValue(value);
    if (normalized !== undefined) {
      result[key] = normalized;
    }
  }
  return result;
}
