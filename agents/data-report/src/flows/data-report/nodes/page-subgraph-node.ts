import { buildDataReportScaffold } from '@agent/report-kit';

import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import {
  buildPlannedModuleArtifacts,
  defaultReportPath,
  emitFileStageEvents,
  routeNameFromGoal,
  scaffoldFilesToSandpackFiles,
  shouldDeterministicMultiAssembly,
  traceNode,
  type NodePatch
} from './shared';
import { buildFilePlans, generateSingleReportPlannedFiles, isSingleReport } from './single-report-file-generator';

export async function runPageSubgraph(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.pageSubgraph) {
    return traceNode(state, 'pageSubgraph', await handlers.pageSubgraph(state));
  }

  const mocked = await tryExecuteMock(state, 'pageSubgraph', 'data-report/page-subgraph.json', data => {
    const files = Array.isArray((data as { files?: Array<{ path: string; content: string }> }).files)
      ? scaffoldFilesToSandpackFiles((data as { files: Array<{ path: string; content: string }> }).files)
      : undefined;
    return { files };
  });
  if (mocked && 'files' in mocked) {
    emitFileStageEvents(state, mocked.files as Record<string, string> | undefined, 'aggregate');
    return traceNode(state, 'pageSubgraph', mocked as NodePatch);
  }

  const singleReportMode = isSingleReport(state);
  if (singleReportMode) {
    const pagePath = state.structure?.pageFile ?? `/src/pages/dataDashboard/${routeNameFromGoal(state.goal)}/index.tsx`;
    const files =
      (await generateSingleReportPlannedFiles(
        state,
        buildFilePlans(state).aggregatePlans.filter(plan => plan.path === pagePath)
      )) ?? undefined;

    return traceNode(state, 'pageSubgraph', {
      pagesCode: buildPlannedModuleArtifacts(state.structure, 'page').length
        ? buildPlannedModuleArtifacts(state.structure, 'page')
        : [
            {
              path: defaultReportPath(state),
              status: 'planned',
              dependsOn: [state.structure?.serviceFile ?? `/src/services/data/${routeNameFromGoal(state.goal)}.ts`]
            }
          ],
      files
    });
  }

  if (shouldDeterministicMultiAssembly(state) && state.blueprint) {
    const scaffoldFiles =
      state.deterministicAssets?.scaffoldFiles ??
      scaffoldFilesToSandpackFiles(
        buildDataReportScaffold({
          goal: state.goal,
          baseDir: state.blueprint.baseDir,
          templateId: state.blueprint.templateId
        }).files
      );
    const files = Object.fromEntries(
      Object.entries(scaffoldFiles).filter(([path]) => {
        return (
          /^\/(?:src\/)?pages\/dataDashboard\/[^/]+\/index\.tsx$/.test(path) ||
          path.endsWith('/config.tsx') ||
          path.includes('/components/Search/')
        );
      })
    );
    emitFileStageEvents(state, files, 'aggregate');
    return traceNode(state, 'pageSubgraph', {
      pagesCode: Object.keys(files).map(path => ({
        path,
        status: 'planned'
      })),
      files
    });
  }

  return traceNode(state, 'pageSubgraph', {
    pagesCode: buildPlannedModuleArtifacts(state.structure, 'page').length
      ? buildPlannedModuleArtifacts(state.structure, 'page')
      : [
          {
            path: defaultReportPath(state),
            status: 'planned',
            dependsOn: [state.structure?.serviceFile ?? `/src/services/data/${routeNameFromGoal(state.goal)}.ts`]
          }
        ]
  });
}
