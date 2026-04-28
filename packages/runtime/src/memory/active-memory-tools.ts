import type {
  ArchivalMemorySearchInput,
  CoreMemoryAppendInput,
  CoreMemoryEntry,
  CoreMemoryReplaceInput,
  MemorySearchResult,
  MemorySearchService
} from '@agent/memory';

import { buildRuntimeMemorySearchRequest } from './runtime-memory-search';

interface CoreMemoryMutationOptions {
  maxEntries?: number;
  now?: string;
}

export async function archivalMemorySearch(
  memorySearchService: MemorySearchService | undefined,
  input: ArchivalMemorySearchInput
): Promise<MemorySearchResult | undefined> {
  if (!memorySearchService) {
    return undefined;
  }

  return memorySearchService.search(input.request);
}

export function coreMemoryAppend(
  current: CoreMemoryEntry[],
  input: CoreMemoryAppendInput,
  options: CoreMemoryMutationOptions = {}
): CoreMemoryEntry[] {
  return trimCoreMemory(
    [
      ...current.filter(entry => !isSameCoreMemoryEntry(entry, input.entry)),
      materializeCoreMemoryEntry(input.entry, options.now)
    ],
    options.maxEntries
  );
}

export function coreMemoryReplace(
  current: CoreMemoryEntry[],
  input: CoreMemoryReplaceInput,
  options: CoreMemoryMutationOptions = {}
): CoreMemoryEntry[] {
  const nextEntry = materializeCoreMemoryEntry(
    { ...input.entry, auditReason: input.entry.auditReason ?? input.auditReason },
    options.now
  );
  const replaced = current.map(entry => (shouldReplaceCoreMemoryEntry(entry, input) ? nextEntry : entry));
  if (replaced.some(entry => entry.id === nextEntry.id)) {
    return trimCoreMemory(replaced, options.maxEntries);
  }
  return trimCoreMemory([...replaced, nextEntry], options.maxEntries);
}

export async function archivalMemorySearchByParams(
  memorySearchService: MemorySearchService | undefined,
  params: Parameters<typeof buildRuntimeMemorySearchRequest>[0]
): Promise<MemorySearchResult | undefined> {
  return archivalMemorySearch(memorySearchService, {
    action: 'archival_memory_search',
    request: buildRuntimeMemorySearchRequest(params)
  });
}

function materializeCoreMemoryEntry(
  entry: CoreMemoryAppendInput['entry'] | CoreMemoryReplaceInput['entry'],
  now = new Date().toISOString()
): CoreMemoryEntry {
  return {
    ...entry,
    id: `${entry.kind}:${entry.scopeType}:${entry.relatedMemoryId ?? entry.summary}`,
    updatedAt: now
  } as CoreMemoryEntry;
}

function trimCoreMemory(entries: CoreMemoryEntry[], maxEntries = 8) {
  return entries.slice(-Math.max(1, maxEntries));
}

function isSameCoreMemoryEntry(existing: CoreMemoryEntry, incoming: Omit<CoreMemoryEntry, 'id' | 'updatedAt'>) {
  return (
    existing.kind === incoming.kind &&
    existing.scopeType === incoming.scopeType &&
    existing.summary === incoming.summary &&
    existing.relatedMemoryId === incoming.relatedMemoryId
  );
}

function shouldReplaceCoreMemoryEntry(existing: CoreMemoryEntry, input: CoreMemoryReplaceInput) {
  if (input.targetId) {
    return existing.id === input.targetId;
  }
  if (input.targetKind) {
    return existing.kind === input.targetKind && existing.scopeType === input.entry.scopeType;
  }
  return existing.kind === input.entry.kind && existing.scopeType === input.entry.scopeType;
}
