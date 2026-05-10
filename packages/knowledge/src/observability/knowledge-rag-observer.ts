import {
  KnowledgeRagEventSchema,
  KnowledgeRagTraceSchema,
  type RetrievalHit,
  type KnowledgeRagEvent,
  type KnowledgeRagTrace,
  type KnowledgeRagTraceStatus
} from '../contracts';
import type { HybridRetrievalDiagnostics } from '../runtime/types/retrieval-runtime.types';

export interface KnowledgeRagTraceStartInput extends Omit<KnowledgeRagTrace, 'events' | 'status' | 'endedAt'> {
  status?: Extract<KnowledgeRagTraceStatus, 'running'>;
}

export interface KnowledgeRagTraceFinishInput extends Partial<
  Omit<KnowledgeRagTrace, 'traceId' | 'events' | 'operation' | 'startedAt'>
> {
  status: Exclude<KnowledgeRagTraceStatus, 'running'>;
}

export interface KnowledgeRagObserver {
  startTrace(input: KnowledgeRagTraceStartInput): KnowledgeRagTrace;
  recordEvent(input: unknown): KnowledgeRagEvent;
  finishTrace(traceId: string, input: KnowledgeRagTraceFinishInput): KnowledgeRagTrace;
  exportTrace(traceId: string): KnowledgeRagTrace;
  listTraces(): KnowledgeRagTrace[];
}

export class InMemoryKnowledgeRagObserver implements KnowledgeRagObserver {
  private readonly traces = new Map<string, KnowledgeRagTrace>();

  startTrace(input: KnowledgeRagTraceStartInput): KnowledgeRagTrace {
    const trace = KnowledgeRagTraceSchema.parse({
      ...input,
      status: input.status ?? 'running',
      events: []
    });

    assertNoSensitiveAttributeKeys(trace.attributes);
    this.traces.set(trace.traceId, trace);

    return cloneTrace(trace);
  }

  recordEvent(input: unknown): KnowledgeRagEvent {
    const event = KnowledgeRagEventSchema.parse(input);
    assertNoSensitiveAttributeKeys(event.attributes);

    const trace = this.getTrace(event.traceId);
    const nextTrace = KnowledgeRagTraceSchema.parse({
      ...trace,
      events: [...trace.events, event]
    });

    this.traces.set(trace.traceId, nextTrace);

    return KnowledgeRagEventSchema.parse(event);
  }

  finishTrace(traceId: string, input: KnowledgeRagTraceFinishInput): KnowledgeRagTrace {
    const trace = this.getTrace(traceId);
    const nextTrace = KnowledgeRagTraceSchema.parse({
      ...trace,
      ...input,
      traceId: trace.traceId,
      operation: trace.operation,
      startedAt: trace.startedAt,
      events: trace.events
    });

    assertNoSensitiveAttributeKeys(nextTrace.attributes);
    this.traces.set(trace.traceId, nextTrace);

    return cloneTrace(nextTrace);
  }

  exportTrace(traceId: string): KnowledgeRagTrace {
    return cloneTrace(this.getTrace(traceId));
  }

  listTraces(): KnowledgeRagTrace[] {
    return Array.from(this.traces.values(), trace => cloneTrace(trace));
  }

  private getTrace(traceId: string): KnowledgeRagTrace {
    const trace = this.traces.get(traceId);

    if (!trace) {
      throw new Error(`Knowledge RAG trace not found: ${traceId}`);
    }

    return trace;
  }
}

export function createInMemoryKnowledgeRagObserver(): KnowledgeRagObserver {
  return new InMemoryKnowledgeRagObserver();
}

export function startKnowledgeRagTrace(
  observer: KnowledgeRagObserver,
  input: KnowledgeRagTraceStartInput
): KnowledgeRagTrace {
  return observer.startTrace(input);
}

export function tryStartKnowledgeRagTrace(
  observer: KnowledgeRagObserver | undefined,
  input: KnowledgeRagTraceStartInput
): KnowledgeRagTrace | undefined {
  if (!observer) {
    return undefined;
  }

  try {
    return startKnowledgeRagTrace(observer, input);
  } catch {
    return undefined;
  }
}

export function recordKnowledgeRagEvent(observer: KnowledgeRagObserver, input: unknown): KnowledgeRagEvent {
  return observer.recordEvent(input);
}

export function tryRecordKnowledgeRagEvent(
  observer: KnowledgeRagObserver | undefined,
  input: unknown
): KnowledgeRagEvent | undefined {
  if (!observer) {
    return undefined;
  }

  try {
    return recordKnowledgeRagEvent(observer, input);
  } catch {
    return undefined;
  }
}

export function finishKnowledgeRagTrace(
  observer: KnowledgeRagObserver,
  traceId: string,
  input: KnowledgeRagTraceFinishInput
): KnowledgeRagTrace {
  return observer.finishTrace(traceId, input);
}

export function tryFinishKnowledgeRagTrace(
  observer: KnowledgeRagObserver | undefined,
  traceId: string,
  input: KnowledgeRagTraceFinishInput
): KnowledgeRagTrace | undefined {
  if (!observer) {
    return undefined;
  }

  try {
    return finishKnowledgeRagTrace(observer, traceId, input);
  } catch {
    return undefined;
  }
}

export function exportKnowledgeRagTrace(observer: KnowledgeRagObserver, traceId: string): KnowledgeRagTrace {
  return observer.exportTrace(traceId);
}

export function listKnowledgeRagTraces(observer: KnowledgeRagObserver): KnowledgeRagTrace[] {
  return observer.listTraces();
}

export function buildKnowledgeRagEventId(traceId: string, name: string): string {
  return `${traceId}:${name}`;
}

export function toKnowledgeRagTraceHits(hits: RetrievalHit[]): Array<{
  chunkId: string;
  documentId: string;
  sourceId: string;
  knowledgeBaseId?: string;
  rank: number;
  score?: number;
  title?: string;
  uri?: string;
  citation?: RetrievalHit['citation'];
}> {
  return hits.map((hit, index) => ({
    chunkId: hit.chunkId,
    documentId: hit.documentId,
    sourceId: hit.sourceId,
    knowledgeBaseId: hit.knowledgeBaseId,
    rank: index + 1,
    score: hit.score,
    title: hit.title,
    uri: hit.uri,
    citation: hit.citation
  }));
}

export function collectKnowledgeRagTraceCitations(hits: RetrievalHit[]): Array<RetrievalHit['citation']> {
  return hits.map(hit => hit.citation);
}

export function buildKnowledgeRagTraceRetrievalDiagnostics(input: {
  hybrid?: HybridRetrievalDiagnostics;
  candidateCount: number;
  selectedCount: number;
  latencyMs: number;
}): {
  retrievalMode?: HybridRetrievalDiagnostics['retrievalMode'];
  enabledRetrievers?: HybridRetrievalDiagnostics['enabledRetrievers'];
  failedRetrievers?: HybridRetrievalDiagnostics['failedRetrievers'];
  fusionStrategy?: HybridRetrievalDiagnostics['fusionStrategy'];
  candidateCount: number;
  selectedCount: number;
  latencyMs: number;
} {
  return {
    retrievalMode: input.hybrid?.retrievalMode,
    enabledRetrievers: input.hybrid?.enabledRetrievers,
    failedRetrievers: input.hybrid?.failedRetrievers,
    fusionStrategy: input.hybrid?.fusionStrategy,
    candidateCount: input.hybrid?.candidateCount ?? input.candidateCount,
    selectedCount: input.selectedCount,
    latencyMs: input.latencyMs
  };
}

export function toKnowledgeRagTraceError(
  error: unknown,
  stage: 'pre-retrieval' | 'retrieval' | 'post-retrieval' | 'context-assembly' | 'generation'
): {
  code: string;
  message: string;
  retryable: boolean;
  stage: 'pre-retrieval' | 'retrieval' | 'post-retrieval' | 'context-assembly' | 'generation';
} {
  return {
    code: error instanceof Error ? error.name || 'Error' : 'UnknownError',
    message: error instanceof Error ? error.message : 'Unknown knowledge RAG runtime error',
    retryable: false,
    stage
  };
}

export function mergeKnowledgeHybridDiagnostics(
  diagnostics: HybridRetrievalDiagnostics[]
): HybridRetrievalDiagnostics | undefined {
  if (diagnostics.length === 0) {
    return undefined;
  }

  const enabledRetrievers = new Set<HybridRetrievalDiagnostics['enabledRetrievers'][number]>();
  const failedRetrievers = new Set<HybridRetrievalDiagnostics['failedRetrievers'][number]>();
  let candidateCount = 0;
  let hasKeywordSuccess = false;
  let hasVectorSuccess = false;

  for (const item of diagnostics) {
    const itemFailedRetrievers = item.failedRetrievers ?? [];
    const itemEnabledRetrievers =
      item.enabledRetrievers ??
      (item.retrievalMode === 'hybrid'
        ? ['keyword', 'vector']
        : item.retrievalMode === 'keyword-only'
          ? ['keyword']
          : item.retrievalMode === 'vector-only'
            ? ['vector']
            : []);

    itemEnabledRetrievers.forEach(retriever => enabledRetrievers.add(retriever));
    itemFailedRetrievers.forEach(retriever => failedRetrievers.add(retriever));
    candidateCount += item.candidateCount ?? 0;
    hasKeywordSuccess ||= itemEnabledRetrievers.includes('keyword') && !itemFailedRetrievers.includes('keyword');
    hasVectorSuccess ||= itemEnabledRetrievers.includes('vector') && !itemFailedRetrievers.includes('vector');
  }

  const retrievalMode =
    hasKeywordSuccess && hasVectorSuccess
      ? 'hybrid'
      : hasKeywordSuccess
        ? 'keyword-only'
        : hasVectorSuccess
          ? 'vector-only'
          : 'none';

  return {
    retrievalMode,
    enabledRetrievers: Array.from(enabledRetrievers),
    failedRetrievers: Array.from(failedRetrievers),
    fusionStrategy: diagnostics.find(item => item.fusionStrategy)?.fusionStrategy ?? 'rrf',
    prefilterApplied: diagnostics.some(item => item.prefilterApplied ?? false),
    candidateCount
  };
}

function cloneTrace(trace: KnowledgeRagTrace): KnowledgeRagTrace {
  return KnowledgeRagTraceSchema.parse(trace);
}

function assertNoSensitiveAttributeKeys(value: unknown): void {
  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoSensitiveAttributeKeys(item);
    }

    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (/secret|token|password|authorization|api[-_]?key/i.test(key)) {
      throw new Error('Trace attributes must not include raw secret-bearing keys');
    }

    assertNoSensitiveAttributeKeys(child);
  }
}
