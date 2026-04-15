import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

import type {
  DataReportJsonGraphHandlers,
  DataReportJsonGraphState,
  DataReportJsonNodeStageEvent
} from '../types/data-report-json';
import {
  runJsonAnalysisNode,
  runJsonSchemaSpecNode,
  runJsonDataSourceNode,
  runJsonFilterSchemaNode,
  runJsonSectionPlanNode,
  runJsonMetricsBlockNode,
  runJsonChartBlockNode,
  runJsonTableBlockNode,
  runJsonSectionAssembleNode,
  runJsonPatchSchemaNode,
  runJsonSectionSchemaNode,
  runJsonValidateNode
} from '../flows/data-report-json';
import {
  resolveDataReportJsonNodeModelCandidates,
  shouldUseSplitSingleReportLane
} from '../flows/data-report-json/model-policy';

const DataReportJsonAnnotation = Annotation.Root({
  goal: Annotation<string>(),
  llm: Annotation<DataReportJsonGraphState['llm']>(),
  strictLlmBrandNew: Annotation<boolean | undefined>(),
  modelId: Annotation<string | undefined>(),
  nodeModelOverrides: Annotation<DataReportJsonGraphState['nodeModelOverrides']>(),
  temperature: Annotation<number | undefined>(),
  maxTokens: Annotation<number | undefined>(),
  onStage: Annotation<((event: DataReportJsonNodeStageEvent) => void) | undefined>(),
  currentSchema: Annotation<DataReportJsonGraphState['currentSchema']>(),
  modificationRequest: Annotation<string | undefined>(),
  analysis: Annotation<DataReportJsonGraphState['analysis']>(),
  meta: Annotation<DataReportJsonGraphState['meta']>(),
  pageDefaults: Annotation<DataReportJsonGraphState['pageDefaults']>(),
  filterSchema: Annotation<DataReportJsonGraphState['filterSchema']>(),
  dataSources: Annotation<DataReportJsonGraphState['dataSources']>(),
  sectionPlan: Annotation<DataReportJsonGraphState['sectionPlan']>(),
  sectionMetricsBlock: Annotation<DataReportJsonGraphState['sectionMetricsBlock']>(),
  sectionChartBlock: Annotation<DataReportJsonGraphState['sectionChartBlock']>(),
  sectionTableBlock: Annotation<DataReportJsonGraphState['sectionTableBlock']>(),
  sections: Annotation<DataReportJsonGraphState['sections']>(),
  patchOperations: Annotation<DataReportJsonGraphState['patchOperations']>(),
  schema: Annotation<DataReportJsonGraphState['schema']>(),
  splitBlockCacheHit: Annotation<boolean | undefined>(),
  warnings: Annotation<string[] | undefined>({
    reducer: (existing, update) => [...(existing ?? []), ...(update ?? [])],
    default: () => []
  })
});

export function createDataReportJsonGraph(handlers: DataReportJsonGraphHandlers = {}) {
  const withPending =
    (
      node: NonNullable<Parameters<NonNullable<DataReportJsonGraphState['onStage']>>[0]>['node'],
      runner: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>
    ) =>
    async (state: DataReportJsonGraphState) => {
      const candidateModelId =
        node === 'validateNode' ? undefined : resolveDataReportJsonNodeModelCandidates(state, node)[0];
      state.onStage?.({ node, status: 'pending', modelId: candidateModelId });
      try {
        return await runner(state);
      } catch (error) {
        state.onStage?.({ node, status: 'error', modelId: candidateModelId });
        throw error;
      }
    };

  return new StateGraph(DataReportJsonAnnotation)
    .addNode(
      'analysisNode',
      withPending('analysisNode', state => runJsonAnalysisNode(state, handlers))
    )
    .addNode(
      'schemaSpecNode',
      withPending('schemaSpecNode', state => runJsonSchemaSpecNode(state, handlers))
    )
    .addNode(
      'filterSchemaNode',
      withPending('filterSchemaNode', state => runJsonFilterSchemaNode(state, handlers))
    )
    .addNode(
      'dataSourceNode',
      withPending('dataSourceNode', state => runJsonDataSourceNode(state, handlers))
    )
    .addNode(
      'sectionPlanNode',
      withPending('sectionPlanNode', state => runJsonSectionPlanNode(state, handlers))
    )
    .addNode(
      'metricsBlockNode',
      withPending('metricsBlockNode', state => runJsonMetricsBlockNode(state, handlers))
    )
    .addNode(
      'chartBlockNode',
      withPending('chartBlockNode', state => runJsonChartBlockNode(state, handlers))
    )
    .addNode(
      'tableBlockNode',
      withPending('tableBlockNode', state => runJsonTableBlockNode(state, handlers))
    )
    .addNode(
      'sectionAssembleNode',
      withPending('sectionAssembleNode', state => runJsonSectionAssembleNode(state, handlers))
    )
    .addNode(
      'sectionSchemaNode',
      withPending('sectionSchemaNode', state => runJsonSectionSchemaNode(state, handlers))
    )
    .addNode(
      'patchSchemaNode',
      withPending('patchSchemaNode', state => runJsonPatchSchemaNode(state, handlers))
    )
    .addNode(
      'validateNode',
      withPending('validateNode', state => runJsonValidateNode(state, handlers))
    )
    .addEdge(START, 'analysisNode')
    .addConditionalEdges('analysisNode', state => (state.currentSchema ? 'filterSchemaNode' : 'schemaSpecNode'))
    .addEdge('schemaSpecNode', 'filterSchemaNode')
    .addEdge('filterSchemaNode', 'dataSourceNode')
    .addConditionalEdges('dataSourceNode', state =>
      shouldUseSplitSingleReportLane(state) ? 'sectionPlanNode' : 'sectionSchemaNode'
    )
    .addEdge('sectionPlanNode', 'metricsBlockNode')
    .addEdge('metricsBlockNode', 'chartBlockNode')
    .addEdge('chartBlockNode', 'tableBlockNode')
    .addEdge('tableBlockNode', 'sectionAssembleNode')
    .addEdge('sectionAssembleNode', 'patchSchemaNode')
    .addEdge('sectionSchemaNode', 'patchSchemaNode')
    .addEdge('patchSchemaNode', 'validateNode')
    .addEdge('validateNode', END);
}
