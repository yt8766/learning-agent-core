import type { JsonObject } from '../../../index';

export type ChromaMetadata = Record<string, string | number | boolean>;

export function mapVectorMetadataToChromaMetadata(metadata: JsonObject): ChromaMetadata {
  const result: ChromaMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (value !== null && value !== undefined) {
      result[key] = JSON.stringify(value);
    }
  }
  return result;
}
