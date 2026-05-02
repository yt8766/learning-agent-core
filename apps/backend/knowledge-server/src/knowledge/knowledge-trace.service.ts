import { Injectable } from '@nestjs/common';
import type { KnowledgeTrace, KnowledgeTraceOperation, KnowledgeWorkbenchSpanName } from '@agent/knowledge';
import { randomUUID } from 'node:crypto';

export type KnowledgeTraceAttributes = Record<string, string | number | boolean | null>;

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
      attributes: input.attributes,
      error: input.error
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
    return this.traces.get(traceId);
  }

  listTraces(): KnowledgeTrace[] {
    return [...this.traces.values()].sort((left, right) => right.startedAt.localeCompare(left.startedAt));
  }
}

function currentIsoTime(): string {
  return new Date().toISOString();
}
