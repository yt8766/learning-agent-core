import type { DataReportBlueprintResult } from '@agent/report-kit';
import type { LlmProviderLike } from './llm-provider-like';

export interface DataReportPlannedFile {
  path: string;
  kind:
    | 'app'
    | 'entry'
    | 'route'
    | 'style'
    | 'package'
    | 'tsconfig'
    | 'page'
    | 'component'
    | 'service'
    | 'type'
    | 'hook'
    | 'util';
  role: string;
}

export interface DataReportAnalysisArtifact {
  reportType: 'data-dashboard';
  requiresSandpack: true;
  requiresMultiFileOutput: true;
  title: string;
  routeName: string;
  templateId: string;
  referenceMode: 'single' | 'multiple' | 'shell-first';
  dataSourceHint?: string;
  keywords: string[];
}

export interface DataReportIntentArtifact {
  action: 'generate-report-page';
  routeName: string;
  moduleBasePath: string;
  serviceBaseName: string;
}

export interface DataReportScopeDecisionArtifact {
  referenceMode: 'single' | 'multiple' | 'shell-first';
  reason: 'template-inspection';
  templateApiCount: number;
  routeName: string;
  routeTitle: string;
  selectedModuleIds: string[];
}

export interface DataReportCapabilityArtifact {
  llmGeneration: true;
  sandpackAssembly: true;
  astPostProcess: true;
  deterministicPlanning: true;
}

export interface DataReportComponentArtifact {
  singleReportMode?: 'page-only' | 'component-files';
  planned: Array<{
    name: string;
    path: string;
    purpose: string;
  }>;
}

export interface DataReportStructureArtifact {
  routeName: string;
  moduleDir: string;
  files: DataReportPlannedFile[];
  rootFiles: string[];
  pageFile: string;
  serviceFile: string;
  typesFile: string;
}

export interface DataReportDependencyArtifact {
  runtime: 'react-ts';
  packages: string[];
  importStrategy: 'static-imports-only';
}

export interface DataReportTypesArtifact {
  plannedFile: string;
  entities: string[];
}

export interface DataReportUtilsArtifact {
  planned: Array<{
    name: string;
    path: string;
  }>;
}

export interface DataReportMockDataArtifact {
  mode: 'disabled' | 'file';
  note: string;
  mockFile?: string;
  payload?: unknown;
}

export interface DataReportServiceArtifact {
  plannedFile: string;
  exportName: string;
}

export interface DataReportHooksArtifact {
  planned: Array<{
    name: string;
    path: string;
  }>;
}

export interface DataReportGeneratedModuleArtifact {
  path: string;
  status: 'planned';
  dependsOn?: string[];
}

export interface DataReportLayoutArtifact {
  root: string;
  routeFile: string;
}

export interface DataReportStyleArtifact {
  target: 'tailwind-inline';
  theme: 'bonus-center';
}

export interface DataReportAppArtifact {
  generated: boolean;
  source: 'llm' | 'llm-parallel' | 'tool-fallback' | 'deterministic-root';
  contextDigest?: string;
}

export interface DataReportFileGenerationEvent {
  phase: 'leaf' | 'aggregate';
  path: string;
  status: 'pending' | 'success';
}

export interface DataReportNodeStageEvent {
  node: DataReportGenerationNode;
  status: 'pending' | 'success' | 'error';
  details?: Record<string, unknown>;
}

export interface DataReportAssembleArtifact {
  fileCount: number;
  routeName?: string;
}

export interface DataReportDeterministicAssets {
  scaffoldFiles: DataReportSandpackFiles;
  moduleFiles: DataReportSandpackFiles;
  routeFiles: DataReportSandpackFiles;
}

export type DataReportPreviewStage =
  | 'analysis'
  | 'intent'
  | 'capability'
  | 'blueprint'
  | 'dependency'
  | 'types'
  | 'utils'
  | 'service'
  | 'hooks'
  | 'modules'
  | 'component'
  | 'page'
  | 'scaffold'
  | 'routes'
  | 'assemble'
  | 'postprocess';

export type DataReportSandpackStage = 'generate' | 'parse';
export type DataReportGenerationNode =
  | 'analysisNode'
  | 'scopeNode'
  | 'intentNode'
  | 'capabilityNode'
  | 'componentNode'
  | 'structureNode'
  | 'dependencyNode'
  | 'typeNode'
  | 'utilsNode'
  | 'mockDataNode'
  | 'serviceNode'
  | 'hooksNode'
  | 'componentSubgraph'
  | 'pageSubgraph'
  | 'layoutNode'
  | 'styleGenNode'
  | 'appGenNode'
  | 'assembleNode'
  | 'postProcessNode';

export type DataReportNodeModelOverrides = Partial<Record<DataReportGenerationNode, string>>;

export type DataReportSandpackFiles = Record<string, string>;

export interface DataReportSandpackPayload {
  status: 'success';
  files: DataReportSandpackFiles;
}

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
