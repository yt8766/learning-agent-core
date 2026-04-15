import type { DataReportBlueprintResult } from '@agent/report-kit';

import type {
  DataReportGenerationNode,
  DataReportGeneratedModuleArtifact,
  DataReportPlannedFile,
  DataReportSandpackFiles,
  DataReportSandpackGraphState,
  DataReportStructureArtifact
} from '../../../types/data-report';

export type NodePatch = Partial<DataReportSandpackGraphState>;

export function startNode(state: DataReportSandpackGraphState, node: DataReportGenerationNode) {
  const details =
    node === 'appGenNode'
      ? {
          referenceMode: state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode ?? state.blueprint?.scope,
          templateId: state.blueprint?.templateId ?? state.analysis?.templateId,
          appStrategy:
            (state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode ?? state.blueprint?.scope) ===
              'single' && (state.blueprint?.templateId ?? state.analysis?.templateId) === 'bonus-center-data'
              ? 'deterministic-root'
              : shouldDeterministicMultiAssembly(state)
                ? 'tool-fallback'
                : 'llm'
        }
      : undefined;

  state.onStage?.({ node, status: 'pending', details });
}

function buildNodeStageDetails(node: DataReportGenerationNode, patch: NodePatch) {
  switch (node) {
    case 'analysisNode':
      return patch.analysis
        ? {
            templateId: patch.analysis.templateId,
            routeName: patch.analysis.routeName,
            dataSourceHint: patch.analysis.dataSourceHint
          }
        : undefined;
    case 'scopeNode':
      return patch.scopeDecision
        ? {
            referenceMode: patch.scopeDecision.referenceMode,
            routeName: patch.scopeDecision.routeName,
            routeTitle: patch.scopeDecision.routeTitle,
            templateApiCount: patch.scopeDecision.templateApiCount
          }
        : undefined;
    case 'componentNode':
      return patch.components
        ? {
            singleReportMode: patch.components.singleReportMode,
            plannedCount: patch.components.planned.length
          }
        : undefined;
    case 'appGenNode':
      return patch.app
        ? {
            appSource: patch.app.source
          }
        : undefined;
    case 'assembleNode':
      return patch.assemble
        ? {
            fileCount: patch.assemble.fileCount,
            routeName: patch.assemble.routeName
          }
        : undefined;
    default:
      return undefined;
  }
}

export function traceNode(
  state: DataReportSandpackGraphState,
  node: DataReportGenerationNode,
  patch: NodePatch
): NodePatch {
  state.onStage?.({ node, status: 'success', details: buildNodeStageDetails(node, patch) });
  return {
    ...patch,
    currentStage: node,
    nodeTrace: [...(state.nodeTrace ?? []), node]
  };
}

export function routeNameFromGoal(goal: string) {
  if (/bonus\s*center|银币|兑换/i.test(goal)) {
    return 'bonusCenterData';
  }
  return 'generatedReport';
}

export function titleFromGoal(goal: string) {
  if (/bonus\s*center|银币|兑换/i.test(goal)) {
    return 'Bonus Center 数据报表';
  }

  return goal.trim() || '数据报表';
}

export function dataSourceHintFromGoal(goal: string) {
  const matched = goal.match(/\b[a-z][a-z0-9_]{4,}\b/gi)?.find(token => token.includes('_'));
  return matched;
}

export function pascalCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizeTemplatePath(path: string, routeName: string) {
  const normalized = path.startsWith('src/') ? path : `src/${path}`;
  const renamed = normalized
    .split('bonusCenterData')
    .join(routeName)
    .replace('/services/data/bonusCenter.ts', `/services/data/${routeName}.ts`)
    .replace('/types/data/bonusCenter.ts', `/types/data/${routeName}.ts`);
  return renamed.startsWith('/') ? renamed : `/${renamed}`;
}

function roleFromPath(path: string) {
  if (path === '/App.tsx') return '顶层入口';
  if (path === '/index.tsx') return 'Sandpack 启动入口';
  if (path === '/routes.ts') return '预览路由片段';
  if (path === '/package.json') return '依赖声明';
  if (path === '/tsconfig.json') return 'TypeScript 配置';
  if (path.endsWith('/index.tsx') && path.includes('/components/')) return '模块入口组件';
  if (path.endsWith('Chart.tsx')) return '图表组件';
  if (path.endsWith('Metrics.tsx')) return '指标组件';
  if (path.endsWith('Table.tsx')) return '表格组件';
  if (path.includes('/components/Search/')) return '查询筛选组件';
  if (path.endsWith('/config.tsx')) return '页面配置';
  if (path.startsWith('/src/services/data/')) return '数据服务';
  if (path.startsWith('/src/types/data/')) return '类型定义';
  if (path.includes('/hooks/')) return '数据 Hook';
  if (path.includes('/utils/')) return '工具函数';
  if (path.endsWith('/index.tsx')) return '报表页面';
  return '生成文件';
}

function kindFromPath(path: string): DataReportPlannedFile['kind'] {
  if (path === '/App.tsx') return 'app';
  if (path === '/index.tsx') return 'entry';
  if (path === '/routes.ts') return 'route';
  if (path === '/package.json') return 'package';
  if (path === '/tsconfig.json') return 'tsconfig';
  if (path.startsWith('/src/services/data/')) return 'service';
  if (path.startsWith('/src/types/data/')) return 'type';
  if (path.includes('/hooks/')) return 'hook';
  if (path.includes('/utils/') || path.endsWith('/config.tsx')) return 'util';
  if (path.includes('/components/')) return 'component';
  return 'page';
}

export function createStructureFromBlueprint(
  blueprint: DataReportBlueprintResult,
  routeName: string,
  components: Array<{ name: string; path: string }> = [],
  singleReportMode: 'page-only' | 'component-files' | undefined = undefined
): DataReportStructureArtifact {
  const pageDir = `/src/pages/dataDashboard/${routeName}`;
  const sharedTemplateFiles = [
    '/App.tsx',
    '/src/index.tsx',
    '/package.json',
    '/tsconfig.json',
    ...(blueprint.scope === 'single' ? [] : blueprint.sharedFiles.map(file => normalizeTemplatePath(file, routeName)))
  ];
  const moduleFiles =
    blueprint.scope === 'single'
      ? singleReportMode === 'component-files'
        ? components.map(component => component.path)
        : []
      : blueprint.modules.flatMap(module => {
          const componentName = module.id;
          return [
            `${pageDir}/components/${componentName}/index.tsx`,
            `${pageDir}/components/${componentName}/${componentName}Chart.tsx`,
            `${pageDir}/components/${componentName}/${componentName}Metrics.tsx`,
            `${pageDir}/components/${componentName}/${componentName}Table.tsx`
          ];
        });
  const singleReportFiles =
    blueprint.scope === 'single'
      ? [
          `${pageDir}/index.tsx`,
          `/src/services/data/${routeName}.ts`,
          `/src/types/data/${routeName}.ts`,
          '/src/routes.ts'
        ]
      : [];
  const allFiles = Array.from(new Set([...sharedTemplateFiles, ...singleReportFiles, ...moduleFiles])).sort();
  const files = allFiles.map<DataReportPlannedFile>(path => ({
    path,
    kind: kindFromPath(path),
    role: roleFromPath(path)
  }));

  return {
    routeName,
    moduleDir: pageDir,
    files,
    rootFiles: ['/App.tsx', '/src/index.tsx', '/src/routes.ts', '/package.json', '/tsconfig.json'],
    pageFile: `${pageDir}/index.tsx`,
    serviceFile: `/src/services/data/${routeName}.ts`,
    typesFile: `/src/types/data/${routeName}.ts`
  };
}

export function buildGenerationContext(state: DataReportSandpackGraphState) {
  const sections = [
    ['analysis', state.analysis],
    ['intent', state.intent],
    ['capabilities', state.capabilities],
    ['blueprint', state.blueprint],
    ['components', state.components],
    ['structure', state.structure],
    ['dependency', state.dependency],
    ['types', state.types],
    ['utils', state.utils],
    ['mockData', state.mockData],
    ['service', state.service],
    ['hooks', state.hooks],
    ['componentsCode', state.componentsCode],
    ['pagesCode', state.pagesCode],
    ['layouts', state.layouts],
    ['styles', state.styles]
  ]
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `### ${name}\n${JSON.stringify(value, null, 2)}`);

  return ['请严格基于下面已经规划好的节点产物生成最终 Sandpack 多文件代码：', ...sections].join('\n\n');
}

export function buildPlannedModuleArtifacts(
  structure: DataReportStructureArtifact | undefined,
  kind: 'component' | 'page'
): DataReportGeneratedModuleArtifact[] {
  if (!structure) {
    return [];
  }

  const targets = structure.files.filter(file => file.kind === kind);
  return targets.map(file => ({
    path: file.path,
    status: 'planned',
    dependsOn:
      kind === 'component' ? [structure.typesFile] : [structure.pageFile, structure.serviceFile, structure.typesFile]
  }));
}

export function defaultReportPath(state: DataReportSandpackGraphState) {
  return `/src/pages/dataDashboard/${routeNameFromGoal(state.goal)}/index.tsx`;
}

export function shouldDeterministicMultiAssembly(state: DataReportSandpackGraphState) {
  const referenceMode = state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode ?? state.blueprint?.scope;
  return (
    referenceMode === 'multiple' &&
    state.blueprint?.templateId === 'bonus-center-data' &&
    /(多个|多张|多页|multi|批量|一组|多个报表)/i.test(state.goal)
  );
}

function normalizeSandpackPath(filePath: string) {
  return filePath.startsWith('/') ? filePath : `/${filePath}`;
}

export function scaffoldFilesToSandpackFiles(files: Array<{ path: string; content: string }>): DataReportSandpackFiles {
  return Object.fromEntries(files.map(file => [normalizeSandpackPath(file.path), file.content]));
}

export function emitFileStageEvents(
  state: DataReportSandpackGraphState,
  files: DataReportSandpackFiles | undefined,
  phase: 'leaf' | 'aggregate'
) {
  if (!files) {
    return;
  }

  const filePaths = Object.keys(files).sort((left, right) => left.localeCompare(right));
  for (const filePath of filePaths) {
    state.onFileStage?.({ phase, path: filePath, status: 'pending' });
  }
  for (const filePath of filePaths) {
    state.onFileStage?.({ phase, path: filePath, status: 'success' });
  }
}

export function toToolFiles(files: DataReportSandpackFiles) {
  return Object.fromEntries(Object.entries(files).map(([filePath, code]) => [filePath, { code }]));
}

export function fromToolFiles(files: Record<string, { code: string }>) {
  return Object.fromEntries(Object.entries(files).map(([filePath, file]) => [filePath, file.code]));
}
