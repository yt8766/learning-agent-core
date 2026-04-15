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

export async function runUtilsNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.utilsNode) {
    return traceNode(state, 'utilsNode', await handlers.utilsNode(state));
  }

  const mocked = await tryExecuteMock(state, 'utilsNode', 'data-report/utils-node.json', data => {
    const files = Array.isArray((data as { files?: Array<{ path: string; content: string }> }).files)
      ? scaffoldFilesToSandpackFiles((data as { files: Array<{ path: string; content: string }> }).files)
      : undefined;
    return { files };
  });
  if (mocked && 'files' in mocked) {
    emitFileStageEvents(state, mocked.files as Record<string, string> | undefined, 'leaf');
    return traceNode(state, 'utilsNode', mocked as NodePatch);
  }

  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? routeNameFromGoal(state.goal);
  const isSingleReport = (state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode) === 'single';
  const shouldEmitFiles = shouldDeterministicMultiAssembly(state);
  const planned = isSingleReport
    ? []
    : [
        {
          name: 'formatNumber',
          path: `${state.structure?.moduleDir ?? `/src/pages/dataDashboard/${routeName}`}/utils/format.ts`
        },
        {
          name: 'buildChartConfig',
          path: `${state.structure?.moduleDir ?? `/src/pages/dataDashboard/${routeName}`}/utils/chart.ts`
        }
      ];
  const files =
    shouldEmitFiles && planned.length
      ? scaffoldFilesToSandpackFiles([
          {
            path: planned[0]!.path,
            content: `export function formatNumber(value: number | string | undefined) {\n  return Number(value ?? 0).toLocaleString();\n}\n`
          },
          {
            path: planned[1]!.path,
            content:
              "export function buildChartConfig(categories: string[], values: number[]) {\n  return {\n    tooltip: { trigger: 'axis' },\n    xAxis: { type: 'category', data: categories },\n    yAxis: { type: 'value' },\n    series: [{ type: 'line', smooth: true, data: values }]\n  };\n}\n"
          }
        ])
      : undefined;
  emitFileStageEvents(state, files, 'leaf');

  return traceNode(state, 'utilsNode', {
    utils: {
      planned
    },
    files
  });
}
