import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { getFrontendTemplate, resolveFrontendTemplateDir } from '@agent/templates';

import { BONUS_CENTER_BLUEPRINT_TEMPLATE, resolveBonusCenterBlueprintDir } from '../blueprints/bonus-center-data';
import { BONUS_CENTER_SINGLE_REPORT_PAGE_TEMPLATE } from '../blueprints/bonus-center-data/single-report-page-template';
import {
  buildDataReportBlueprint,
  inferSingleReportStructure,
  type DataReportBlueprintResult
} from '../blueprints/data-report-blueprint';

export interface DataReportScaffoldFile {
  path: string;
  content: string;
  description: string;
}

export interface DataReportScaffoldResult {
  scope: DataReportBlueprintResult['scope'];
  templateRef: 'bonusCenterData' | 'generic-report';
  templateId: string;
  blueprint: DataReportBlueprintResult;
  files: DataReportScaffoldFile[];
}

function buildIndexContent(scope: DataReportBlueprintResult['scope']) {
  const moduleTabs =
    scope === 'multiple'
      ? `const reportTabs = ['overview', 'trend', 'conversion'] as const;`
      : `const reportTabs = ['overview'] as const;`;
  return `import { useState } from 'react';

${moduleTabs}

export function DataReportPage() {
  const [activeTab, setActiveTab] = useState(reportTabs[0]);

  return (
    <section className="data-report-page">
      <header className="data-report-page__header">
        <h1>Data Report</h1>
        <p>Shared search, metrics, chart, and table scaffold for report generation.</p>
      </header>
      <div className="data-report-page__search">TODO: shared search filters</div>
      <div className="data-report-page__tabs">
        {reportTabs.map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>
      <div className="data-report-page__module">TODO: render module {activeTab}</div>
    </section>
  );
}
`;
}

function buildConfigContent(scope: DataReportBlueprintResult['scope'], templateRef: string) {
  return `export const dataReportTemplate = {
  templateRef: '${templateRef}',
  scope: '${scope}',
  sharedSections: ['search', 'metrics', 'chart', 'table']
} as const;
`;
}

function buildModuleContent(name: string) {
  return `export function ${name}Module() {
  return (
    <section>
      <div>TODO: metrics cards</div>
      <div>TODO: chart area</div>
      <div>TODO: table area</div>
    </section>
  );
}
`;
}

function buildSingleReportPageContent(params: {
  routeTitle: string;
  routeName: string;
  pageComponentName: string;
  serviceExportName: string;
  tableTypeName: string;
}) {
  return BONUS_CENTER_SINGLE_REPORT_PAGE_TEMPLATE.split('__SERVICE_EXPORT__')
    .join(params.serviceExportName)
    .split('__ROUTE_NAME__')
    .join(params.routeName)
    .split('__TABLE_TYPE__')
    .join(params.tableTypeName)
    .split('__PAGE_COMPONENT__')
    .join(params.pageComponentName)
    .split('__EXPORT_TITLE__')
    .join(params.routeTitle)
    .split('__MENU_NAME__')
    .join(params.routeTitle);
}

function buildSingleReportServiceContent(routeName: string) {
  return `export async function fetch${routeName.charAt(0).toUpperCase() + routeName.slice(1)}Report() {
  return Promise.resolve({ list: [] });
}
`;
}

function buildSingleReportTypesContent() {
  return `export interface ReportMetricItem {
  label: string;
  value: number | string;
}

export interface ReportChartPoint {
  label: string;
  value: number;
}

export interface ReportTableRow {
  id: string;
  name: string;
  value: number | string;
}
`;
}

function buildTemplateFiles(baseDir: string, templateId: string) {
  const template =
    templateId === 'bonus-center-data' ? BONUS_CENTER_BLUEPRINT_TEMPLATE : getFrontendTemplate(templateId);
  const templateDir =
    templateId === 'bonus-center-data' ? resolveBonusCenterBlueprintDir() : resolveFrontendTemplateDir(templateId);
  if (!template || !templateDir) {
    return [] as DataReportScaffoldFile[];
  }

  const outputRoot = template.outputRoot ?? 'template';
  const pathPrefix = outputRoot ? `${baseDir}/${outputRoot}` : baseDir;
  const fileNames =
    templateId === 'bonus-center-data'
      ? (template.sharedEntryFiles ?? template.entryFiles)
      : template.includeAllFiles
        ? listTemplateFiles(templateDir)
        : template.entryFiles;

  return fileNames
    .filter(fileName => !fileName.endsWith('routes.ts') && fileName !== 'App.tsx' && fileName !== 'index.tsx')
    .map(fileName => ({
      path: `${pathPrefix}/${fileName}`,
      content: readFileSync(join(templateDir, fileName), 'utf8'),
      description: `base template file from ${templateId}`
    }));
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

export function buildDataReportScaffold(params: {
  goal: string;
  taskContext?: string;
  baseDir?: string;
  templateId?: string;
}): DataReportScaffoldResult {
  const blueprint = buildDataReportBlueprint(params);
  const { scope, templateRef, templateId, baseDir } = blueprint;
  const files: DataReportScaffoldFile[] =
    scope === 'single' && templateId === 'bonus-center-data' ? [] : [...buildTemplateFiles(baseDir, templateId)];

  if (templateId === 'bonus-center-data' && scope === 'single') {
    const singleReportStructure = inferSingleReportStructure({
      goal: params.goal,
      routeName: blueprint.routeName
    });
    files.push(
      {
        path: `${blueprint.pageDir}/index.tsx`,
        content: buildSingleReportPageContent({
          routeTitle: blueprint.routeTitle,
          routeName: blueprint.routeName,
          pageComponentName: `${blueprint.routeName.charAt(0).toUpperCase() + blueprint.routeName.slice(1)}BigData`,
          serviceExportName: `fetch${blueprint.routeName.charAt(0).toUpperCase() + blueprint.routeName.slice(1)}Report`,
          tableTypeName: `${blueprint.routeName.charAt(0).toUpperCase() + blueprint.routeName.slice(1)}Row`
        }),
        description: 'single-report page shell'
      },
      {
        path: `${blueprint.servicesDir}/${blueprint.routeName}.ts`,
        content: buildSingleReportServiceContent(blueprint.routeName),
        description: 'single-report service shell'
      },
      {
        path: `${blueprint.typesDir}/${blueprint.routeName}.ts`,
        content: buildSingleReportTypesContent(),
        description: 'single-report types shell'
      }
    );

    if (singleReportStructure.mode === 'component-files') {
      const baseName = singleReportStructure.componentBaseName;
      files.push(
        {
          path: `${blueprint.pageDir}/components/${baseName}Chart.tsx`,
          content: `export function ${baseName}Chart() {\n  return <section>${baseName} chart</section>;\n}\n`,
          description: 'single-report chart shell'
        },
        {
          path: `${blueprint.pageDir}/components/${baseName}Metrics.tsx`,
          content: `export function ${baseName}Metrics() {\n  return <section>${baseName} metrics</section>;\n}\n`,
          description: 'single-report metrics shell'
        },
        {
          path: `${blueprint.pageDir}/components/${baseName}Table.tsx`,
          content: `export function ${baseName}Table() {\n  return <section>${baseName} table</section>;\n}\n`,
          description: 'single-report table shell'
        }
      );
    }

    return { scope, templateRef, templateId, blueprint, files };
  }

  if (templateId === 'bonus-center-data') {
    return { scope, templateRef, templateId, blueprint, files };
  }

  files.push(
    {
      path: `${baseDir}/config.ts`,
      content: buildConfigContent(scope, templateRef),
      description: 'template and shared section config'
    },
    {
      path: `${baseDir}/modules/Overview.tsx`,
      content: buildModuleContent('Overview'),
      description: 'default overview report module'
    }
  );

  if (scope === 'multiple') {
    files.push(
      {
        path: `${baseDir}/modules/Trend.tsx`,
        content: buildModuleContent('Trend'),
        description: 'trend report module'
      },
      {
        path: `${baseDir}/modules/Conversion.tsx`,
        content: buildModuleContent('Conversion'),
        description: 'conversion report module'
      }
    );
  }

  files.push({
    path: `${baseDir}/index.tsx`,
    content: buildIndexContent(scope),
    description: 'data report page scaffold'
  });

  return { scope, templateRef, templateId, blueprint, files };
}
