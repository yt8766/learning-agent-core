import {
  assembleDataReportBundle,
  type DataReportAssemblyResult,
  buildDataReportBlueprint,
  type DataReportBlueprintResult,
  buildDataReportModuleScaffold,
  type DataReportModuleScaffoldResult,
  buildDataReportRoutes,
  type DataReportRouteResult,
  buildDataReportScaffold,
  type DataReportScaffoldResult
} from '@agent/report-kit';

import type { WorkflowPresetDefinition } from '@agent/core';
import type { DataReportPreviewStage } from '../../types/data-report';

export interface WorkflowPresetResolution {
  normalizedGoal: string;
  preset: WorkflowPresetDefinition;
  source: 'explicit' | 'inferred' | 'default';
  command?: string;
}

export type ResolveWorkflowPresetFn = (goal: string) => WorkflowPresetResolution;

export interface DataReportPreviewStageEvent {
  stage: DataReportPreviewStage;
  status: 'pending' | 'success' | 'error';
  details?: Record<string, unknown>;
}

export interface DataReportPreviewArtifactSummary {
  scope: 'component' | 'page';
  fileCount: number;
  filePaths: string[];
}

export interface GenerateDataReportPreviewInput {
  goal: string;
  taskContext?: string;
  resolveWorkflowPreset: ResolveWorkflowPresetFn;
  onStage?: (event: DataReportPreviewStageEvent) => void;
}

export interface GenerateDataReportPreviewResult {
  workflowPresetId: string;
  blueprint: DataReportBlueprintResult;
  moduleResults: DataReportModuleScaffoldResult[];
  scaffold: DataReportScaffoldResult;
  routes: DataReportRouteResult;
  bundle: DataReportAssemblyResult;
  componentSummary: DataReportPreviewArtifactSummary;
  pageSummary: DataReportPreviewArtifactSummary;
  sandpackFiles: Record<string, { code: string }>;
}

export function generateDataReportPreview(params: GenerateDataReportPreviewInput): GenerateDataReportPreviewResult {
  const goal = runPreviewStage(params.onStage, 'analysis', () => params.goal.trim());
  const workflow = runPreviewStage(params.onStage, 'intent', () => params.resolveWorkflowPreset(goal));

  runPreviewStage(params.onStage, 'capability', () => ({
    mode: 'preview' as const,
    presetId: workflow.preset.id
  }));

  const blueprint = runPreviewStage(params.onStage, 'blueprint', () =>
    buildDataReportBlueprint({
      goal,
      taskContext: params.taskContext
    })
  );

  runPreviewStage(params.onStage, 'dependency', () => ({
    templateId: blueprint.templateId,
    sharedFiles: blueprint.sharedFiles,
    moduleFilePatterns: blueprint.moduleFilePatterns
  }));
  runPreviewStage(params.onStage, 'types', () => ({
    typesDir: blueprint.typesDir
  }));
  runPreviewStage(params.onStage, 'utils', () => ({
    plannedSharedFiles: blueprint.sharedFiles.filter(filePath => /utils?|helper|config/i.test(filePath))
  }));
  runPreviewStage(params.onStage, 'service', () => ({
    servicesDir: blueprint.servicesDir
  }));
  runPreviewStage(params.onStage, 'hooks', () => ({
    plannedHooks: blueprint.sharedFiles.filter(filePath => /hooks?/i.test(filePath))
  }));

  const moduleResults = runPreviewStage(params.onStage, 'modules', () =>
    blueprint.modules.map(module =>
      buildDataReportModuleScaffold({
        goal,
        taskContext: params.taskContext,
        templateId: blueprint.templateId,
        baseDir: blueprint.baseDir,
        moduleId: module.id
      })
    )
  );

  const componentSummary = runPreviewStage(params.onStage, 'component', () =>
    summarizeModuleArtifacts(moduleResults, 'component')
  );
  const pageSummary = runPreviewStage(params.onStage, 'page', () => summarizeModuleArtifacts(moduleResults, 'page'));

  const scaffold = runPreviewStage(params.onStage, 'scaffold', () =>
    buildDataReportScaffold({
      goal,
      taskContext: params.taskContext,
      templateId: blueprint.templateId,
      baseDir: blueprint.baseDir
    })
  );

  const routes = runPreviewStage(params.onStage, 'routes', () => buildDataReportRoutes(blueprint));

  const bundle = runPreviewStage(params.onStage, 'assemble', () =>
    assembleDataReportBundle({
      blueprint,
      moduleResults,
      sharedFiles: scaffold.files,
      routeFiles: routes.files
    })
  );

  params.onStage?.({ stage: 'postprocess', status: 'pending' });
  params.onStage?.({
    stage: 'postprocess',
    status: bundle.assemblyPlan.postProcessSummary.fallbackUsed ? 'error' : 'success',
    details: {
      appliedFixes: bundle.assemblyPlan.postProcessSummary.appliedFixes,
      fallbackUsed: bundle.assemblyPlan.postProcessSummary.fallbackUsed
    }
  });

  return {
    workflowPresetId: workflow.preset.id,
    blueprint,
    moduleResults,
    scaffold,
    routes,
    bundle,
    componentSummary,
    pageSummary,
    sandpackFiles: bundle.sandpackFiles
  };
}

function runPreviewStage<T>(
  onStage: GenerateDataReportPreviewInput['onStage'],
  stage: DataReportPreviewStage,
  action: () => T
) {
  onStage?.({ stage, status: 'pending' });
  try {
    const result = action();
    onStage?.({ stage, status: 'success' });
    return result;
  } catch (error) {
    onStage?.({ stage, status: 'error' });
    throw error;
  }
}

function summarizeModuleArtifacts(
  moduleResults: Array<{
    files: Array<{ path: string }>;
  }>,
  scope: 'component' | 'page'
): DataReportPreviewArtifactSummary {
  const matcher = scope === 'component' ? /components?\//i : /pages?\//i;
  const filePaths = moduleResults
    .flatMap(result => result.files.map(file => file.path))
    .filter(path => matcher.test(path));
  return {
    scope,
    fileCount: filePaths.length,
    filePaths
  };
}
