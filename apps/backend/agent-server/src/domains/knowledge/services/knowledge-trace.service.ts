import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  KnowledgeRagEvent,
  KnowledgeRagEventName,
  KnowledgeRagTrace,
  KnowledgeTrace,
  KnowledgeTraceOperation,
  KnowledgeWorkbenchSpanName
} from '@agent/knowledge';

type KnowledgeTraceScalarAttribute = string | number | boolean | null;
type KnowledgeTraceAggregateAttribute = Record<string, number>;
export type KnowledgeTraceAttributes = Record<string, KnowledgeTraceScalarAttribute | KnowledgeTraceAggregateAttribute>;
const MAX_TRACES = 200;

export interface StartKnowledgeTraceInput {
  operation: KnowledgeTraceOperation;
  knowledgeBaseId?: string;
  documentId?: string;
}

export interface AddKnowledgeTraceSpanInput {
  spanId?: string;
  name: KnowledgeWorkbenchSpanName;
  startedAt?: string;
  endedAt?: string;
  status?: KnowledgeTrace['spans'][number]['status'];
  attributes?: KnowledgeTraceAttributes;
  error?: {
    code: string;
    message: string;
  };
}

@Injectable()
export class KnowledgeTraceService {
  private readonly traces = new Map<string, KnowledgeTrace>();

  startTrace(input: StartKnowledgeTraceInput): string {
    const traceId = `trace_${randomUUID()}`;
    const now = currentIsoTime();
    this.traces.set(traceId, {
      traceId,
      operation: input.operation,
      knowledgeBaseId: input.knowledgeBaseId,
      documentId: input.documentId,
      status: 'ok',
      startedAt: now,
      spans: []
    });
    this.trimTraceStore();
    return traceId;
  }

  addSpan(traceId: string, input: AddKnowledgeTraceSpanInput): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return;
    }
    const now = currentIsoTime();
    trace.spans.push({
      spanId: input.spanId ?? `span_${randomUUID()}`,
      name: input.name,
      startedAt: input.startedAt ?? now,
      endedAt: input.endedAt ?? input.startedAt ?? now,
      status: input.status,
      attributes: sanitizeTraceAttributes(input.attributes),
      error: input.error ? { ...input.error } : undefined
    });
  }

  projectSdkTrace(traceId: string, sdkTrace: KnowledgeRagTrace): void {
    for (const event of sdkTrace.events) {
      const spanName = toWorkbenchSpanName(event.name);
      if (!spanName) {
        continue;
      }
      this.addSpan(traceId, {
        spanId: `span_${event.eventId}`,
        name: spanName,
        startedAt: event.occurredAt,
        endedAt: event.occurredAt,
        status: event.error ? 'error' : toWorkbenchSpanStatus(sdkTrace.status),
        attributes: buildProjectedSdkTraceAttributes(sdkTrace, event),
        error: event.error
          ? {
              code: event.error.code,
              message: sanitizeTraceErrorMessage(event.error.message)
            }
          : undefined
      });
    }
  }

  finishTrace(traceId: string, status: KnowledgeTrace['status']): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return;
    }
    trace.status = status;
    trace.endedAt = currentIsoTime();
  }

  getTrace(traceId: string): KnowledgeTrace | undefined {
    return cloneTrace(this.traces.get(traceId));
  }

  listTraces(): KnowledgeTrace[] {
    return [...this.traces.values()]
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .map(trace => cloneTrace(trace))
      .filter((trace): trace is KnowledgeTrace => Boolean(trace));
  }

  private trimTraceStore(): void {
    if (this.traces.size <= MAX_TRACES) {
      return;
    }
    const oldestTraceId = [...this.traces.values()].sort((left, right) =>
      left.startedAt.localeCompare(right.startedAt)
    )[0]?.traceId;
    if (oldestTraceId) {
      this.traces.delete(oldestTraceId);
    }
  }
}

function currentIsoTime(): string {
  return new Date().toISOString();
}

function sanitizeTraceAttributes(
  attributes: KnowledgeTraceAttributes | undefined
): KnowledgeTraceAttributes | undefined {
  if (!attributes) {
    return undefined;
  }
  const sanitized: KnowledgeTraceAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (isSensitiveAttributeKey(key)) {
      continue;
    }
    if (isTraceAttributeValue(value)) {
      sanitized[key] = value;
    } else if (isPlainRecord(value)) {
      sanitized[key] = sanitizePlainRecord(value);
    }
  }
  return sanitized;
}

function isPlainRecord(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(v => typeof v === 'number' && Number.isFinite(v));
}

function sanitizePlainRecord(record: Record<string, number>): Record<string, number> {
  const sanitized: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!isSensitiveAttributeKey(key) && typeof value === 'number' && Number.isFinite(value)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function buildProjectedSdkTraceAttributes(
  sdkTrace: KnowledgeRagTrace,
  event: KnowledgeRagEvent
): KnowledgeTraceAttributes {
  return {
    sdkTraceId: sdkTrace.traceId,
    ...(sdkTrace.runId ? { sdkRunId: sdkTrace.runId } : {}),
    sdkEventName: event.name,
    sdkStage: event.stage,
    ...pickSafeScalarAttributes(event.attributes),
    ...buildRetrievalAttributes(event),
    ...buildGenerationAttributes(event),
    ...buildContextAssemblyAttributes(event)
  };
}

function buildRetrievalAttributes(event: KnowledgeRagEvent): KnowledgeTraceAttributes {
  if (!event.retrieval) {
    return {};
  }
  const diagnostics = event.retrieval.diagnostics;
  const selectionSummary = summarizeSelectionTrace(diagnostics?.selectionTrace);

  return {
    hitCount: event.retrieval.hits.length,
    citationCount: event.retrieval.citations.length,
    ...(event.retrieval.requestedTopK !== undefined ? { requestedTopK: event.retrieval.requestedTopK } : {}),
    ...(diagnostics?.retrievalMode ? { retrievalMode: diagnostics.retrievalMode } : {}),
    ...(diagnostics?.candidateCount !== undefined ? { candidateCount: diagnostics.candidateCount } : {}),
    ...(diagnostics?.selectedCount !== undefined ? { selectedCount: diagnostics.selectedCount } : {}),
    ...(diagnostics?.latencyMs !== undefined ? { latencyMs: diagnostics.latencyMs } : {}),
    ...(diagnostics?.fusionStrategy ? { fusionStrategy: diagnostics.fusionStrategy } : {}),
    ...selectionSummary
  };
}

function summarizeSelectionTrace(
  selectionTrace:
    | Array<{
        selected: boolean;
        reason?: string;
      }>
    | undefined
): { droppedCount: number; dropReasons: Record<string, number> } {
  const dropReasons: Record<string, number> = {};

  for (const entry of selectionTrace ?? []) {
    if (entry.selected) {
      continue;
    }

    const reason = entry.reason ?? 'unknown';
    dropReasons[reason] = (dropReasons[reason] ?? 0) + 1;
  }

  return {
    droppedCount: Object.values(dropReasons).reduce((sum, count) => sum + count, 0),
    dropReasons
  };
}

function buildGenerationAttributes(event: KnowledgeRagEvent): KnowledgeTraceAttributes {
  if (!event.generation) {
    return {};
  }

  return {
    citedChunkCount: event.generation.citedChunkIds?.length ?? 0,
    ...(event.generation.groundedCitationRate !== undefined
      ? { groundedCitationRate: event.generation.groundedCitationRate }
      : {})
  };
}

function buildContextAssemblyAttributes(event: KnowledgeRagEvent): KnowledgeTraceAttributes {
  if (event.name !== 'runtime.context_assembly.complete') {
    return {};
  }

  return {
    contextAssembled:
      typeof event.attributes?.['contextAssembled'] === 'boolean' ? event.attributes.contextAssembled : null,
    contextLength: typeof event.attributes?.['contextLength'] === 'number' ? event.attributes.contextLength : null
  };
}

function pickSafeScalarAttributes(attributes: KnowledgeRagEvent['attributes']): KnowledgeTraceAttributes {
  const projected: KnowledgeTraceAttributes = {};
  if (!attributes) {
    return projected;
  }
  for (const [key, value] of Object.entries(attributes)) {
    if (isSensitiveAttributeKey(key)) {
      continue;
    }
    if (isTraceAttributeValue(value)) {
      projected[key] = value;
    }
  }
  return projected;
}

function isTraceAttributeValue(value: unknown): value is KnowledgeTraceScalarAttribute {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null;
}

function toWorkbenchSpanName(name: KnowledgeRagEventName): KnowledgeWorkbenchSpanName | undefined {
  switch (name) {
    case 'runtime.query.receive':
    case 'runtime.query.preprocess':
      return 'route';
    case 'runtime.retrieval.start':
    case 'runtime.retrieval.complete':
      return 'retrieve';
    case 'runtime.post_retrieval.select':
      return 'rerank';
    case 'runtime.context_assembly.complete':
      return 'assemble-context';
    case 'runtime.generation.complete':
      return 'generate';
    case 'runtime.run.fail':
      return 'generate';
    default:
      return undefined;
  }
}

function toWorkbenchSpanStatus(status: KnowledgeRagTrace['status']): KnowledgeTrace['spans'][number]['status'] {
  switch (status) {
    case 'failed':
      return 'error';
    case 'canceled':
      return 'cancelled';
    default:
      return 'ok';
  }
}

function isSensitiveAttributeKey(key: string): boolean {
  return /secret|token|password|authorization|api[-_]?key/i.test(key);
}

function sanitizeTraceErrorMessage(message: string): string {
  if (containsSensitiveTraceText(message)) {
    return 'Knowledge RAG SDK event failed.';
  }

  return message.slice(0, 240);
}

function containsSensitiveTraceText(message: string): boolean {
  return /secret|token|password|authorization|api[-_]?key|bearer\s+[^\s]+|sk-[a-z0-9_-]+|raw\s+vendor/i.test(message);
}

function cloneTrace(trace: KnowledgeTrace | undefined): KnowledgeTrace | undefined {
  if (!trace) {
    return undefined;
  }
  return {
    ...trace,
    spans: trace.spans.map(span => ({
      ...span,
      attributes: span.attributes ? { ...span.attributes } : undefined,
      error: span.error ? { ...span.error } : undefined
    }))
  };
}
