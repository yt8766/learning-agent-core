import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { KnowledgeTrace, KnowledgeTraceOperation, KnowledgeWorkbenchSpanName } from '@agent/knowledge';

export type KnowledgeTraceAttributes = Record<string, string | number | boolean | null>;
const MAX_TRACES = 200;

export interface StartKnowledgeTraceInput {
  operation: KnowledgeTraceOperation;
  knowledgeBaseId?: string;
  documentId?: string;
}

export interface AddKnowledgeTraceSpanInput {
  name: KnowledgeWorkbenchSpanName;
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
      spanId: `span_${randomUUID()}`,
      name: input.name,
      startedAt: now,
      endedAt: now,
      status: input.status,
      attributes: sanitizeTraceAttributes(input.attributes),
      error: input.error ? { ...input.error } : undefined
    });
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
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
      sanitized[key] = value;
    }
  }
  return sanitized;
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
