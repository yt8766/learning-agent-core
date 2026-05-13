import { createHash } from 'node:crypto';

/**
 * Creates short deterministic IDs from structured parts.
 * The NUL separator is part of the collision-avoidance contract; do not replace it with plain string concat.
 */
export function stableId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('\x00')).digest('hex').slice(0, 16);
}

export function documentId(source: string): string {
  return stableId('doc', source);
}

export function chunkId(documentId: string, chunkIndex: number): string {
  return stableId('chunk', documentId, String(chunkIndex));
}
