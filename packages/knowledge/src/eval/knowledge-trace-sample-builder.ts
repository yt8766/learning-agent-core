import { KnowledgeEvalSampleSchema, type KnowledgeEvalSample, type KnowledgeRagTrace } from '../contracts';

export type KnowledgeRagTraceEvalSampleSignal =
  | 'runtime_run_failed'
  | 'empty_retrieval'
  | 'high_retrieval_drop_ratio'
  | 'low_grounded_citation_rate'
  | 'indexing_quality_gate_failed';

export interface KnowledgeTraceEvalSampleBuilderOptions {
  datasetId?: string;
  createdAt?: string;
  sampleIdPrefix?: string;
  lowGroundedCitationRateThreshold?: number;
  selectedCandidateRatioThreshold?: number;
}

export interface KnowledgeRagTraceEvalMetric {
  traceId: string;
  name: string;
  value: number;
  unit?: string;
  stage?: string;
  attributes?: Record<string, unknown>;
}

export type KnowledgeRagTraceEvalInput = KnowledgeRagTrace & {
  metrics?: KnowledgeRagTraceEvalMetric[];
};

interface SignalDescriptor {
  signal: KnowledgeRagTraceEvalSampleSignal;
  attributes?: Record<string, string | number | boolean | null>;
}

const DEFAULT_LOW_GROUNDED_CITATION_RATE_THRESHOLD = 0.5;
const DEFAULT_SELECTED_CANDIDATE_RATIO_THRESHOLD = 0.25;

export function buildKnowledgeEvalSamplesFromTraces(
  traces: KnowledgeRagTraceEvalInput[],
  options: KnowledgeTraceEvalSampleBuilderOptions = {}
): KnowledgeEvalSample[] {
  return traces.flatMap(trace =>
    collectSignalDescriptors(trace, options).map(descriptor => buildSample(trace, descriptor, options))
  );
}

function collectSignalDescriptors(
  trace: KnowledgeRagTraceEvalInput,
  options: KnowledgeTraceEvalSampleBuilderOptions
): SignalDescriptor[] {
  const descriptors: SignalDescriptor[] = [];

  const isRuntimeFailure = trace.status === 'failed' || trace.events.some(event => event.name === 'runtime.run.fail');
  if (isRuntimeFailure) {
    descriptors.push({ signal: 'runtime_run_failed' });
  }

  const hitCount = getMetricValue(trace, 'retrieval.hit_count') ?? trace.retrieval?.hits.length;
  if (!isRuntimeFailure && hitCount === 0) {
    descriptors.push({ signal: 'empty_retrieval' });
  }

  const dropRatioDescriptor = buildHighDropRatioDescriptor(trace, options);
  if (dropRatioDescriptor) {
    descriptors.push(dropRatioDescriptor);
  }

  const groundedCitationRate =
    getMetricValue(trace, 'generation.grounded_citation_rate') ?? trace.generation?.groundedCitationRate;
  const lowGroundedCitationRateThreshold =
    options.lowGroundedCitationRateThreshold ?? DEFAULT_LOW_GROUNDED_CITATION_RATE_THRESHOLD;
  if (groundedCitationRate !== undefined && groundedCitationRate < lowGroundedCitationRateThreshold) {
    descriptors.push({
      signal: 'low_grounded_citation_rate',
      attributes: { groundedCitationRate, lowGroundedCitationRateThreshold }
    });
  }

  const qualityGateDescriptor = buildIndexingQualityGateDescriptor(trace);
  if (qualityGateDescriptor) {
    descriptors.push(qualityGateDescriptor);
  }

  return descriptors;
}

function buildHighDropRatioDescriptor(
  trace: KnowledgeRagTraceEvalInput,
  options: KnowledgeTraceEvalSampleBuilderOptions
): SignalDescriptor | undefined {
  const candidateCount =
    getMetricValue(trace, 'retrieval.candidate_count') ?? trace.retrieval?.diagnostics?.candidateCount;
  const selectedCount =
    getMetricValue(trace, 'retrieval.selected_count') ??
    trace.retrieval?.diagnostics?.selectedCount ??
    trace.retrieval?.hits.length;

  if (candidateCount === undefined || selectedCount === undefined || candidateCount <= 0) {
    return undefined;
  }

  const selectedCandidateRatio = selectedCount / candidateCount;
  const threshold = options.selectedCandidateRatioThreshold ?? DEFAULT_SELECTED_CANDIDATE_RATIO_THRESHOLD;
  if (selectedCandidateRatio >= threshold) {
    return undefined;
  }

  return {
    signal: 'high_retrieval_drop_ratio',
    attributes: {
      candidateCount,
      selectedCount,
      selectedCandidateRatio,
      selectedCandidateRatioThreshold: threshold
    }
  };
}

function buildIndexingQualityGateDescriptor(trace: KnowledgeRagTraceEvalInput): SignalDescriptor | undefined {
  const failedQualityGateMetric = trace.metrics?.find(
    metric => metric.name.startsWith('indexing.quality_gate.') && getAttributeString(metric, 'status') === 'failed'
  );
  if (failedQualityGateMetric) {
    return {
      signal: 'indexing_quality_gate_failed',
      attributes: {
        metricName: failedQualityGateMetric.name,
        metricValue: failedQualityGateMetric.value,
        qualityGate: getAttributeString(failedQualityGateMetric, 'qualityGate') ?? failedQualityGateMetric.name,
        qualityGateStatus: 'failed'
      }
    };
  }

  if (trace.operation === 'indexing.run' && trace.events.some(event => event.name === 'indexing.run.fail')) {
    return {
      signal: 'indexing_quality_gate_failed',
      attributes: { qualityGateStatus: 'failed' }
    };
  }

  return undefined;
}

function buildSample(
  trace: KnowledgeRagTraceEvalInput,
  descriptor: SignalDescriptor,
  options: KnowledgeTraceEvalSampleBuilderOptions
): KnowledgeEvalSample {
  const sampleId = [options.sampleIdPrefix, trace.traceId, descriptor.signal].filter(Boolean).join(':');

  return KnowledgeEvalSampleSchema.parse({
    sampleId,
    datasetId: options.datasetId,
    traceId: trace.traceId,
    createdAt: options.createdAt ?? trace.endedAt ?? trace.startedAt,
    query: trace.query ?? { text: `${trace.operation} ${trace.traceId}` },
    expected: {},
    observed: {
      retrievalHits: trace.retrieval?.hits ?? [],
      citations: trace.retrieval?.citations ?? [],
      diagnostics: trace.retrieval?.diagnostics ?? trace.diagnostics
    },
    feedback: trace.feedback,
    attributes: {
      signal: descriptor.signal,
      sourceOperation: trace.operation,
      sourceStatus: trace.status,
      ...descriptor.attributes
    }
  });
}

function getMetricValue(trace: KnowledgeRagTraceEvalInput, name: string): number | undefined {
  return trace.metrics?.find(metric => metric.name === name)?.value;
}

function getAttributeString(metric: KnowledgeRagTraceEvalMetric, key: string): string | undefined {
  const value = metric.attributes?.[key];
  return typeof value === 'string' ? value : undefined;
}
