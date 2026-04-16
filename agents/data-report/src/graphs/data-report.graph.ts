import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { DataReportBlueprintResult } from '@agent/report-kit';

import type { LlmProvider } from '@agent/adapters';
import {
  runAnalysisNode,
  runAppGenNode,
  runAssembleNode,
  runCapabilityNode,
  runComponentNode,
  runComponentSubgraph,
  runDependencyNode,
  runHooksNode,
  runIntentNode,
  runLayoutNode,
  runMockDataNode,
  runPageSubgraph,
  runPostProcessNode,
  runScopeNode,
  runServiceNode,
  runStructureNode,
  runStyleGenNode,
  runTypeNode,
  runUtilsNode
} from '../flows/data-report/nodes';
import { startNode } from '../flows/data-report/nodes/shared';
import type {
  DataReportAnalysisArtifact,
  DataReportAppArtifact,
  DataReportAssembleArtifact,
  DataReportCapabilityArtifact,
  DataReportComponentArtifact,
  DataReportFileGenerationEvent,
  DataReportGenerationNode,
  DataReportGeneratedModuleArtifact,
  DataReportHooksArtifact,
  DataReportIntentArtifact,
  DataReportLayoutArtifact,
  DataReportMockDataArtifact,
  DataReportScopeDecisionArtifact,
  DataReportServiceArtifact,
  DataReportSandpackFiles,
  DataReportSandpackGraphHandlers,
  DataReportSandpackGraphState,
  DataReportNodeStageEvent,
  DataReportSandpackPayload,
  DataReportStructureArtifact,
  DataReportStyleArtifact,
  DataReportTypesArtifact,
  DataReportUtilsArtifact,
  DataReportDependencyArtifact,
  DataReportDeterministicAssets,
  DataReportNodeModelOverrides
} from '../types/data-report';

const DataReportSandpackAnnotation = Annotation.Root({
  goal: Annotation<string>(),
  llm: Annotation<LlmProvider | undefined>(),
  systemPrompt: Annotation<string | undefined>(),
  modelId: Annotation<string | undefined>(),
  nodeModelOverrides: Annotation<DataReportNodeModelOverrides | undefined>(),
  temperature: Annotation<number | undefined>(),
  maxTokens: Annotation<number | undefined>(),
  mockConfig: Annotation<Record<string, unknown> | undefined>(),
  onToken: Annotation<((token: string) => void) | undefined>(),
  onRetry: Annotation<((attempt: number, error: Error) => void) | undefined>(),
  onStage: Annotation<((event: DataReportNodeStageEvent) => void) | undefined>(),
  onFileStage: Annotation<((event: DataReportFileGenerationEvent) => void) | undefined>(),
  currentStage: Annotation<DataReportGenerationNode | undefined>({
    reducer: (existing, update) => update ?? existing
  }),
  nodeTrace: Annotation<DataReportGenerationNode[]>({
    reducer: (existing, update) => {
      if (!update) {
        return existing;
      }
      const merged = [...existing];
      for (const node of update) {
        if (!merged.includes(node)) {
          merged.push(node);
        }
      }
      return merged;
    },
    default: () => []
  }),
  rawContent: Annotation<string | undefined>(),
  payload: Annotation<DataReportSandpackPayload | undefined>(),
  files: Annotation<DataReportSandpackFiles | undefined>({
    reducer: (existing, update) => {
      if (!existing) {
        return update;
      }
      if (!update) {
        return existing;
      }
      return {
        ...existing,
        ...update
      };
    }
  }),
  analysis: Annotation<DataReportAnalysisArtifact | undefined>(),
  scopeDecision: Annotation<DataReportScopeDecisionArtifact | undefined>(),
  intent: Annotation<DataReportIntentArtifact | undefined>(),
  capabilities: Annotation<DataReportCapabilityArtifact | undefined>(),
  blueprint: Annotation<DataReportBlueprintResult | undefined>(),
  components: Annotation<DataReportComponentArtifact | undefined>(),
  structure: Annotation<DataReportStructureArtifact | undefined>(),
  dependency: Annotation<DataReportDependencyArtifact | undefined>(),
  types: Annotation<DataReportTypesArtifact | undefined>(),
  utils: Annotation<DataReportUtilsArtifact | undefined>(),
  mockData: Annotation<DataReportMockDataArtifact | undefined>(),
  service: Annotation<DataReportServiceArtifact | undefined>(),
  hooks: Annotation<DataReportHooksArtifact | undefined>(),
  componentsCode: Annotation<DataReportGeneratedModuleArtifact[] | undefined>(),
  pagesCode: Annotation<DataReportGeneratedModuleArtifact[] | undefined>(),
  layouts: Annotation<DataReportLayoutArtifact | undefined>(),
  styles: Annotation<DataReportStyleArtifact | undefined>(),
  app: Annotation<DataReportAppArtifact | undefined>(),
  assemble: Annotation<DataReportAssembleArtifact | undefined>(),
  deterministicAssets: Annotation<DataReportDeterministicAssets | undefined>(),
  postProcessSummary: Annotation<Record<string, unknown> | undefined>(),
  errorMessage: Annotation<string | undefined>()
});

function isSingleReport(state: DataReportSandpackGraphState) {
  const referenceMode = state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode ?? state.blueprint?.scope;
  const templateId = state.blueprint?.templateId ?? state.analysis?.templateId;
  return referenceMode === 'single' && templateId === 'bonus-center-data';
}

export function createDataReportSandpackGraph(handlers: DataReportSandpackGraphHandlers = {}) {
  const withPending =
    (
      node: DataReportGenerationNode,
      runner: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>
    ) =>
    async (state: DataReportSandpackGraphState) => {
      startNode(state, node);
      try {
        return await runner(state);
      } catch (error) {
        state.onStage?.({ node, status: 'error' });
        throw error;
      }
    };

  return new StateGraph(DataReportSandpackAnnotation)
    .addNode(
      'analysisNode',
      withPending('analysisNode', state => runAnalysisNode(state, handlers))
    )
    .addNode(
      'scopeNode',
      withPending('scopeNode', state => runScopeNode(state, handlers))
    )
    .addNode(
      'intentNode',
      withPending('intentNode', state => runIntentNode(state, handlers))
    )
    .addNode(
      'capabilityNode',
      withPending('capabilityNode', state => runCapabilityNode(state, handlers))
    )
    .addNode(
      'componentNode',
      withPending('componentNode', state => runComponentNode(state, handlers))
    )
    .addNode(
      'structureNode',
      withPending('structureNode', state => runStructureNode(state, handlers))
    )
    .addNode(
      'dependencyNode',
      withPending('dependencyNode', state => runDependencyNode(state, handlers))
    )
    .addNode(
      'typeNode',
      withPending('typeNode', state => runTypeNode(state, handlers))
    )
    .addNode(
      'utilsNode',
      withPending('utilsNode', state => runUtilsNode(state, handlers))
    )
    .addNode(
      'mockDataNode',
      withPending('mockDataNode', state => runMockDataNode(state, handlers))
    )
    .addNode(
      'serviceNode',
      withPending('serviceNode', state => runServiceNode(state, handlers))
    )
    .addNode(
      'hooksNode',
      withPending('hooksNode', state => runHooksNode(state, handlers))
    )
    .addNode(
      'componentSubgraph',
      withPending('componentSubgraph', state => runComponentSubgraph(state, handlers))
    )
    .addNode(
      'pageSubgraph',
      withPending('pageSubgraph', state => runPageSubgraph(state, handlers))
    )
    .addNode(
      'layoutNode',
      withPending('layoutNode', state => runLayoutNode(state, handlers))
    )
    .addNode(
      'styleGenNode',
      withPending('styleGenNode', state => runStyleGenNode(state, handlers))
    )
    .addNode(
      'appGenNode',
      withPending('appGenNode', state => runAppGenNode(state, handlers))
    )
    .addNode(
      'assembleNode',
      withPending('assembleNode', state => runAssembleNode(state, handlers))
    )
    .addNode(
      'postProcessNode',
      withPending('postProcessNode', state => runPostProcessNode(state, handlers))
    )
    .addEdge(START, 'analysisNode')
    .addEdge('analysisNode', 'scopeNode')
    .addEdge('scopeNode', 'intentNode')
    .addConditionalEdges('intentNode', state => (isSingleReport(state) ? 'componentNode' : 'capabilityNode'))
    .addEdge('capabilityNode', 'componentNode')
    .addEdge('componentNode', 'structureNode')
    .addConditionalEdges('structureNode', state => (isSingleReport(state) ? 'typeNode' : 'dependencyNode'))
    .addEdge('dependencyNode', 'typeNode')
    .addEdge('dependencyNode', 'utilsNode')
    .addEdge('dependencyNode', 'mockDataNode')
    .addEdge('typeNode', 'serviceNode')
    .addEdge('utilsNode', 'serviceNode')
    .addEdge('mockDataNode', 'serviceNode')
    .addConditionalEdges('serviceNode', state =>
      isSingleReport(state) ? 'componentSubgraph' : ['hooksNode', 'componentSubgraph']
    )
    .addEdge('hooksNode', 'pageSubgraph')
    .addEdge('componentSubgraph', 'pageSubgraph')
    .addConditionalEdges('pageSubgraph', state => (isSingleReport(state) ? 'appGenNode' : 'layoutNode'))
    .addEdge('layoutNode', 'styleGenNode')
    .addEdge('styleGenNode', 'appGenNode')
    .addEdge('appGenNode', 'assembleNode')
    .addEdge('assembleNode', 'postProcessNode')
    .addEdge('postProcessNode', END);
}
