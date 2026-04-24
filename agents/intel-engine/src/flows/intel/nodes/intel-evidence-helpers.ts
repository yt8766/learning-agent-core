import { createHash } from 'node:crypto';

export interface IntelContentHashInput {
  taskId: string;
  url: string;
  publishedAt: string;
  title: string;
}

export function resolveIntelContentHash(input: IntelContentHashInput): string {
  return createHash('sha1').update(`${input.url}:${input.title}`).digest('hex');
}

export function resolveIntelSignalSourceId(signalId: string, contentHash: string): string {
  return `signal_source_${signalId}_${contentHash}`.replace(/[^a-zA-Z0-9_:.-]+/g, '_');
}
