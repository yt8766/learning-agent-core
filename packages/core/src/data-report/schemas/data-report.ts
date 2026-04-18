import { z } from 'zod';

export const DataReportScopeSchema = z.enum(['single', 'multiple', 'shell-first']);

export const DataReportModuleBlueprintSchema = z.object({
  id: z.string(),
  componentDir: z.string(),
  entryFile: z.string(),
  sourceDir: z.string().optional()
});

export const DataReportPlannedFileSchema = z.object({
  path: z.string(),
  kind: z.enum([
    'app',
    'entry',
    'route',
    'style',
    'package',
    'tsconfig',
    'page',
    'component',
    'service',
    'type',
    'hook',
    'util'
  ]),
  role: z.string()
});

export const DataReportBlueprintResultSchema = z.object({
  scope: DataReportScopeSchema,
  templateRef: z.enum(['bonusCenterData', 'generic-report']),
  templateId: z.string(),
  baseDir: z.string(),
  routeName: z.string(),
  routeTitle: z.string(),
  templateApiCount: z.number(),
  pageDir: z.string(),
  servicesDir: z.string(),
  typesDir: z.string(),
  routesFile: z.string(),
  modules: z.array(DataReportModuleBlueprintSchema),
  moduleIds: z.array(z.string()),
  sharedFiles: z.array(z.string()),
  moduleFilePatterns: z.array(z.string()),
  assemblyOrder: z.array(z.string()),
  plannedFiles: z.array(z.string())
});

export const DataReportAnalysisArtifactSchema = z.object({
  reportType: z.literal('data-dashboard'),
  requiresSandpack: z.literal(true),
  requiresMultiFileOutput: z.literal(true),
  title: z.string(),
  routeName: z.string(),
  templateId: z.string(),
  referenceMode: DataReportScopeSchema,
  dataSourceHint: z.string().optional(),
  keywords: z.array(z.string())
});

export const DataReportIntentArtifactSchema = z.object({
  action: z.literal('generate-report-page'),
  routeName: z.string(),
  moduleBasePath: z.string(),
  serviceBaseName: z.string()
});

export const DataReportScopeDecisionArtifactSchema = z.object({
  referenceMode: DataReportScopeSchema,
  reason: z.literal('template-inspection'),
  templateApiCount: z.number(),
  routeName: z.string(),
  routeTitle: z.string(),
  selectedModuleIds: z.array(z.string())
});

export const DataReportCapabilityArtifactSchema = z.object({
  llmGeneration: z.literal(true),
  sandpackAssembly: z.literal(true),
  astPostProcess: z.literal(true),
  deterministicPlanning: z.literal(true)
});

const DataReportNamedPathSchema = z.object({
  name: z.string(),
  path: z.string()
});

export const DataReportComponentArtifactSchema = z.object({
  singleReportMode: z.enum(['page-only', 'component-files']).optional(),
  planned: z.array(
    DataReportNamedPathSchema.extend({
      purpose: z.string()
    })
  )
});

export const DataReportStructureArtifactSchema = z.object({
  routeName: z.string(),
  moduleDir: z.string(),
  files: z.array(DataReportPlannedFileSchema),
  rootFiles: z.array(z.string()),
  pageFile: z.string(),
  serviceFile: z.string(),
  typesFile: z.string()
});

export const DataReportDependencyArtifactSchema = z.object({
  runtime: z.literal('react-ts'),
  packages: z.array(z.string()),
  importStrategy: z.literal('static-imports-only')
});

export const DataReportTypesArtifactSchema = z.object({
  plannedFile: z.string(),
  entities: z.array(z.string())
});

export const DataReportUtilsArtifactSchema = z.object({
  planned: z.array(DataReportNamedPathSchema)
});

export const DataReportMockDataArtifactSchema = z.object({
  mode: z.enum(['disabled', 'file']),
  note: z.string(),
  mockFile: z.string().optional(),
  payload: z.unknown().optional()
});

export const DataReportServiceArtifactSchema = z.object({
  plannedFile: z.string(),
  exportName: z.string()
});

export const DataReportHooksArtifactSchema = z.object({
  planned: z.array(DataReportNamedPathSchema)
});

export const DataReportGeneratedModuleArtifactSchema = z.object({
  path: z.string(),
  status: z.literal('planned'),
  dependsOn: z.array(z.string()).optional()
});

export const DataReportLayoutArtifactSchema = z.object({
  root: z.string(),
  routeFile: z.string()
});

export const DataReportStyleArtifactSchema = z.object({
  target: z.literal('tailwind-inline'),
  theme: z.literal('bonus-center')
});

export const DataReportAppArtifactSchema = z.object({
  generated: z.boolean(),
  source: z.enum(['llm', 'llm-parallel', 'tool-fallback', 'deterministic-root']),
  contextDigest: z.string().optional()
});

export const DataReportFileGenerationEventSchema = z.object({
  phase: z.enum(['leaf', 'aggregate']),
  path: z.string(),
  status: z.enum(['pending', 'success'])
});

export const DataReportGenerationNodeSchema = z.enum([
  'analysisNode',
  'scopeNode',
  'intentNode',
  'capabilityNode',
  'componentNode',
  'structureNode',
  'dependencyNode',
  'typeNode',
  'utilsNode',
  'mockDataNode',
  'serviceNode',
  'hooksNode',
  'componentSubgraph',
  'pageSubgraph',
  'layoutNode',
  'styleGenNode',
  'appGenNode',
  'assembleNode',
  'postProcessNode'
]);

export const DataReportNodeStageEventSchema = z.object({
  node: DataReportGenerationNodeSchema,
  status: z.enum(['pending', 'success', 'error']),
  details: z.record(z.string(), z.unknown()).optional()
});

export const DataReportAssembleArtifactSchema = z.object({
  fileCount: z.number(),
  routeName: z.string().optional()
});

export const DataReportPreviewStageSchema = z.enum([
  'analysis',
  'intent',
  'capability',
  'blueprint',
  'dependency',
  'types',
  'utils',
  'service',
  'hooks',
  'modules',
  'component',
  'page',
  'scaffold',
  'routes',
  'assemble',
  'postprocess'
]);

export const DataReportSandpackStageSchema = z.enum(['generate', 'parse']);
export const DataReportNodeModelOverridesSchema = z.record(z.string(), z.string());
export const DataReportSandpackFilesSchema = z.record(z.string(), z.string());

export const DataReportSandpackPayloadSchema = z.object({
  status: z.literal('success'),
  files: DataReportSandpackFilesSchema
});

export const DataReportDeterministicAssetsSchema = z.object({
  scaffoldFiles: DataReportSandpackFilesSchema,
  moduleFiles: DataReportSandpackFilesSchema,
  routeFiles: DataReportSandpackFilesSchema
});
