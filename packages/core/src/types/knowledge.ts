import type { EvidenceRecord } from '../memory';
import { EvidenceRecordSchema, MemoryRecordSchema, RuleRecordSchema } from '../memory';

export interface ExecutionTrace {
  node: string;
  at: string;
  summary: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  specialistId?: string;
  role?: string;
  latencyMs?: number;
  tokenUsage?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  status?: 'success' | 'timeout' | 'rejected' | 'running' | 'failed';
  revisionCount?: number;
  modelUsed?: string;
  isFallback?: boolean;
  fallbackReason?: string;
  data?: Record<string, unknown>;
}

export function isCitationEvidenceSource(source: Pick<EvidenceRecord, 'sourceType' | 'sourceUrl' | 'trustClass'>) {
  if (
    source.sourceType === 'freshness_meta' ||
    source.sourceType === 'web_search_result' ||
    source.sourceType === 'web_research_plan'
  ) {
    return false;
  }

  if (source.sourceUrl) {
    return true;
  }

  return source.sourceType === 'document' || source.sourceType === 'web';
}

export { MemoryRecordSchema, RuleRecordSchema, EvidenceRecordSchema };
