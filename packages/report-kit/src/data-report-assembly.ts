import type { DataReportBlueprintResult } from './data-report-blueprint';
import type { DataReportModuleScaffoldResult } from './data-report-module-scaffold';
import type { DataReportScaffoldFile } from './data-report-scaffold';
import {
  postProcessDataReportSandpackFiles,
  type DataReportAstPostProcessSummary
} from './data-report-ast-postprocess';
import { buildDataReportRoutes } from './data-report-routes';
import { getFrontendTemplate, resolveFrontendTemplateDir } from '@agent/templates';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface DataReportAssemblyPlan {
  totalFiles: number;
  moduleArtifacts: Array<{
    moduleId: string;
    filePaths: string[];
  }>;
  sharedArtifacts: string[];
  routeArtifacts: string[];
  deliveryManifest: string[];
  postProcessSummary: DataReportAstPostProcessSummary;
}

export interface DataReportAssemblyResult {
  blueprint: DataReportBlueprintResult;
  moduleResults: DataReportModuleScaffoldResult[];
  sharedFiles: DataReportScaffoldFile[];
  routeFiles: DataReportScaffoldFile[];
  assemblyPlan: DataReportAssemblyPlan;
  sandpackFiles: Record<string, { code: string }>;
}

export type DataReportPostProcessFiles = (files: Record<string, { code: string }>) => {
  files: Record<string, { code: string }>;
  summary: DataReportAstPostProcessSummary;
};

export function assembleDataReportBundle(params: {
  blueprint: DataReportBlueprintResult;
  moduleResults: DataReportModuleScaffoldResult[];
  sharedFiles: DataReportScaffoldFile[];
  routeFiles?: DataReportScaffoldFile[];
}): DataReportAssemblyResult {
  return assembleDataReportBundleWithPostProcess(params, postProcessDataReportSandpackFiles);
}

export function assembleDataReportBundleWithPostProcess(
  params: {
    blueprint: DataReportBlueprintResult;
    moduleResults: DataReportModuleScaffoldResult[];
    sharedFiles: DataReportScaffoldFile[];
    routeFiles?: DataReportScaffoldFile[];
  },
  postProcessFiles: DataReportPostProcessFiles
): DataReportAssemblyResult {
  const routeFiles = params.routeFiles ?? buildDataReportRoutes(params.blueprint).files;
  const moduleFileMap = new Map<string, { moduleId: string; path: string }>();
  const moduleArtifacts = params.moduleResults.map(result => {
    const filePaths = result.files.map(file => file.path);
    for (const path of filePaths) {
      if (!moduleFileMap.has(path)) {
        moduleFileMap.set(path, { moduleId: result.module.id, path });
      }
    }
    return {
      moduleId: result.module.id,
      filePaths
    };
  });

  const sharedArtifacts = params.sharedFiles.map(file => file.path);
  const routeArtifacts = routeFiles.map(file => file.path);
  const manifestSet = new Set<string>();
  for (const artifact of sharedArtifacts) {
    manifestSet.add(artifact);
  }
  for (const artifact of routeArtifacts) {
    manifestSet.add(artifact);
  }
  for (const artifact of moduleArtifacts.flatMap(item => item.filePaths)) {
    if (!manifestSet.has(artifact)) {
      manifestSet.add(artifact);
    }
  }

  const assembledFiles = buildSandpackFiles({
    blueprint: params.blueprint,
    moduleResults: params.moduleResults,
    sharedFiles: params.sharedFiles,
    routeFiles
  });

  const { sandpackFiles, postProcessSummary } = safelyPostProcessSandpackFiles(assembledFiles, postProcessFiles);

  return {
    blueprint: params.blueprint,
    moduleResults: params.moduleResults,
    sharedFiles: params.sharedFiles,
    routeFiles,
    assemblyPlan: {
      totalFiles: manifestSet.size,
      moduleArtifacts,
      sharedArtifacts,
      routeArtifacts,
      deliveryManifest: Array.from(manifestSet.values()),
      postProcessSummary
    },
    sandpackFiles
  };
}

function safelyPostProcessSandpackFiles(
  files: Record<string, { code: string }>,
  postProcessFiles: DataReportPostProcessFiles
) {
  try {
    const result = postProcessFiles(files);
    return {
      sandpackFiles: result.files,
      postProcessSummary: result.summary
    };
  } catch (error) {
    return {
      sandpackFiles: files,
      postProcessSummary: {
        pending: false as const,
        hook: 'data-report-ast-postprocess' as const,
        processedFiles: Object.keys(files).length,
        modifiedFiles: 0,
        appliedFixes: 0,
        fallbackUsed: true,
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

function buildSandpackFiles(params: {
  blueprint: DataReportBlueprintResult;
  moduleResults: DataReportModuleScaffoldResult[];
  sharedFiles: DataReportScaffoldFile[];
  routeFiles: DataReportScaffoldFile[];
}) {
  const files: Record<string, { code: string }> = {};
  const templateDir = resolveFrontendTemplateDir('react-ts');
  const template = getFrontendTemplate('react-ts');
  const templateFiles = templateDir && template ? template.entryFiles : [];

  for (const templateFile of templateFiles) {
    if (templateFile === 'styles.css' || templateFile === 'App.tsx' || templateFile === 'index.tsx') {
      continue;
    }

    const outputPath = templateFile.startsWith('/') ? `/src${templateFile}` : `/src/${templateFile}`;
    const templateCode = readFileSync(join(templateDir!, templateFile), 'utf8');
    files[outputPath] = {
      code: templateFile === 'index.tsx' ? templateCode.replace("import './styles.css';\n", '') : templateCode
    };
  }

  for (const file of collectBundleFiles(params)) {
    files[normalizeSandpackPath(file.path)] = {
      code: file.content
    };
  }

  return files;
}

function collectBundleFiles(params: {
  moduleResults: DataReportModuleScaffoldResult[];
  sharedFiles: DataReportScaffoldFile[];
  routeFiles: DataReportScaffoldFile[];
}) {
  const byPath = new Map<string, DataReportScaffoldFile>();

  for (const file of params.sharedFiles) {
    byPath.set(file.path, file);
  }

  for (const file of params.routeFiles) {
    byPath.set(file.path, file);
  }

  for (const moduleResult of params.moduleResults) {
    for (const file of moduleResult.files) {
      if (!byPath.has(file.path)) {
        byPath.set(file.path, file);
      }
    }
  }

  return Array.from(byPath.values());
}

function normalizeSandpackPath(filePath: string) {
  return filePath.startsWith('/') ? filePath : `/${filePath}`;
}
