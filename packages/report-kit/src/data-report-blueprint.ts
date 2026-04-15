import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getFrontendTemplate, resolveFrontendTemplateDir } from '@agent/templates';

import { collectBonusCenterTemplateEntries, findMatchedBonusCenterEntry } from './data-report-blueprint-template';

export type DataReportScope = 'single' | 'multiple' | 'shell-first';
export type DataReportSingleStructureMode = 'page-only' | 'component-files';

export interface DataReportModuleBlueprint {
  id: string;
  componentDir: string;
  entryFile: string;
  sourceDir?: string;
}

export interface DataReportBlueprintResult {
  scope: DataReportScope;
  templateRef: 'bonusCenterData' | 'generic-report';
  templateId: string;
  baseDir: string;
  routeName: string;
  routeTitle: string;
  templateApiCount: number;
  pageDir: string;
  servicesDir: string;
  typesDir: string;
  routesFile: string;
  modules: DataReportModuleBlueprint[];
  moduleIds: string[];
  sharedFiles: string[];
  moduleFilePatterns: string[];
  assemblyOrder: string[];
  plannedFiles: string[];
}

interface BonusCenterTemplateEntry {
  key: string;
  moduleId: string;
  routeName: string;
  title: string;
  apiName?: string;
}

interface StructuredReportIntent {
  pageTitle?: string;
  reportName?: string;
  serviceKey?: string;
  fields: string[];
  routeName?: string;
}

const MULTIPLE_SCOPE_PATTERN = /(多个|多张|多页|multi|批量|一组|多个报表)/i;
const SHELL_SCOPE_PATTERN = /(骨架|shell|先搭|容器)/i;
const BIG_DATA_INTERFACE_PATTERN = /(大数据接口|big\s*data\s*api)[：:]\s*([a-z0-9_]+)/gi;
function normalize(text: string) {
  return text.trim().toLowerCase();
}

function extractLabeledValue(text: string, label: string) {
  const match = text.match(new RegExp(`${label}\\s*[：:]\\s*([^\\n]+)`, 'i'));
  return match?.[1]?.trim();
}

function splitFieldList(value: string | undefined) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(/[，,、\s|/]+/)
        .map(item => item.trim())
        .filter(Boolean)
    )
  );
}

function camelCase(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function normalizeRouteNameFromServiceKey(serviceKey: string) {
  const normalized = serviceKey.trim();
  if (/^get_bc_exchange_mall_data$/i.test(normalized)) {
    return 'silverCoinExchangeRecord';
  }

  return camelCase(
    normalized
      .replace(/^get_/i, '')
      .replace(/_data$/i, '')
      .replace(/^bc_/, 'bc ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, char => char.toUpperCase())
      .replace(/\s+/g, '')
  );
}

function extractStructuredReportIntent(
  goal: string,
  taskContext: string | undefined
): StructuredReportIntent | undefined {
  const text = `${goal}\n${taskContext ?? ''}`;
  const pageTitle = extractLabeledValue(text, '标题');
  const reportName = extractLabeledValue(text, '报表名称');
  const serviceKey = extractLabeledValue(text, '大数据接口');
  const fields = splitFieldList(
    extractLabeledValue(text, '字段列表') ?? extractLabeledValue(text, '展示字段') ?? extractLabeledValue(text, '字段')
  );

  if (!pageTitle && !reportName && !serviceKey && fields.length === 0) {
    return undefined;
  }

  return {
    pageTitle,
    reportName,
    serviceKey,
    fields,
    routeName: serviceKey
      ? normalizeRouteNameFromServiceKey(serviceKey)
      : reportName
        ? camelCase(reportName)
        : undefined
  };
}

function countDeclaredBigDataInterfaces(goal: string, taskContext: string | undefined) {
  const text = `${goal}\n${taskContext ?? ''}`;
  const matches = Array.from(text.matchAll(BIG_DATA_INTERFACE_PATTERN));
  return new Set(matches.map(match => match[2]?.trim()).filter(Boolean)).size;
}

function resolveScope(
  goal: string,
  taskContext: string | undefined,
  templateEntries: BonusCenterTemplateEntry[]
): DataReportScope {
  const text = normalize(`${goal}\n${taskContext ?? ''}`);
  if (MULTIPLE_SCOPE_PATTERN.test(text)) return 'multiple';
  if (SHELL_SCOPE_PATTERN.test(text)) return 'shell-first';
  const structuredIntent = extractStructuredReportIntent(goal, taskContext);
  if (
    structuredIntent &&
    (structuredIntent.reportName || structuredIntent.serviceKey || structuredIntent.fields.length > 0)
  ) {
    return 'single';
  }
  const declaredInterfaceCount = countDeclaredBigDataInterfaces(goal, taskContext);
  if (declaredInterfaceCount > 1) return 'multiple';
  if (declaredInterfaceCount === 1) return 'single';
  if (findMatchedBonusCenterEntry(goal, taskContext, templateEntries, structuredIntent)) return 'single';
  return 'single';
}

function resolveTemplate(goal: string, taskContext?: string): 'bonusCenterData' | 'generic-report' {
  return /bonuscenterdata|bonus center data|bonus center|bonus_center/i.test(`${goal}\n${taskContext ?? ''}`)
    ? 'bonusCenterData'
    : 'generic-report';
}

function resolveTemplateId(goal: string, taskContext?: string, explicitTemplateId?: string) {
  if (explicitTemplateId) {
    return explicitTemplateId;
  }

  return resolveTemplate(goal, taskContext) === 'bonusCenterData' ? 'bonus-center-data' : 'react-ts';
}

function listTemplateFiles(rootDir: string, currentDir = rootDir): string[] {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTemplateFiles(rootDir, nextPath));
      continue;
    }
    files.push(nextPath.replace(`${rootDir}/`, ''));
  }

  return files.sort();
}

function buildBonusCenterModules(templateDir: string, routeName: string): DataReportModuleBlueprint[] {
  const componentsDir = join(templateDir, 'pages', 'dataDashboard', 'bonusCenterData', 'components');
  return readdirSync(componentsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== 'Search')
    .map(entry => ({
      id: entry.name,
      componentDir: `src/pages/dataDashboard/${routeName}/components/${entry.name}`,
      entryFile: `src/pages/dataDashboard/${routeName}/components/${entry.name}/index.tsx`,
      sourceDir: `pages/dataDashboard/bonusCenterData/components/${entry.name}`
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildGenericModules(scope: DataReportScope): DataReportModuleBlueprint[] {
  const ids = scope === 'multiple' ? ['Overview', 'Trend', 'Conversion'] : ['Overview'];
  return ids.map(id => ({
    id,
    componentDir: `data/generated/data-report/modules/${id}`,
    entryFile: `data/generated/data-report/modules/${id}.tsx`,
    sourceDir: undefined
  }));
}

const SINGLE_REPORT_VISUAL_PATTERN = /(趋势|图表|折线图|柱状图|饼图|指标|指标卡|metric|metrics|chart|charts)/i;

export function inferSingleReportStructure(params: { goal: string; routeName: string }) {
  const mode: DataReportSingleStructureMode = SINGLE_REPORT_VISUAL_PATTERN.test(params.goal)
    ? 'component-files'
    : 'page-only';

  return {
    mode,
    componentBaseName: params.routeName.charAt(0).toUpperCase() + params.routeName.slice(1)
  };
}

export function buildDataReportBlueprint(params: {
  goal: string;
  taskContext?: string;
  baseDir?: string;
  templateId?: string;
}): DataReportBlueprintResult {
  const templateRef = resolveTemplate(params.goal, params.taskContext);
  const templateId = resolveTemplateId(params.goal, params.taskContext, params.templateId);
  const template = getFrontendTemplate(templateId);
  const templateDir = resolveFrontendTemplateDir(templateId);
  const templateEntries =
    templateId === 'bonus-center-data' && templateDir ? collectBonusCenterTemplateEntries(templateDir) : [];
  const structuredIntent = extractStructuredReportIntent(params.goal, params.taskContext);
  const matchedEntry = findMatchedBonusCenterEntry(params.goal, params.taskContext, templateEntries, structuredIntent);
  const scope = resolveScope(params.goal, params.taskContext, templateEntries);
  const routeName =
    matchedEntry?.routeName ??
    (scope === 'single' ? structuredIntent?.routeName : undefined) ??
    (templateId === 'bonus-center-data' ? 'bonusCenterData' : 'generatedReport');
  const routeTitle =
    matchedEntry?.title ??
    structuredIntent?.reportName ??
    structuredIntent?.pageTitle ??
    (templateId === 'bonus-center-data' ? 'Bonus Center 数据报表' : 'Data Report Preview');
  const baseDir = params.baseDir ?? template?.defaultBaseDir ?? 'data/generated/data-report';

  if (!template || !templateDir) {
    return {
      scope,
      templateRef,
      templateId,
      baseDir,
      routeName,
      routeTitle,
      templateApiCount: templateEntries.length,
      pageDir: `${baseDir}/index`,
      servicesDir: `${baseDir}/services`,
      typesDir: `${baseDir}/types`,
      routesFile: `${baseDir}/routes.ts`,
      modules: buildGenericModules(scope),
      moduleIds: buildGenericModules(scope).map(item => item.id),
      sharedFiles: [],
      moduleFilePatterns: [],
      assemblyOrder: ['shared'],
      plannedFiles: []
    };
  }

  if (templateId === 'bonus-center-data') {
    const modules = buildBonusCenterModules(templateDir, routeName).filter(module =>
      scope === 'single' ? module.id === (matchedEntry?.moduleId ?? 'UserRemain') : true
    );
    const sharedEntryFiles = template.sharedEntryFiles ?? template.entryFiles;
    const moduleRelativePrefixes = new Set(modules.map(module => `${module.sourceDir}/`));
    const plannedFiles = listTemplateFiles(templateDir)
      .filter(file => {
        if (sharedEntryFiles.includes(file)) {
          return true;
        }
        for (const prefix of moduleRelativePrefixes) {
          if (file.startsWith(prefix)) {
            return true;
          }
        }
        return false;
      })
      .map(file =>
        `${baseDir}/${file}`
          .replace('/pages/dataDashboard/bonusCenterData', `/pages/dataDashboard/${routeName}`)
          .replace('/services/data/bonusCenter.ts', `/services/data/${routeName}.ts`)
          .replace('/types/data/bonusCenter.ts', `/types/data/${routeName}.ts`)
      );
    return {
      scope,
      templateRef,
      templateId,
      baseDir,
      routeName,
      routeTitle,
      templateApiCount: templateEntries.length,
      pageDir: `${baseDir}/pages/dataDashboard/${routeName}`,
      servicesDir: `${baseDir}/services/data`,
      typesDir: `${baseDir}/types/data`,
      routesFile: `${baseDir}/routes.ts`,
      modules,
      moduleIds: modules.map(item => item.id),
      sharedFiles: sharedEntryFiles.map(file =>
        `${baseDir}/${file}`
          .replace('/pages/dataDashboard/bonusCenterData', `/pages/dataDashboard/${routeName}`)
          .replace('/services/data/bonusCenter.ts', `/services/data/${routeName}.ts`)
          .replace('/types/data/bonusCenter.ts', `/types/data/${routeName}.ts`)
      ),
      moduleFilePatterns: modules.map(item => `${item.componentDir}/**/*`),
      assemblyOrder: [...modules.map(item => `module:${item.id}`), 'shared'],
      plannedFiles
    };
  }

  const outputRoot = template.outputRoot ?? 'template';
  const pathPrefix = outputRoot ? `${baseDir}/${outputRoot}` : baseDir;
  const modules = buildGenericModules(scope);
  const plannedFiles = template.entryFiles.map(file => `${pathPrefix}/${file}`);
  return {
    scope,
    templateRef,
    templateId,
    baseDir,
    routeName,
    routeTitle,
    templateApiCount: templateEntries.length,
    pageDir: `${pathPrefix}`,
    servicesDir: `${baseDir}/services`,
    typesDir: `${baseDir}/types`,
    routesFile: `${baseDir}/routes.ts`,
    modules,
    moduleIds: modules.map(item => item.id),
    sharedFiles: plannedFiles,
    moduleFilePatterns: modules.map(item => `${item.componentDir}/**/*`),
    assemblyOrder: [...modules.map(item => `module:${item.id}`), 'shared'],
    plannedFiles
  };
}
