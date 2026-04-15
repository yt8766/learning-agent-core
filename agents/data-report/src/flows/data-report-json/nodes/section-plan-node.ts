import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import {
  buildSplitBlockArtifactCacheKey,
  buildSingleReportSectionPlan,
  emitJsonNodeStage,
  getSplitBlockArtifactCache,
  setSplitBlockArtifactCache,
  type DataReportJsonNodePatch
} from './shared';

function buildCacheKey(state: DataReportJsonGraphState) {
  return buildSplitBlockArtifactCacheKey(state, 'sectionPlanNode');
}

export async function runJsonSectionPlanNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.sectionPlanNode) {
    return handlers.sectionPlanNode(state);
  }

  const cacheKey = buildCacheKey(state);
  const cached = getSplitBlockArtifactCache<NonNullable<DataReportJsonGraphState['sectionPlan']>>(
    cacheKey,
    state.disableCache
  );
  if (cached) {
    emitJsonNodeStage(state, {
      node: 'sectionPlanNode',
      status: 'success',
      cacheHit: true,
      details: {
        source: 'local',
        cacheHit: true
      }
    });
    return {
      sectionPlan: cached,
      splitBlockCacheHit: true
    };
  }

  const sectionPlan = buildSingleReportSectionPlan(state);
  setSplitBlockArtifactCache(cacheKey, sectionPlan, state.disableCache);
  emitJsonNodeStage(state, {
    node: 'sectionPlanNode',
    status: 'success',
    cacheHit: false,
    details: {
      source: 'local',
      cacheHit: false
    }
  });
  return { sectionPlan };
}
