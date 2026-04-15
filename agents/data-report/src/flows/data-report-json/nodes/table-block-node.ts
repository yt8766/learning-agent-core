import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import {
  buildSplitBlockArtifactCacheKey,
  buildSingleReportTableBlock,
  emitJsonNodeStage,
  getSplitBlockArtifactCache,
  setSplitBlockArtifactCache,
  type DataReportJsonNodePatch
} from './shared';

function buildCacheKey(state: DataReportJsonGraphState) {
  return buildSplitBlockArtifactCacheKey(state, 'tableBlockNode');
}

export async function runJsonTableBlockNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.tableBlockNode) {
    return handlers.tableBlockNode(state);
  }

  const cacheKey = buildCacheKey(state);
  const cached = state.strictLlmBrandNew
    ? undefined
    : getSplitBlockArtifactCache<NonNullable<DataReportJsonGraphState['sectionTableBlock']>>(
        cacheKey,
        state.disableCache
      );
  if (cached) {
    emitJsonNodeStage(state, {
      node: 'tableBlockNode',
      status: 'success',
      cacheHit: true,
      details: { source: 'local', cacheHit: true }
    });
    return {
      sectionTableBlock: cached,
      splitBlockCacheHit: true
    };
  }

  const sectionTableBlock = buildSingleReportTableBlock(state);
  let modelId: string | undefined;
  const attemptedLlm = false;
  const degraded = false;
  const fallbackReason: string | undefined = undefined;

  if (!state.strictLlmBrandNew) {
    setSplitBlockArtifactCache(cacheKey, sectionTableBlock, state.disableCache);
  }
  emitJsonNodeStage(state, {
    node: 'tableBlockNode',
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
    sectionTableBlock,
    warnings: state.warnings
  };
}
