import type { LlmProviderLike } from './llm-provider-like';
import type {
  DataReportJsonAnalysisArtifact,
  DataReportJsonBlock,
  DataReportJsonComplexityLevel,
  DataReportJsonDataSource,
  DataReportJsonFilterSchema,
  DataReportJsonGenerationMode,
  DataReportJsonGenerationStatus,
  DataReportJsonMeta,
  DataReportJsonPageDefaults,
  DataReportJsonPatchOperation,
  DataReportJsonSchema,
  DataReportJsonSection,
  DataReportJsonStructuredInput,
  DataReportJsonVersionInfo
} from './data-report-json-schema';

export * from './data-report-json-schema';

export type DataReportJsonGenerationNode =
  | 'planningNode'
  | 'analysisNode'
  | 'patchIntentNode'
  | 'schemaSpecNode'
  | 'filterSchemaNode'
  | 'dataSourceNode'
  | 'sectionPlanNode'
  | 'metricsBlockNode'
  | 'chartBlockNode'
  | 'tableBlockNode'
  | 'sectionAssembleNode'
  | 'sectionSchemaNode'
  | 'patchSchemaNode'
  | 'validateNode';

export type DataReportJsonTrimmedContextNode =
  | 'filterSchemaNode'
  | 'dataSourceNode'
  | 'metricsBlockNode'
  | 'chartBlockNode'
  | 'tableBlockNode'
  | 'sectionSchemaNode';

export type DataReportJsonTrimmedContexts = Partial<Record<DataReportJsonTrimmedContextNode, string>>;

export interface DataReportJsonArtifactEvent {
  phase: 'skeleton' | 'block' | 'final';
  schema: Partial<DataReportJsonSchema>;
  blockType?: DataReportJsonBlock['type'];
  status?: DataReportJsonGenerationStatus;
}

export interface DataReportJsonNodeStageEvent {
  node: DataReportJsonGenerationNode;
  status: 'pending' | 'success' | 'error';
  modelId?: string;
  cacheHit?: boolean;
  retryCount?: number;
  degraded?: boolean;
  upgraded?: boolean;
  details?: Record<string, unknown>;
}

export interface DataReportJsonGenerationError {
  errorCode: 'report_schema_generation_failed' | 'report_schema_validation_failed';
  errorMessage: string;
  failedNode?: DataReportJsonGenerationNode;
  failedNodes?: DataReportJsonGenerationNode[];
  failedReports?: string[];
  modelId?: string;
  elapsedMs?: number;
  retryable: boolean;
}

export interface DataReportJsonReportSummary {
  reportKey: string;
  status: 'success' | 'partial' | 'failed';
  elapsedMs?: number;
  modelId?: string;
  retryCount?: number;
  cacheHit?: boolean;
}

export interface DataReportJsonRuntimeMeta {
  cacheHit: boolean;
  executionPath: 'structured-fast-lane' | 'partial-llm' | 'llm';
  llmAttempted: boolean;
  llmSucceeded: boolean;
  nodeDurations: Partial<Record<DataReportJsonGenerationNode, number>>;
}

export interface DataReportJsonNodeModelPolicy {
  analysisNode: {
    primary: string;
  };
  patchIntentNode: {
    primary: string;
  };
  schemaSpecNode: {
    primary: string;
  };
  filterSchemaNode: {
    primary: string;
    fallback?: string;
  };
  dataSourceNode: {
    primary: string;
    fallback?: string;
  };
  sectionPlanNode: {
    primary: string;
    fallback?: string;
  };
  metricsBlockNode: {
    primary: string;
    fallback?: string;
  };
  chartBlockNode: {
    primary: string;
    fallback?: string;
  };
  tableBlockNode: {
    primary: string;
    fallback?: string;
  };
  sectionSchemaNode: {
    primary: string;
    complex?: string;
    fallback?: string;
  };
  patchSchemaNode: {
    primary: string;
    complex?: string;
    fallback?: string;
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

export interface DataReportJsonPatchIntent {
  target: 'filterSchema' | 'dataSources' | 'metricsBlock' | 'chartBlock' | 'tableBlock';
  action:
    | 'add'
    | 'remove'
    | 'update-title'
    | 'update-style'
    | 'update-component'
    | 'regenerate-options'
    | 'update-default'
    | 'unknown';
  subject?: string;
}

export interface DataReportJsonGenerateResult {
  status: DataReportJsonGenerationStatus;
  schema?: DataReportJsonSchema;
  partialSchema?: Partial<DataReportJsonSchema>;
  error?: DataReportJsonGenerationError;
  reportSummaries?: DataReportJsonReportSummary[];
  runtime?: DataReportJsonRuntimeMeta;
  content: string;
  elapsedMs: number;
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
