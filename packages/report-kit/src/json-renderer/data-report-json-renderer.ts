export interface DataReportJsonRenderedFile {
  path: string;
  kind: 'page' | 'component' | 'service' | 'type' | 'config';
  content: string;
}

export type DataReportJsonBundleFieldValueType =
  | 'string'
  | 'number'
  | 'percent'
  | 'date'
  | 'date-range'
  | 'string[]'
  | 'boolean';

export interface DataReportJsonBundleField {
  name: string;
  label: string;
  valueType: DataReportJsonBundleFieldValueType;
  required: boolean;
  requestKey?: string;
  formatter?: string;
  defaultValue?: unknown;
}

export interface DataReportJsonBundleReport {
  id: string;
  componentName: string;
  titleI18nKey: string;
  service: {
    serviceKey: string;
    lambdaKey: string;
    requestTypeName: string;
    responseTypeName: string;
    listPath: string;
    totalPath?: string;
  };
  dataModel: DataReportJsonBundleField[];
}

export interface DataReportJsonBundle {
  page: {
    routePath: string;
    pageDir: string;
  };
  shared: {
    searchParams: DataReportJsonBundleField[];
    defaultParams: Record<string, unknown>;
  };
  reports: DataReportJsonBundleReport[];
}

export interface DataReportJsonRenderResult {
  files: DataReportJsonRenderedFile[];
  summary: {
    pageDir: string;
    reportCount: number;
    routePath: string;
  };
}

export function renderDataReportJsonBundleFiles(bundle: DataReportJsonBundle): DataReportJsonRenderResult {
  const moduleName = basename(bundle.page.pageDir);
  const files: DataReportJsonRenderedFile[] = [
    {
      path: `${bundle.page.pageDir}/config.tsx`,
      kind: 'config',
      content: renderConfig(bundle)
    },
    {
      path: `${bundle.page.pageDir}/index.tsx`,
      kind: 'page',
      content: renderPage(bundle)
    },
    ...bundle.reports.map(report => ({
      path: `${bundle.page.pageDir}/components/${report.componentName}/index.tsx`,
      kind: 'component' as const,
      content: renderReportComponent(report, moduleName)
    })),
    {
      path: `src/services/data/${moduleName}.ts`,
      kind: 'service',
      content: renderService(bundle)
    },
    {
      path: `src/types/data/${moduleName}.ts`,
      kind: 'type',
      content: renderTypes(bundle)
    }
  ];

  return {
    files,
    summary: {
      pageDir: bundle.page.pageDir,
      reportCount: bundle.reports.length,
      routePath: bundle.page.routePath
    }
  };
}

function renderConfig(bundle: DataReportJsonBundle): string {
  const tabs = bundle.reports
    .map(
      (report, index) => `  {
    key: '${report.id}',
    tab: <FormattedMessage id="${report.titleI18nKey}" />,
    order: ${index + 1}
  }`
    )
    .join(',\n');
  const defaults = JSON.stringify(bundle.shared.defaultParams, null, 2);

  return `import { FormattedMessage } from '@umijs/max';

export interface ${searchParamsTypeName(bundle)} {
${bundle.shared.searchParams.map(field => `  ${field.name}${field.required ? '' : '?'}: ${toTsType(field.valueType)};`).join('\n')}
  page?: number;
  page_size?: number;
}

export const defaultSearchParams: ${searchParamsTypeName(bundle)} = ${defaults};

export const tabList = [
${tabs}
];
`;
}

function renderPage(bundle: DataReportJsonBundle): string {
  const imports = bundle.reports
    .map(report => `import { ${report.componentName} } from './components/${report.componentName}';`)
    .join('\n');
  const firstReport = bundle.reports[0];
  const activeTab = firstReport?.id ?? 'overview';
  const activeMap = bundle.reports
    .map(
      report => `    ${report.id}: (
      <${report.componentName}
        searchParams={searchParams}
        loading={loading}
        setLoading={setLoading}
      />
    )`
    )
    .join(',\n');

  return `import { PageContainer } from '@ant-design/pro-components';
import { useMemo, useState } from 'react';
${imports}
import { defaultSearchParams, tabList, type ${searchParamsTypeName(bundle)} } from './config';

const GeneratedDataReportPage = () => {
  const [activeTab, setActiveTab] = useState('${activeTab}');
  const [searchParams, setSearchParams] = useState<${searchParamsTypeName(bundle)}>(defaultSearchParams);
  const [loading, setLoading] = useState(false);

  const activeTabMap = useMemo(
    () => ({
${activeMap}
    }),
    [searchParams, loading]
  );

  return (
    <PageContainer
      tabActiveKey={activeTab}
      tabList={tabList}
      onTabChange={setActiveTab}
    >
      {activeTabMap[activeTab as keyof typeof activeTabMap]}
    </PageContainer>
  );
};

export default GeneratedDataReportPage;
`;
}

function renderReportComponent(report: DataReportJsonBundleReport, moduleName: string): string {
  return `import { useEffect, useState } from 'react';
import { ${report.service.serviceKey} } from '@/services/data/${moduleName}';
import type { ${report.service.requestTypeName} } from '@/types/data/${moduleName}';

export interface ${report.componentName}Props {
  loading: boolean;
  searchParams: ${report.service.requestTypeName};
  setLoading: (value: boolean) => void;
}

export const ${report.componentName} = ({ searchParams, setLoading }: ${report.componentName}Props) => {
  const [data, setData] = useState<unknown[]>([]);

  useEffect(() => {
    let mounted = true;

    async function fetchReportData() {
      setLoading(true);
      try {
        const res = await ${report.service.serviceKey}(searchParams);
        if (mounted) {
          setData(res.${report.service.listPath} ?? []);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchReportData();
    return () => {
      mounted = false;
    };
  }, [searchParams, setLoading]);

  return (
    <pre>{JSON.stringify({ report: '${report.id}', rows: data.length }, null, 2)}</pre>
  );
};
`;
}

function renderService(bundle: DataReportJsonBundle): string {
  const imports = new Set(bundle.reports.map(report => report.service.requestTypeName));
  const functions = bundle.reports
    .map(
      report => `export async function ${report.service.serviceKey}(params: ${report.service.requestTypeName}) {
  return lambdaForward('${report.service.lambdaKey}', params);
}`
    )
    .join('\n\n');

  return `import { lambdaForward } from '@/services/common/lambdaProxy';
import type { ${Array.from(imports).join(', ')} } from '@/types/data/${basename(bundle.page.pageDir)}';

${functions}
`;
}

function renderTypes(bundle: DataReportJsonBundle): string {
  const searchType = `export interface ${searchParamsTypeName(bundle)} {
${bundle.shared.searchParams.map(field => `  ${field.name}${field.required ? '' : '?'}: ${toTsType(field.valueType)};`).join('\n')}
  page?: number;
  page_size?: number;
}`;
  const reportTypes = bundle.reports
    .map(
      report => `export interface ${report.service.responseTypeName} {
  list?: Array<Record<string, unknown>>;
  total?: number;
}`
    )
    .join('\n\n');

  return `${searchType}

${reportTypes}
`;
}

function searchParamsTypeName(bundle: DataReportJsonBundle): string {
  const rawName = `${pascalCase(basename(bundle.page.pageDir))}SearchParams`;
  return rawName;
}

function basename(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? 'generatedReport';
}

function pascalCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function toTsType(valueType: DataReportJsonBundle['shared']['searchParams'][number]['valueType']): string {
  if (valueType === 'number' || valueType === 'percent') return 'number';
  if (valueType === 'boolean') return 'boolean';
  if (valueType === 'string[]' || valueType === 'date-range') return 'string[]';
  return 'string';
}
