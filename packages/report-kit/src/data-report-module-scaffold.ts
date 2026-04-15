import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveFrontendTemplateDir } from '@agent/templates';
import {
  buildDataReportBlueprint,
  inferSingleReportStructure,
  type DataReportBlueprintResult,
  type DataReportModuleBlueprint
} from './data-report-blueprint';

export interface DataReportModuleScaffoldFile {
  path: string;
  content: string;
  description: string;
}

export interface DataReportModuleScaffoldResult {
  templateId: string;
  blueprint: DataReportBlueprintResult;
  module: DataReportModuleBlueprint;
  files: DataReportModuleScaffoldFile[];
}

function listModuleFiles(rootDir: string, currentDir = rootDir): string[] {
  const entries = readdirSync(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextPath = join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listModuleFiles(rootDir, nextPath));
      continue;
    }
    files.push(nextPath.replace(`${rootDir}/`, ''));
  }

  return files.sort();
}

function buildGenericModuleContent(module: DataReportModuleBlueprint): string {
  return `export function ${module.id}Module() {
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

function buildSingleWidgetFileContent(componentName: string, kind: 'index' | 'chart' | 'metrics' | 'table') {
  if (kind === 'index') {
    return `import { ${componentName}Chart } from './${componentName}Chart';
import { ${componentName}Metrics } from './${componentName}Metrics';
import { ${componentName}Table } from './${componentName}Table';

export function ${componentName}() {
  return (
    <section>
      <${componentName}Metrics />
      <${componentName}Chart />
      <${componentName}Table />
    </section>
  );
}
`;
  }

  if (kind === 'table') {
    return `import { GoshExportButton } from '../../../../components/GoshExportButton';
import type { ${componentName}TableRow } from '../../../../types/data/widgetSummary';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { useIntl } from 'react-intl';

const columns: ProColumns<${componentName}TableRow>[] = [];
const searchParams = {};

export function ${componentName}Table() {
  const data: ${componentName}TableRow[] = [];
  const intl = useIntl();

  return (
    <ProTable<${componentName}TableRow>
      rowKey="id"
      columns={columns}
      dataSource={data}
      search={false}
      pagination={false}
      toolBarRender={() => [
        <GoshExportButton
          key="export"
          columns={columns}
          data={data}
          title={intl.formatMessage({ id: '${componentName}' })}
          intl={intl as never}
          enableAudit={true}
          menuName="${componentName}"
          getQueryParams={() => ({ ...searchParams })}
        />
      ]}
    />
  );
}
`;
  }

  return `export function ${componentName}${kind === 'chart' ? 'Chart' : kind === 'metrics' ? 'Metrics' : 'Table'}() {
  return <section>${componentName} ${kind}</section>;
}
`;
}

export function buildDataReportModuleScaffold(params: {
  goal: string;
  taskContext?: string;
  baseDir?: string;
  templateId?: string;
  moduleId: string;
}): DataReportModuleScaffoldResult {
  const blueprint = buildDataReportBlueprint(params);
  const module = blueprint.modules.find(item => item.id === params.moduleId);

  if (!module) {
    throw new Error(`Unknown data-report module: ${params.moduleId}`);
  }

  if (blueprint.templateId === 'bonus-center-data' && blueprint.scope === 'single') {
    const singleReportStructure = inferSingleReportStructure({
      goal: params.goal,
      routeName: blueprint.routeName
    });
    if (singleReportStructure.mode === 'page-only') {
      return {
        templateId: blueprint.templateId,
        blueprint,
        module,
        files: []
      };
    }

    const componentName = singleReportStructure.componentBaseName;
    const basePath = `src/pages/dataDashboard/${blueprint.routeName}/components`;
    return {
      templateId: blueprint.templateId,
      blueprint,
      module,
      files: [
        {
          path: `${basePath}/${componentName}Chart.tsx`,
          content: buildSingleWidgetFileContent(componentName, 'chart'),
          description: 'single-report chart widget'
        },
        {
          path: `${basePath}/${componentName}Metrics.tsx`,
          content: buildSingleWidgetFileContent(componentName, 'metrics'),
          description: 'single-report metrics widget'
        },
        {
          path: `${basePath}/${componentName}Table.tsx`,
          content: buildSingleWidgetFileContent(componentName, 'table'),
          description: 'single-report table widget'
        }
      ]
    };
  }

  if (blueprint.templateId !== 'bonus-center-data' || !module.sourceDir) {
    return {
      templateId: blueprint.templateId,
      blueprint,
      module,
      files: [
        {
          path: module.entryFile,
          content: buildGenericModuleContent(module),
          description: `generated generic report module for ${module.id}`
        }
      ]
    };
  }

  const templateDir = resolveFrontendTemplateDir(blueprint.templateId);
  if (!templateDir) {
    throw new Error(`Unable to resolve template directory for ${blueprint.templateId}`);
  }

  const sourceDir = join(templateDir, module.sourceDir);
  const files = listModuleFiles(sourceDir).map(relativePath => ({
    path: `${module.componentDir}/${relativePath}`,
    content: readFileSync(join(sourceDir, relativePath), 'utf8'),
    description: `module template file from ${blueprint.templateId}:${module.id}`
  }));

  return {
    templateId: blueprint.templateId,
    blueprint,
    module,
    files
  };
}
