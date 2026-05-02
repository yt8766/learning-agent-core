import type { JsonObject } from './json.types';

import { normalizeMetadataValue } from './normalize-metadata';

export function mergeMetadata(...sources: (JsonObject | undefined | null)[]): JsonObject {
  const result: JsonObject = {};
  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      const normalized = normalizeMetadataValue(value);
      if (normalized !== undefined) {
        result[key] = normalized;
      }
    }
  }
  return result;
}
