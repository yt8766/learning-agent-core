import { buildDataReportScaffold } from '@agent/report-kit';

import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import {
  emitFileStageEvents,
  routeNameFromGoal,
  scaffoldFilesToSandpackFiles,
  shouldDeterministicMultiAssembly,
  traceNode,
  type NodePatch
} from './shared';
import { buildFilePlans, generateSingleReportPlannedFiles, isSingleReport } from './single-report-file-generator';

export async function runTypeNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.typeNode) {
    return traceNode(state, 'typeNode', await handlers.typeNode(state));
  }

  const mocked = await tryExecuteMock(state, 'typeNode', 'data-report/type-node.json', data => ({
    files: scaffoldFilesToSandpackFiles(
      Array.isArray((data as { files?: Array<{ path: string; content: string }> }).files)
        ? (data as { files: Array<{ path: string; content: string }> }).files
        : []
    )
  }));
  if (mocked && 'files' in mocked) {
    emitFileStageEvents(state, mocked.files as Record<string, string>, 'leaf');
    return traceNode(state, 'typeNode', mocked as NodePatch);
  }

  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? routeNameFromGoal(state.goal);
  const typesPath = String(state.structure?.typesFile ?? `/src/types/data/${routeName}.ts`);
  const singleReportFiles = isSingleReport(state)
    ? await generateSingleReportPlannedFiles(
        state,
        buildFilePlans(state).leafPlans.filter(plan => plan.path === typesPath)
      )
    : undefined;
  const shouldEmitFiles = shouldDeterministicMultiAssembly(state);
  const scaffoldFiles =
    state.deterministicAssets?.scaffoldFiles ??
    (shouldEmitFiles && state.blueprint
      ? scaffoldFilesToSandpackFiles(
          buildDataReportScaffold({
            goal: state.goal,
            baseDir: state.blueprint.baseDir,
            templateId: state.blueprint.templateId
          }).files
        )
      : undefined);
  const files =
    singleReportFiles ??
    (shouldEmitFiles
      ? Object.fromEntries(
          Object.entries(scaffoldFiles ?? {}).filter(([path]) =>
            state.blueprint?.scope === 'multiple' ? /\/types\/data\/[^/]+\.ts$/.test(path) : path === typesPath
          )
        )
      : undefined);
  if (!singleReportFiles) {
    emitFileStageEvents(state, files, 'leaf');
  }

  return traceNode(state, 'typeNode', {
    types: {
      plannedFile: typesPath,
      entities: ['ReportFilters', 'ReportMetric', 'ReportChartPoint', 'ReportTableRow']
    },
    files
  });
}
