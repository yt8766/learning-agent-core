import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import {
  buildSplitBlockArtifactCacheKey,
  buildSingleReportMetricsBlock,
  emitJsonNodeStage,
  getSplitBlockArtifactCache,
  setSplitBlockArtifactCache,
  type DataReportJsonNodePatch
} from './shared';

function buildCacheKey(state: DataReportJsonGraphState) {
  return buildSplitBlockArtifactCacheKey(state, 'metricsBlockNode');
}

export async function runJsonMetricsBlockNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.metricsBlockNode) {
    return handlers.metricsBlockNode(state);
  }

  const cacheKey = buildCacheKey(state);
  const cached = state.strictLlmBrandNew
    ? undefined
    : getSplitBlockArtifactCache<NonNullable<DataReportJsonGraphState['sectionMetricsBlock']>>(
        cacheKey,
        state.disableCache
      );
  if (cached) {
    emitJsonNodeStage(state, {
      node: 'metricsBlockNode',
      status: 'success',
      cacheHit: true,
      details: { source: 'local', cacheHit: true }
    });
    return {
      sectionMetricsBlock: cached,
      splitBlockCacheHit: true
    };
  }

  const sectionMetricsBlock = buildSingleReportMetricsBlock(state);
  let modelId: string | undefined;
  const attemptedLlm = false;
  const degraded = false;
  const fallbackReason: string | undefined = undefined;

  if (!state.strictLlmBrandNew) {
    setSplitBlockArtifactCache(cacheKey, sectionMetricsBlock, state.disableCache);
  }
  emitJsonNodeStage(state, {
    node: 'metricsBlockNode',
    status: 'success',
    cacheHit: false,
    modelId,
    details: {
      source: modelId ? 'llm' : 'local',
      cacheHit: false,
      modelId,
      attemptedLlm,
      degraded,
      fallbackReason
    }
  });
  return {
    sectionMetricsBlock,
    warnings: state.warnings
  };
}
