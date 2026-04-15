import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { emitJsonNodeStage, type DataReportJsonNodePatch } from './shared';

export async function runJsonSectionAssembleNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.sectionAssembleNode) {
    return handlers.sectionAssembleNode(state);
  }

  if (!state.sectionPlan) {
    throw new Error('data-report-json sectionAssembleNode requires a sectionPlan.');
  }

  const blocks = [state.sectionMetricsBlock, state.sectionChartBlock, state.sectionTableBlock].filter(
    (block): block is NonNullable<typeof block> => Boolean(block)
  );
  if (!blocks.length) {
    throw new Error('data-report-json sectionAssembleNode requires at least one block.');
  }

  emitJsonNodeStage(state, {
    node: 'sectionAssembleNode',
    status: 'success',
    details: {
      blockCount: blocks.length,
      source: 'local'
    }
  });
  return {
    sections: [
      {
        ...state.sectionPlan,
        blocks
      }
    ]
  };
}
