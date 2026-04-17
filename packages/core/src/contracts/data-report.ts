import type { LlmProviderLike } from '../types/llm-provider-like';
import type {
  DataReportAnalysisArtifact,
  DataReportAppArtifact,
  DataReportAssembleArtifact,
  DataReportBlueprintResult,
  DataReportCapabilityArtifact,
  DataReportComponentArtifact,
  DataReportDependencyArtifact,
  DataReportDeterministicAssets,
  DataReportFileGenerationEvent,
  DataReportGeneratedModuleArtifact,
  DataReportGenerationNode,
  DataReportHooksArtifact,
  DataReportIntentArtifact,
  DataReportLayoutArtifact,
  DataReportMockDataArtifact,
  DataReportNodeModelOverrides,
  DataReportNodeStageEvent,
  DataReportSandpackFiles,
  DataReportSandpackPayload,
  DataReportScopeDecisionArtifact,
  DataReportServiceArtifact,
  DataReportStructureArtifact,
  DataReportStyleArtifact,
  DataReportTypesArtifact,
  DataReportUtilsArtifact
} from '../types/data-report';

export interface DataReportSandpackGenerateInput {
  llm: LlmProviderLike;
  goal: string;
  systemPrompt?: string;
  contextBlock?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  onToken?: (token: string) => void;
  onRetry?: (attempt: number, error: Error) => void;
  onStage?: (event: DataReportNodeStageEvent) => void;
  onFileStage?: (event: DataReportFileGenerationEvent) => void;
  mockConfig?: Record<string, unknown>;
}

export interface DataReportSandpackGenerateResult {
  content: string;
  payload: DataReportSandpackPayload;
}

export interface DataReportSandpackGraphState {
  goal: string;
  llm?: LlmProviderLike;
  systemPrompt?: string;
  modelId?: string;
  nodeModelOverrides?: DataReportNodeModelOverrides;
  temperature?: number;
  maxTokens?: number;
  onToken?: (token: string) => void;
  onRetry?: (attempt: number, error: Error) => void;
  onStage?: (event: DataReportNodeStageEvent) => void;
  onFileStage?: (event: DataReportFileGenerationEvent) => void;
  mockConfig?: Record<string, unknown>;
  currentStage?: DataReportGenerationNode;
  nodeTrace?: DataReportGenerationNode[];
  rawContent?: string;
  payload?: DataReportSandpackPayload;
  files?: DataReportSandpackFiles;
  analysis?: DataReportAnalysisArtifact;
  scopeDecision?: DataReportScopeDecisionArtifact;
  intent?: DataReportIntentArtifact;
  capabilities?: DataReportCapabilityArtifact;
  blueprint?: DataReportBlueprintResult;
  components?: DataReportComponentArtifact;
  structure?: DataReportStructureArtifact;
  dependency?: DataReportDependencyArtifact;
  types?: DataReportTypesArtifact;
  utils?: DataReportUtilsArtifact;
  mockData?: DataReportMockDataArtifact;
  service?: DataReportServiceArtifact;
  hooks?: DataReportHooksArtifact;
  componentsCode?: DataReportGeneratedModuleArtifact[];
  pagesCode?: DataReportGeneratedModuleArtifact[];
  layouts?: DataReportLayoutArtifact;
  styles?: DataReportStyleArtifact;
  app?: DataReportAppArtifact;
  assemble?: DataReportAssembleArtifact;
  deterministicAssets?: DataReportDeterministicAssets;
  postProcessSummary?: Record<string, unknown>;
  errorMessage?: string;
}

export interface DataReportSandpackGraphHandlers {
  analysisNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  scopeNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  intentNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  capabilityNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  componentNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  structureNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  dependencyNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  typeNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  utilsNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  mockDataNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  serviceNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  hooksNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  componentSubgraph?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  pageSubgraph?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  layoutNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  styleGenNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  appGenNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  assembleNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
  postProcessNode?: (state: DataReportSandpackGraphState) => Promise<Partial<DataReportSandpackGraphState>>;
}
