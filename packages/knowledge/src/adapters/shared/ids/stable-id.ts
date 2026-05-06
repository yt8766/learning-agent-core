import { createHash } from 'node:crypto';

export function stableId(...parts: string[]): string {
  return createHash('sha256').update(parts.join('\x00')).digest('hex').slice(0, 16);
}

export function documentId(source: string): string {
  return stableId('doc', source);
}

export function chunkId(documentId: string, chunkIndex: number): string {
  return stableId('chunk', documentId, String(chunkIndex));
}
