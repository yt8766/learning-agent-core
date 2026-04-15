import { buildDataReportPlanningContext, DATA_REPORT_HOOKS_PROMPT } from '../prompts';
import { DataReportHooksSchema } from '../schemas';
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

export async function runHooksNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.hooksNode) {
    return traceNode(state, 'hooksNode', await handlers.hooksNode(state));
  }

  const mocked = await tryExecuteMock(state, 'hooksNode', 'data-report/hooks-node.json', data => {
    const files = Array.isArray((data as { files?: Array<{ path: string; content: string }> }).files)
      ? scaffoldFilesToSandpackFiles((data as { files: Array<{ path: string; content: string }> }).files)
      : undefined;
    return { files };
  });
  if (mocked && 'files' in mocked) {
    emitFileStageEvents(state, mocked.files as Record<string, string> | undefined, 'leaf');
    return traceNode(state, 'hooksNode', mocked as NodePatch);
  }

  const routeName = state.intent?.routeName ?? routeNameFromGoal(state.goal);
  const isSingleReport = (state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode) === 'single';
  const shouldEmitFiles = shouldDeterministicMultiAssembly(state);
  const structured =
    isSingleReport || shouldDeterministicMultiAssembly(state)
      ? null
      : await generateDataReportNodeObject({
          state,
          node: 'hooksNode',
          contractName: 'data-report.hooks',
          contractVersion: '1.0.0',
          schema: DataReportHooksSchema,
          systemPrompt: DATA_REPORT_HOOKS_PROMPT,
          userContent: buildDataReportPlanningContext(state)
        });

  const plannedHooks =
    structured?.planned ??
    (isSingleReport
      ? []
      : [
          {
            name: `use${pascalCase(routeName)}Data`,
            path: `${state.structure?.moduleDir ?? `/src/pages/dataDashboard/${routeName}`}/hooks/use${pascalCase(routeName)}Data.ts`
          }
        ]);
  const hookFiles = plannedHooks.map(hook => ({
    path: hook.path,
    content: [
      `import { useEffect, useState } from 'react';`,
      `import type { ReportTableRow } from '../../../../types/data/${routeName}';`,
      `import { ${state.service?.exportName ?? `fetch${pascalCase(routeName)}Report`} } from '../../../../services/data/${routeName}';`,
      '',
      `export function ${hook.name}(params?: Record<string, unknown>) {`,
      '  const [data, setData] = useState<ReportTableRow[]>([]);',
      '  const [loading, setLoading] = useState(false);',
      '',
      '  useEffect(() => {',
      '    let mounted = true;',
      '    setLoading(true);',
      `    ${state.service?.exportName ?? `fetch${pascalCase(routeName)}Report`}(params)`,
      '      .then(response => {',
      '        if (!mounted) return;',
      '        setData(response?.data?.records ?? []);',
      '      })',
      '      .finally(() => {',
      '        if (mounted) setLoading(false);',
      '      });',
      '    return () => {',
      '      mounted = false;',
      '    };',
      '  }, [params]);',
      '',
      '  return { data, loading };',
      '}',
      ''
    ].join('\n')
  }));

  const files = shouldEmitFiles && hookFiles.length ? scaffoldFilesToSandpackFiles(hookFiles) : undefined;
  emitFileStageEvents(state, files, 'leaf');

  return traceNode(state, 'hooksNode', {
    hooks: structured ?? {
      planned: plannedHooks
    },
    files
  });
}
