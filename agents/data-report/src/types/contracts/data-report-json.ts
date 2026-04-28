import type { LlmProviderLike, LlmProviderLikeAgentRole } from '@agent/core';
import type {
  DataReportJsonAnalysisArtifact,
  DataReportJsonBlock,
  DataReportJsonComplexityLevel,
  DataReportJsonDataSource,
  DataReportJsonFilterSchema,
  DataReportJsonGenerationMode,
  DataReportJsonGenerationNode,
  DataReportJsonGenerationStatus,
  DataReportJsonMeta,
  DataReportJsonNodeStageEvent,
  DataReportJsonArtifactEvent,
  DataReportJsonPageDefaults,
  DataReportJsonPatchIntent,
  DataReportJsonPatchOperation,
  DataReportJsonReportSummary,
  DataReportJsonRuntimeMeta,
  DataReportJsonSchema,
  DataReportJsonSection,
  DataReportJsonStructuredInput,
  DataReportJsonTrimmedContexts,
  DataReportJsonVersionInfo,
  DataReportJsonGenerationError
} from '../data-report-json';

export type DataReportJsonModelSelectorTier = 'fast' | 'balanced' | 'quality';

export interface DataReportJsonModelSelectorPreference {
  tier: DataReportJsonModelSelectorTier;
  role?: LlmProviderLikeAgentRole;
  preferredModelIds?: string[];
}

export type DataReportJsonNodeModelSelector = string | DataReportJsonModelSelectorPreference;

export interface DataReportJsonNodeModelPolicy {
  analysisNode: { primary: DataReportJsonNodeModelSelector };
  patchIntentNode: { primary: DataReportJsonNodeModelSelector };
  schemaSpecNode: { primary: DataReportJsonNodeModelSelector };
  filterSchemaNode: { primary: DataReportJsonNodeModelSelector; fallback?: DataReportJsonNodeModelSelector };
  dataSourceNode: { primary: DataReportJsonNodeModelSelector; fallback?: DataReportJsonNodeModelSelector };
  sectionPlanNode: { primary: DataReportJsonNodeModelSelector; fallback?: DataReportJsonNodeModelSelector };
  metricsBlockNode: { primary: DataReportJsonNodeModelSelector; fallback?: DataReportJsonNodeModelSelector };
  chartBlockNode: { primary: DataReportJsonNodeModelSelector; fallback?: DataReportJsonNodeModelSelector };
  tableBlockNode: { primary: DataReportJsonNodeModelSelector; fallback?: DataReportJsonNodeModelSelector };
  sectionSchemaNode: {
    primary: DataReportJsonNodeModelSelector;
    complex?: DataReportJsonNodeModelSelector;
    fallback?: DataReportJsonNodeModelSelector;
  };
  patchSchemaNode: {
    primary: DataReportJsonNodeModelSelector;
    complex?: DataReportJsonNodeModelSelector;
    fallback?: DataReportJsonNodeModelSelector;
  };
}

export interface DataReportJsonGenerateInput {
  goal: string;
  reportSchemaInput?: DataReportJsonStructuredInput;
  currentSchema?: DataReportJsonSchema;
  llm?: LlmProviderLike;
  strictLlmBrandNew?: boolean;
  modelId?: string;
  nodeModelOverrides?: Partial<Record<DataReportJsonGenerationNode, string>>;
  temperature?: number;
  maxTokens?: number;
  mode?: DataReportJsonGenerationMode;
  fastLane?: boolean;
  budgetMs?: number;
  requestId?: string;
  artifactCacheKey?: string;
  disableCache?: boolean;
  complexity?: DataReportJsonComplexityLevel;
  nodeModelPolicy?: DataReportJsonNodeModelPolicy;
  onStage?: (event: DataReportJsonNodeStageEvent) => void;
  onArtifact?: (event: DataReportJsonArtifactEvent) => void;
}

export interface DataReportJsonGraphState extends DataReportJsonGenerateInput {
  analysis?: DataReportJsonAnalysisArtifact;
  patchIntents?: DataReportJsonPatchIntent[];
  nodeContexts?: DataReportJsonTrimmedContexts;
  meta?: Omit<DataReportJsonMeta, 'owner'>;
  pageDefaults?: DataReportJsonPageDefaults;
  patchOperations?: DataReportJsonPatchOperation[];
  currentSchema?: DataReportJsonSchema;
  modificationRequest?: string;
  filterSchema?: DataReportJsonFilterSchema;
  dataSources?: Record<string, DataReportJsonDataSource>;
  sectionPlan?: Omit<DataReportJsonSection, 'blocks'>;
  sectionMetricsBlock?: Extract<DataReportJsonBlock, { type: 'metrics' }>;
  sectionChartBlock?: Extract<DataReportJsonBlock, { type: 'chart' }>;
  sectionTableBlock?: Extract<DataReportJsonBlock, { type: 'table' }>;
  sections?: DataReportJsonSection[];
  schema?: DataReportJsonSchema;
  status?: DataReportJsonGenerationStatus;
  partialSchema?: Partial<DataReportJsonSchema>;
  error?: DataReportJsonGenerationError;
  reportSummaries?: DataReportJsonReportSummary[];
  runtime?: DataReportJsonRuntimeMeta;
  versionInfo?: DataReportJsonVersionInfo;
  cacheHit?: boolean;
  failedNode?: DataReportJsonGenerationNode;
  warnings?: string[];
  splitBlockCacheHit?: boolean;
}

export interface DataReportJsonGraphHandlers {
  analysisNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  patchIntentNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  schemaSpecNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  filterSchemaNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  dataSourceNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  sectionPlanNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  metricsBlockNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  chartBlockNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  tableBlockNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  sectionAssembleNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  sectionSchemaNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  patchSchemaNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
  validateNode?: (state: DataReportJsonGraphState) => Promise<Partial<DataReportJsonGraphState>>;
}
