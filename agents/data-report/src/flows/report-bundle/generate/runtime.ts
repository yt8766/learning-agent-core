import type {
  DataReportJsonGenerateInput,
  DataReportJsonGenerateResult,
  DataReportJsonGraphHandlers,
  DataReportJsonRuntimeMeta,
  DataReportJsonStructuredInput,
  LlmProviderLike,
  LlmProviderMessage,
  ReportBundle,
  ReportDocument
} from '@agent/core';
import { ReportBundleSchema } from '@agent/core';

import { executeDataReportJsonGraph } from '../../data-report-json/runtime';

export interface ReportBundleGenerateInput {
  messages: LlmProviderMessage[];
  structuredSeed?: DataReportJsonStructuredInput;
  context?: {
    projectId?: string;
    currentProjectPath?: string;
  };
  llm?: LlmProviderLike;
  strictLlmBrandNew?: boolean;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  requestId?: string;
  disableCache?: boolean;
  artifactCacheKey?: string;
  nodeModelPolicy?: DataReportJsonGenerateInput['nodeModelPolicy'];
  nodeModelOverrides?: DataReportJsonGenerateInput['nodeModelOverrides'];
  onStage?: DataReportJsonGenerateInput['onStage'];
  onArtifact?: DataReportJsonGenerateInput['onArtifact'];
}

export interface ReportBundleGenerateResult {
  status: DataReportJsonGenerateResult['status'];
  bundle?: ReportBundle;
  primaryDocument?: ReportDocument;
  partialSchema?: DataReportJsonGenerateResult['partialSchema'];
  error?: DataReportJsonGenerateResult['error'];
  reportSummaries?: DataReportJsonGenerateResult['reportSummaries'];
  runtime: {
    executionPath: 'single-agent-generate';
    jsonRuntime?: DataReportJsonRuntimeMeta;
  };
  content: string;
  elapsedMs: number;
}

interface ReportBundleGenerateFlowDependencies {
  executeJsonGraph?: (
    input: DataReportJsonGenerateInput,
    handlers?: DataReportJsonGraphHandlers
  ) => Promise<DataReportJsonGenerateResult>;
}

function buildGoalFromMessages(input: ReportBundleGenerateInput): string {
  const messageLines = input.messages
    .map(message => ({
      role: message.role.trim().toUpperCase(),
      content: message.content.trim()
    }))
    .filter(message => message.content.length > 0)
    .map(message => `${message.role}: ${message.content}`);

  if (!messageLines.length) {
    throw new Error('Report bundle generate flow requires at least one message.');
  }

  const contextLines = [
    input.context?.projectId ? `PROJECT_ID: ${input.context.projectId}` : undefined,
    input.context?.currentProjectPath ? `CURRENT_PROJECT_PATH: ${input.context.currentProjectPath}` : undefined
  ].filter((value): value is string => Boolean(value));

  return [...contextLines, ...messageLines].join('\n\n');
}

function buildJsonInput(input: ReportBundleGenerateInput): DataReportJsonGenerateInput {
  return {
    goal: buildGoalFromMessages(input),
    reportSchemaInput: input.structuredSeed,
    llm: input.llm,
    strictLlmBrandNew: input.strictLlmBrandNew,
    modelId: input.modelId,
    temperature: input.temperature,
    maxTokens: input.maxTokens,
    requestId: input.requestId,
    disableCache: input.disableCache,
    artifactCacheKey: input.artifactCacheKey,
    nodeModelPolicy: input.nodeModelPolicy,
    nodeModelOverrides: input.nodeModelOverrides,
    onStage: input.onStage,
    onArtifact: input.onArtifact
  };
}

function buildSingleDocumentBundle(document: ReportDocument): ReportBundle {
  return ReportBundleSchema.parse({
    version: 'report-bundle.v1',
    kind: 'report-bundle',
    meta: {
      bundleId: document.meta.reportId,
      title: document.meta.title,
      mode: 'single-document'
    },
    documents: [document],
    patchOperations: document.patchOperations?.length ? document.patchOperations : undefined,
    warnings: document.warnings.length ? document.warnings : undefined
  });
}

function projectPrimaryDocument(bundle?: ReportBundle): ReportDocument | undefined {
  return bundle?.documents[0];
}

export async function executeReportBundleGenerateFlow(
  input: ReportBundleGenerateInput,
  dependencies: ReportBundleGenerateFlowDependencies = {},
  handlers: DataReportJsonGraphHandlers = {}
): Promise<ReportBundleGenerateResult> {
  const jsonResult = await (dependencies.executeJsonGraph ?? executeDataReportJsonGraph)(
    buildJsonInput(input),
    handlers
  );
  const bundle = jsonResult.schema ? buildSingleDocumentBundle(jsonResult.schema) : undefined;

  return {
    status: jsonResult.status,
    bundle,
    primaryDocument: projectPrimaryDocument(bundle),
    partialSchema: jsonResult.partialSchema,
    error: jsonResult.error,
    reportSummaries: jsonResult.reportSummaries,
    runtime: {
      executionPath: 'single-agent-generate',
      jsonRuntime: jsonResult.runtime
    },
    content: bundle ? JSON.stringify(bundle, null, 2) : jsonResult.content,
    elapsedMs: jsonResult.elapsedMs
  };
}
