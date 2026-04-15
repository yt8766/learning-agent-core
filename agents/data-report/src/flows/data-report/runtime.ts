import { createDataReportSandpackGraph } from '../../graphs/data-report.graph';
import type { DataReportSandpackGraphState } from '../../types/data-report';

export async function executeDataReportSandpackGraph(input: DataReportSandpackGraphState) {
  return createDataReportSandpackGraph().compile().invoke(input);
}
