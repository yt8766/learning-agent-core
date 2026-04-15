import { buildDataReportRoutes } from '@agent/report-kit';

import { dataReportSandpackAgent } from '../sandpack-agent';
import type { DataReportSandpackGraphHandlers, DataReportSandpackGraphState } from '../../../types/data-report';
import { tryExecuteMock } from '../../../utils/mock';
import {
  buildGenerationContext,
  scaffoldFilesToSandpackFiles,
  shouldDeterministicMultiAssembly,
  traceNode,
  type NodePatch
} from './shared';
import { buildRootFiles, isSingleReport } from './single-report-file-generator';

function buildRootArtifacts(state: DataReportSandpackGraphState) {
  if (state.deterministicAssets?.routeFiles) {
    return state.deterministicAssets.routeFiles;
  }

  if (!state.blueprint) {
    throw new Error('Data report root generation requires blueprint context.');
  }

  return scaffoldFilesToSandpackFiles(buildDataReportRoutes(state.blueprint).files);
}

function emitAssemblyFileEvents(state: DataReportSandpackGraphState, files: Record<string, string>) {
  const filePaths = Object.keys(files).sort((left, right) => left.localeCompare(right));
  const isAggregateFile = (filePath: string) =>
    filePath === '/App.tsx' ||
    filePath === '/routes.ts' ||
    filePath === '/src/App.tsx' ||
    filePath === '/src/routes.ts' ||
    /^\/(?:src\/)?pages\/dataDashboard\/[^/]+\/index\.tsx$/.test(filePath);

  for (const filePath of filePaths) {
    state.onFileStage?.({
      phase: isAggregateFile(filePath) ? 'aggregate' : 'leaf',
      path: filePath,
      status: 'pending'
    });
  }

  for (const filePath of filePaths) {
    state.onFileStage?.({
      phase: isAggregateFile(filePath) ? 'aggregate' : 'leaf',
      path: filePath,
      status: 'success'
    });
  }
}

function buildDeterministicContextDigest(
  state: DataReportSandpackGraphState,
  strategy: 'deterministic-root' | 'tool-fallback'
) {
  const referenceMode = state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode ?? state.blueprint?.scope;
  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? state.scopeDecision?.routeName;
  const templateId = state.blueprint?.templateId ?? state.analysis?.templateId;
  return JSON.stringify({
    strategy,
    referenceMode,
    routeName,
    templateId
  });
}

export async function runAppGenNode(
  state: DataReportSandpackGraphState,
  handlers: DataReportSandpackGraphHandlers = {}
): Promise<NodePatch> {
  if (handlers.appGenNode) {
    return traceNode(state, 'appGenNode', await handlers.appGenNode(state));
  }

  const mocked = await tryExecuteMock(state, 'appGenNode', 'data-report/app-gen-node.json', data => {
    const result = data as NodePatch & { files?: Record<string, string> };
    const payload = result.payload ?? (result.files ? { status: 'success' as const, files: result.files } : undefined);
    return {
      ...result,
      payload,
      rawContent: result.rawContent ?? (payload ? JSON.stringify(payload) : undefined)
    };
  });
  if (mocked) {
    return traceNode(state, 'appGenNode', mocked as NodePatch);
  }

  if (!state.llm) {
    throw new Error('Data report sandpack graph requires an LLM provider.');
  }

  if (isSingleReport(state)) {
    const files = buildRootFiles(state);
    emitAssemblyFileEvents(state, files);
    return traceNode(state, 'appGenNode', {
      files,
      app: {
        generated: true,
        source: 'deterministic-root',
        contextDigest: buildDeterministicContextDigest(state, 'deterministic-root')
      }
    });
  }

  if (!shouldDeterministicMultiAssembly(state)) {
    const contextDigest = buildGenerationContext(state);
    const result = await dataReportSandpackAgent.generate({
      llm: state.llm,
      goal: state.goal,
      systemPrompt: state.systemPrompt,
      contextBlock: contextDigest,
      modelId: state.modelId,
      temperature: state.temperature,
      maxTokens: state.maxTokens,
      onToken: state.onToken,
      onRetry: state.onRetry
    });

    return traceNode(state, 'appGenNode', {
      rawContent: result.content,
      payload: result.payload,
      app: {
        generated: true,
        source: 'llm',
        contextDigest
      }
    });
  }

  const files = buildRootArtifacts(state);
  emitAssemblyFileEvents(state, files);

  return traceNode(state, 'appGenNode', {
    files,
    app: {
      generated: true,
      source: 'tool-fallback',
      contextDigest: buildDeterministicContextDigest(state, 'tool-fallback')
    }
  });
}
