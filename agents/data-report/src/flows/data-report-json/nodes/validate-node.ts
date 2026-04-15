import { parseDataReportJsonSchema } from '../schemas/report-page-schema';
import type { DataReportJsonGraphHandlers, DataReportJsonGraphState } from '../../../types/data-report-json';
import { emitJsonNodeStage, type DataReportJsonNodePatch } from './shared';

export async function runJsonValidateNode(
  state: DataReportJsonGraphState,
  handlers: DataReportJsonGraphHandlers = {}
): Promise<DataReportJsonNodePatch> {
  if (handlers.validateNode) {
    return handlers.validateNode(state);
  }

  if (!state.schema) {
    throw new Error('data-report-json validateNode requires page schema context.');
  }

  const schema = parseDataReportJsonSchema(state.schema);
  emitJsonNodeStage(state, {
    node: 'validateNode',
    status: 'success',
    details: { sectionCount: schema.sections.length }
  });
  return { schema };
}
