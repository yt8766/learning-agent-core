import { buildDataReportScaffold } from '@agent/report-kit';

import { buildDataReportPlanningContext, DATA_REPORT_SERVICE_PROMPT } from '../prompts';
import { DataReportServiceSchema } from '../schemas';
import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import { generateDataReportNodeObject } from './planning-node-helpers';
import {
  emitFileStageEvents,
  pascalCase,
  routeNameFromGoal,
  scaffoldFilesToSandpackFiles,
  shouldDeterministicMultiAssembly,
  traceNode,
  type NodePatch
} from './shared';
import { buildFilePlans, generateSingleReportPlannedFiles, isSingleReport } from './single-report-file-generator';

export async function runServiceNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.serviceNode) {
    return traceNode(state, 'serviceNode', await handlers.serviceNode(state));
  }

  const mocked = await tryExecuteMock(state, 'serviceNode', 'data-report/service-node.json', data => {
    const files = Array.isArray((data as { files?: Array<{ path: string; content: string }> }).files)
      ? scaffoldFilesToSandpackFiles((data as { files: Array<{ path: string; content: string }> }).files)
      : undefined;
    return { files };
  });
  if (mocked && 'files' in mocked) {
    emitFileStageEvents(state, mocked.files as Record<string, string> | undefined, 'leaf');
    return traceNode(state, 'serviceNode', mocked as NodePatch);
  }

  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? routeNameFromGoal(state.goal);
  const singleReportMode = isSingleReport(state);
  const structured =
    singleReportMode || shouldDeterministicMultiAssembly(state)
      ? null
      : await generateDataReportNodeObject({
          state,
          node: 'serviceNode',
          contractName: 'data-report.service',
          contractVersion: '1.0.0',
          schema: DataReportServiceSchema,
          systemPrompt: DATA_REPORT_SERVICE_PROMPT,
          userContent: buildDataReportPlanningContext(state)
        });

  const servicePath = String(state.structure?.serviceFile ?? `/src/services/data/${routeName}.ts`);
  const singleReportFiles = singleReportMode
    ? await generateSingleReportPlannedFiles(
        state,
        buildFilePlans(state).leafPlans.filter(plan => plan.path === servicePath)
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
            state.blueprint?.scope === 'multiple' ? /\/services\/data\/[^/]+\.ts$/.test(path) : path === servicePath
          )
        )
      : undefined);
  if (!singleReportFiles) {
    emitFileStageEvents(state, files, 'leaf');
  }

  return traceNode(state, 'serviceNode', {
    service: structured ?? {
      plannedFile: servicePath,
      exportName: `fetch${pascalCase(routeName)}Report`
    },
    files
  });
}
