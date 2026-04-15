import { buildDataReportModuleScaffold } from '@agent/report-kit';

import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import {
  buildPlannedModuleArtifacts,
  emitFileStageEvents,
  scaffoldFilesToSandpackFiles,
  shouldDeterministicMultiAssembly,
  traceNode,
  type NodePatch
} from './shared';
import { buildFilePlans, generateSingleReportPlannedFiles, isSingleReport } from './single-report-file-generator';

export async function runComponentSubgraph(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.componentSubgraph) {
    return traceNode(state, 'componentSubgraph', await handlers.componentSubgraph(state));
  }

  const mocked = await tryExecuteMock(state, 'componentSubgraph', 'data-report/component-subgraph.json', data => {
    const files = Array.isArray((data as { files?: Array<{ path: string; content: string }> }).files)
      ? scaffoldFilesToSandpackFiles((data as { files: Array<{ path: string; content: string }> }).files)
      : undefined;
    return { files };
  });
  if (mocked && 'files' in mocked) {
    emitFileStageEvents(state, mocked.files as Record<string, string> | undefined, 'leaf');
    return traceNode(state, 'componentSubgraph', mocked as NodePatch);
  }

  const singleReportMode = isSingleReport(state);
  if (singleReportMode) {
    const componentPaths = new Set((state.components?.planned ?? []).map(plan => plan.path));
    const files =
      (await generateSingleReportPlannedFiles(
        state,
        buildFilePlans(state).leafPlans.filter(plan => componentPaths.has(plan.path))
      )) ?? undefined;

    return traceNode(state, 'componentSubgraph', {
      componentsCode: buildPlannedModuleArtifacts(state.structure, 'component'),
      files
    });
  }

  if (shouldDeterministicMultiAssembly(state) && state.blueprint) {
    const files =
      state.deterministicAssets?.moduleFiles ??
      scaffoldFilesToSandpackFiles(
        state.blueprint.modules.flatMap(
          module =>
            buildDataReportModuleScaffold({
              goal: state.goal,
              baseDir: state.blueprint!.baseDir,
              templateId: state.blueprint!.templateId,
              moduleId: module.id
            }).files
        )
      );
    const componentPaths = Object.keys(files);
    emitFileStageEvents(state, files, 'leaf');
    return traceNode(state, 'componentSubgraph', {
      componentsCode: componentPaths.map(path => ({
        path,
        status: 'planned'
      })),
      files
    });
  }

  return traceNode(state, 'componentSubgraph', {
    componentsCode: buildPlannedModuleArtifacts(state.structure, 'component')
  });
}
