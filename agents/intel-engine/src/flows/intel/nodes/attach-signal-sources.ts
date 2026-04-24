import { IntelSignalSourceSchema, type IntelSignalSource } from '@agent/core';

import type { PatrolSearchResult, PatrolIntelSignal } from '../schemas/patrol-graph-state.schema';
import { resolveIntelContentHash, resolveIntelSignalSourceId } from './intel-evidence-helpers';

export interface AttachSignalSourcesInput {
  rawResults: PatrolSearchResult[];
  normalizedSignals: PatrolIntelSignal[];
  signalMergeMap: Record<string, string>;
  createdAt: string;
}

function resolveContentHash(rawResult: PatrolSearchResult): string {
  return (
    rawResult.contentHash ??
    resolveIntelContentHash({
      taskId: rawResult.taskId,
      url: rawResult.url,
      publishedAt: rawResult.publishedAt,
      title: rawResult.title
    })
  );
}

export function attachSignalSources(input: AttachSignalSourcesInput): IntelSignalSource[] {
  return input.normalizedSignals.map((signal, index) => {
    const rawResult = input.rawResults[index];
    if (!rawResult) {
      throw new Error(`Cannot attach signal source for ${signal.id}: missing raw search result at index ${index}`);
    }

    const finalSignalId = input.signalMergeMap[signal.id];
    if (!finalSignalId) {
      throw new Error(`Cannot attach signal source for ${signal.id}: missing final signal mapping`);
    }

    const contentHash = resolveContentHash(rawResult);

    return IntelSignalSourceSchema.parse({
      id: resolveIntelSignalSourceId(finalSignalId, contentHash),
      signalId: finalSignalId,
      contentHash,
      sourceName: rawResult.sourceName,
      sourceType: rawResult.sourceType,
      title: rawResult.title,
      url: rawResult.url,
      snippet: rawResult.snippet,
      publishedAt: rawResult.publishedAt,
      fetchedAt: rawResult.fetchedAt,
      createdAt: input.createdAt
    });
  });
}
