import {
  MODEL_CAPABILITIES,
  createModelCapabilities,
  withLlmRetry,
  type ChatMessage,
  type GenerateTextOptions
} from '@agent/adapters';
import type { DataReportSandpackFiles, DataReportSandpackGraphState } from '../../../types/data-report';

export interface SingleReportFilePlan {
  path: string;
  instruction: string;
  phase: 'leaf' | 'aggregate';
  generator?: 'llm' | 'mock';
}

export interface SingleReportFilePlanGroups {
  leafPlans: SingleReportFilePlan[];
  aggregatePlans: SingleReportFilePlan[];
}

function toPascalCase(value: string) {
  return value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function inferTypeLiteral(value: unknown, name: string, declarations: string[]): string {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'unknown[]';
    }

    return `${inferTypeLiteral(value[0], `${name}Item`, declarations)}[]`;
  }

  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object': {
      const interfaceName = toPascalCase(name);
      const fields = Object.entries(value as Record<string, unknown>).map(([key, fieldValue]) => {
        return `  ${key}: ${inferTypeLiteral(fieldValue, `${interfaceName}${toPascalCase(key)}`, declarations)};`;
      });
      declarations.push(`export interface ${interfaceName} {\n${fields.join('\n')}\n}`);
      return interfaceName;
    }
    default:
      return 'unknown';
  }
}

function buildTypesFromMock(routeName: string, payload: unknown) {
  const declarations: string[] = [];
  const responseName = `${toPascalCase(routeName)}Response`;
  inferTypeLiteral(payload, responseName, declarations);

  const rowDeclaration = buildRowTypeFromRecords(routeName, payload);

  return `${[...declarations, rowDeclaration].filter(Boolean).join('\n\n')}\n`;
}

function buildMockServiceCode(state: DataReportSandpackGraphState, routeName: string, payload: unknown) {
  const exportName = state.service?.exportName ?? `fetch${toPascalCase(routeName)}Report`;
  const responseName = `${toPascalCase(routeName)}Response`;
  const serialized = JSON.stringify(payload, null, 2);

  return `import type { ${responseName} } from '../../types/data/${routeName}';

const mockResponse: ${responseName} = ${serialized} as ${responseName};

export async function ${exportName}(params?: Record<string, unknown>): Promise<${responseName}> {
  void params;
  return Promise.resolve(mockResponse);
}
`;
}

function buildRowTypeFromRecords(routeName: string, payload: unknown) {
  const payloadRecord = typeof payload === 'object' && payload ? (payload as Record<string, unknown>) : undefined;
  const dataRecord =
    payloadRecord && typeof payloadRecord.data === 'object' && payloadRecord.data
      ? (payloadRecord.data as Record<string, unknown>)
      : undefined;
  const records = Array.isArray(dataRecord?.records) ? (dataRecord.records as Array<Record<string, unknown>>) : [];
  const firstRow = records[0];

  if (!firstRow || typeof firstRow !== 'object' || Array.isArray(firstRow)) {
    return null;
  }

  const rowName = `${toPascalCase(routeName)}Row`;
  const fields = Object.entries(firstRow).map(([key, value]) => {
    const primitiveType =
      typeof value === 'string'
        ? 'string'
        : typeof value === 'number'
          ? 'number'
          : typeof value === 'boolean'
            ? 'boolean'
            : 'unknown';
    return `  ${key}: ${primitiveType};`;
  });

  return `export interface ${rowName} {\n${fields.join('\n')}\n}`;
}

function buildPageOnlyMockPageCode(state: DataReportSandpackGraphState, routeName: string, routeTitle: string) {
  const serviceImport = state.service?.exportName ?? `fetch${toPascalCase(routeName)}Report`;
  const rowType = `${toPascalCase(routeName)}Row`;
  const payloadRecord =
    typeof state.mockData?.payload === 'object' && state.mockData?.payload
      ? (state.mockData.payload as Record<string, unknown>)
      : undefined;
  const dataRecord =
    payloadRecord && typeof payloadRecord.data === 'object' && payloadRecord.data
      ? (payloadRecord.data as Record<string, unknown>)
      : undefined;
  const records = Array.isArray(dataRecord?.records) ? (dataRecord.records as Array<Record<string, unknown>>) : [];
  const firstRow = records[0] ?? {};
  const columnEntries = Object.keys(firstRow).length > 0 ? Object.keys(firstRow) : ['id'];
  const columnsLiteral = columnEntries
    .map(
      key => `    {
      title: '${key}',
      dataIndex: '${key}',
      valueType: 'text',
      hideInSearch: true
    }`
    )
    .join(',\n');

  return `import { GoshExportButton } from '../../../components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import { FormInstance, PageContainer, ProColumns, ProTable } from '@ant-design/pro-components';
import { useIntl } from 'react-intl';
import { useRef, useState } from 'react';

import { ${serviceImport} } from '../../../services/data/${routeName}';
import type { ${rowType} } from '../../../types/data/${routeName}';

export default function ${toPascalCase(routeName)}ReportPage() {
  const formRef = useRef<FormInstance>();
  const intl = useIntl();
  const [data, setData] = useState<${rowType}[]>([]);
  const [searchParams, setSearchParams] = useState<Record<string, unknown>>({});

  const columns: ProColumns<${rowType}>[] = [
${columnsLiteral}
  ];

  const getData = async (params: any) => {
    setSearchParams(params || {});
    const response = await ${serviceImport}(params);
    const records = response?.data?.records || [];
    setData(records);
    return {
      data: records,
      success: response?.code === 0 || response?.success === true,
      total: response?.data?.total || records.length || 0
    };
  };

  return (
    <PageContainer>
      <ProTable<${rowType}, any>
        formRef={formRef}
        {...(tableConfig as any)}
        columns={columns}
        request={getData}
        search={{
          ...(tableConfig as any)?.search,
          optionRender: (_searchConfig: any, _formProps: any, dom: any[]) => [
            <GoshExportButton
              key="export"
              columns={columns}
              data={data}
              title={intl.formatMessage({ id: '${routeTitle}' })}
              intl={intl}
              enableAudit={true}
              menuName="${routeTitle}"
              getQueryParams={() => ({ ...searchParams })}
            />,
            ...dom
          ]
        }}
        rowKey="id"
      />
    </PageContainer>
  );
}
`;
}

function getMockRecords(payload: unknown) {
  const payloadRecord = typeof payload === 'object' && payload ? (payload as Record<string, unknown>) : undefined;
  const dataRecord =
    payloadRecord && typeof payloadRecord.data === 'object' && payloadRecord.data
      ? (payloadRecord.data as Record<string, unknown>)
      : undefined;
  return Array.isArray(dataRecord?.records) ? (dataRecord.records as Array<Record<string, unknown>>) : [];
}

function buildMetricKeys(payload: unknown) {
  const firstRow = getMockRecords(payload)[0] ?? {};
  return Object.keys(firstRow)
    .filter(key => key !== 'id' && key !== 'dt' && typeof firstRow[key] === 'number')
    .slice(0, 4);
}

function buildTableComponentCode(componentName: string, routeName: string, routeTitle: string, payload: unknown) {
  const rowType = `${toPascalCase(routeName)}Row`;
  const firstRow = getMockRecords(payload)[0] ?? {};
  const columnEntries = Object.keys(firstRow).length > 0 ? Object.keys(firstRow) : ['id'];
  const columnsLiteral = columnEntries
    .map(
      key => `  {
    title: '${key}',
    dataIndex: '${key}',
    valueType: 'text',
    hideInSearch: true
  }`
    )
    .join(',\n');

  return `import { GoshExportButton } from '../../../../components/GoshExportButton';
import { tableConfig } from '@/config/layout';
import type { ${rowType} } from '../../../../types/data/${routeName}';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { useIntl } from 'react-intl';

export interface ${componentName}Props {
  data: ${rowType}[];
  loading?: boolean;
  searchParams?: Record<string, unknown>;
}

export function ${componentName}({ data, loading, searchParams }: ${componentName}Props) {
  const intl = useIntl();
  const columns: ProColumns<${rowType}>[] = [
${columnsLiteral}
  ];

  return (
    <ProTable<${rowType}>
      {...(tableConfig as any)}
      rowKey="id"
      columns={columns}
      loading={loading}
      dataSource={data}
      search={false}
      pagination={false}
      options={{ reload: false }}
      toolBarRender={() => [
        <GoshExportButton
          key="export"
          columns={columns}
          data={data}
          title={intl.formatMessage({ id: '${routeTitle}' })}
          intl={intl}
          enableAudit={true}
          menuName="${routeTitle}"
          getQueryParams={() => searchParams || {}}
        />
      ]}
    />
  );
}
`;
}

function buildMetricsComponentCode(componentName: string, routeName: string, payload: unknown) {
  const rowType = `${toPascalCase(routeName)}Row`;
  const metricKeys = buildMetricKeys(payload);
  const fallbackMetricKeys = metricKeys.length > 0 ? metricKeys : ['id'];
  const cards = fallbackMetricKeys
    .map(
      key => `        <Col xs={24} sm={12} md={12} lg={6}>
          <Card size="small" bordered={false}>
            <Statistic title="${key}" value={metrics.${key}} />
          </Card>
        </Col>`
    )
    .join('\n');
  const accumulatorFields = fallbackMetricKeys.map(key => `        ${key}: 0,`).join('\n');
  const reduceFields = fallbackMetricKeys
    .map(key => `        ${key}: accumulator.${key} + Number(item.${key} || 0),`)
    .join('\n');

  return `import type { ${rowType} } from '../../../../types/data/${routeName}';
import { ProCard } from '@ant-design/pro-components';
import { Card, Col, Row, Statistic } from 'antd';
import { useMemo } from 'react';

export interface ${componentName}Props {
  data: ${rowType}[];
  loading?: boolean;
}

export function ${componentName}({ data, loading }: ${componentName}Props) {
  const metrics = useMemo(() => {
    return data.reduce(
      (accumulator, item) => ({
${reduceFields}
      }),
      {
${accumulatorFields}
      }
    );
  }, [data]);

  return (
    <ProCard title="核心指标" loading={loading} bordered>
      <Row gutter={[16, 16]}>
${cards}
      </Row>
    </ProCard>
  );
}
`;
}

function buildChartComponentCode(componentName: string, routeName: string, payload: unknown) {
  const rowType = `${toPascalCase(routeName)}Row`;
  const records = getMockRecords(payload);
  const firstRow = records[0] ?? {};
  const xKey = 'dt' in firstRow ? 'dt' : (Object.keys(firstRow)[0] ?? 'id');
  const yKey =
    buildMetricKeys(payload)[0] ?? Object.keys(firstRow).find(key => typeof firstRow[key] === 'number') ?? 'id';

  return `import type { ${rowType} } from '../../../../types/data/${routeName}';
import { ProCard } from '@ant-design/pro-components';
import { Empty } from 'antd';
import ReactECharts from 'echarts-for-react';

export interface ${componentName}Props {
  data: ${rowType}[];
  loading?: boolean;
}

export function ${componentName}({ data, loading }: ${componentName}Props) {
  if (!data.length) {
    return (
      <ProCard title="趋势图" loading={loading}>
        <Empty description="No data" />
      </ProCard>
    );
  }

  return (
    <ProCard title="趋势图" loading={loading}>
      <ReactECharts
        option={{
          tooltip: { trigger: 'axis' },
          xAxis: {
            type: 'category',
            data: data.map(item => String(item.${xKey} ?? ''))
          },
          yAxis: {
            type: 'value'
          },
          series: [
            {
              type: 'line',
              smooth: true,
              data: data.map(item => Number(item.${yKey} || 0))
            }
          ]
        }}
      />
    </ProCard>
  );
}
`;
}

function buildComponentPageCode(state: DataReportSandpackGraphState, routeName: string, routeTitle: string) {
  const serviceImport = state.service?.exportName ?? `fetch${toPascalCase(routeName)}Report`;
  const rowType = `${toPascalCase(routeName)}Row`;
  const metricComponent =
    state.components?.planned.find(item => item.path.toLowerCase().includes('metrics'))?.name ?? 'ReportMetrics';
  const chartComponent =
    state.components?.planned.find(item => item.path.toLowerCase().includes('chart'))?.name ?? 'ReportChart';
  const tableComponent =
    state.components?.planned.find(item => item.path.toLowerCase().includes('table'))?.name ?? 'ReportTable';

  return `import { PageContainer } from '@ant-design/pro-components';
import { useEffect, useState } from 'react';

import { ${chartComponent} } from './components/${chartComponent}';
import { ${metricComponent} } from './components/${metricComponent}';
import { ${tableComponent} } from './components/${tableComponent}';
import { ${serviceImport} } from '../../../services/data/${routeName}';
import type { ${rowType} } from '../../../types/data/${routeName}';

export default function ${toPascalCase(routeName)}ReportPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<${rowType}[]>([]);
  const [searchParams] = useState<Record<string, unknown>>({});

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    ${serviceImport}(searchParams)
      .then(response => {
        if (!mounted) {
          return;
        }
        setData(response?.data?.records || []);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  return (
    <PageContainer title="${routeTitle}">
      <div className="flex flex-col gap-4">
        <${metricComponent} data={data} loading={loading} />
        <${chartComponent} data={data} loading={loading} />
        <${tableComponent} data={data} loading={loading} searchParams={searchParams} />
      </div>
    </PageContainer>
  );
}
`;
}

function buildMockSampleBlock(state: DataReportSandpackGraphState) {
  if (state.mockData?.mode !== 'file' || typeof state.mockData.payload === 'undefined') {
    return null;
  }

  return [
    `Mock file: ${state.mockData.mockFile ?? 'data-report/mock.json'}`,
    'Use this mock payload shape as the primary contract for the generated code:',
    JSON.stringify(state.mockData.payload, null, 2)
  ].join('\n');
}

export function isSingleReport(state: DataReportSandpackGraphState) {
  const referenceMode = state.scopeDecision?.referenceMode ?? state.analysis?.referenceMode ?? state.blueprint?.scope;
  const templateId = state.blueprint?.templateId ?? state.analysis?.templateId;
  return referenceMode === 'single' && templateId === 'bonus-center-data';
}

export function buildRootFiles(state: DataReportSandpackGraphState): DataReportSandpackFiles {
  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? 'generatedReport';

  return {
    '/App.tsx': `import ReportPage from './src/pages/dataDashboard/${routeName}';

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ReportPage />
    </main>
  );
}
`
  };
}

export function buildFilePlans(state: DataReportSandpackGraphState): SingleReportFilePlanGroups {
  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? 'generatedReport';
  const routeTitle = state.scopeDecision?.routeTitle ?? state.analysis?.title ?? 'Data Report Preview';
  const servicePath = state.structure?.serviceFile ?? `/src/services/data/${routeName}.ts`;
  const typesPath = state.structure?.typesFile ?? `/src/types/data/${routeName}.ts`;
  const pagePath = state.structure?.pageFile ?? `/src/pages/dataDashboard/${routeName}/index.tsx`;
  const analysis = JSON.stringify(state.analysis ?? {}, null, 2);
  const singleReportMode = state.components?.singleReportMode ?? 'page-only';
  const componentPlans = state.components?.planned ?? [];
  const mockSampleBlock = buildMockSampleBlock(state);
  const hasMockPayload = state.mockData?.mode === 'file' && typeof state.mockData.payload !== 'undefined';

  if (singleReportMode === 'page-only') {
    return {
      leafPlans: [
        {
          path: servicePath,
          phase: 'leaf',
          generator: hasMockPayload ? 'mock' : 'llm',
          instruction: [
            `Target file: ${servicePath}`,
            `Build the real service file for "${routeTitle}".`,
            `Prefer using the data source hint "${state.analysis?.dataSourceHint ?? ''}" when naming the request.`,
            hasMockPayload
              ? 'A mock payload has already been prepared, so the service file can use the known mock response shape.'
              : `Do not return mock data; keep the code ready for real interaction.`,
            `Export the function name ${state.service?.exportName ?? `fetch${routeName}Report`}.`,
            mockSampleBlock ?? '',
            `Context: ${analysis}`
          ].join('\n')
        },
        {
          path: typesPath,
          phase: 'leaf',
          generator: hasMockPayload ? 'mock' : 'llm',
          instruction: [
            `Target file: ${typesPath}`,
            `Build the shared type definitions for "${routeTitle}".`,
            `The report is table-first, so prioritize table row, search params, and response payload types.`,
            `Use export interface declarations.`,
            mockSampleBlock ?? '',
            `Context: ${analysis}`
          ].join('\n')
        }
      ],
      aggregatePlans: [
        {
          path: pagePath,
          phase: 'aggregate',
          generator: hasMockPayload ? 'mock' : 'llm',
          instruction: [
            `Target file: ${pagePath}`,
            `Build a single-page big-data report for "${routeTitle}".`,
            'Follow a table-first structure similar to a real gosh_admin_fe data report page.',
            'Use PageContainer + ProTable + real request loading + GoshExportButton.',
            'Search items should live in ProTable search, and export should be rendered with the existing GoshExportButton pattern.',
            'Use the current template component import for GoshExportButton and do not invent other component locations.',
            `Import the real service from '${servicePath}'.`,
            `Use relative imports for '${typesPath}' when types are needed.`,
            "Do not import PaginationResult from '@/utils/request' and do not depend on any '@/utils/request' file.",
            `Do not create Chart or Metrics components for this page.`,
            mockSampleBlock ?? '',
            `Context: ${analysis}`
          ].join('\n')
        }
      ]
    };
  }

  const componentFilePlans = componentPlans.map(plan => {
    const lowerPath = plan.path.toLowerCase();
    const fileKind = lowerPath.includes('chart')
      ? 'chart'
      : lowerPath.includes('metrics')
        ? 'metrics'
        : lowerPath.includes('table')
          ? 'table'
          : 'component';
    const extraInstructions =
      fileKind === 'table'
        ? [
            'Every table must include export support.',
            'If you use ProTable, render GoshExportButton in toolBarRender and pass columns, data, title, intl, enableAudit, menuName, and getQueryParams exactly in that format.'
          ]
        : [];

    return {
      path: plan.path,
      phase: 'leaf' as const,
      generator: hasMockPayload ? ('mock' as const) : ('llm' as const),
      instruction: [
        `Target file: ${plan.path}`,
        `Build the ${fileKind} component for "${routeTitle}".`,
        `Purpose: ${plan.purpose}`,
        `Use relative imports for '${typesPath}' when types are needed.`,
        'Use the current template component import for GoshExportButton and do not invent other component locations.',
        "Do not import PaginationResult from '@/utils/request' and do not depend on any '@/utils/request' file.",
        ...extraInstructions,
        mockSampleBlock ?? '',
        `Context: ${analysis}`
      ].join('\n')
    };
  });

  return {
    leafPlans: [
      ...componentFilePlans,
      {
        path: servicePath,
        phase: 'leaf',
        generator: hasMockPayload ? 'mock' : 'llm',
        instruction: [
          `Target file: ${servicePath}`,
          `Build the real service file for "${routeTitle}".`,
          `Prefer using the data source hint "${state.analysis?.dataSourceHint ?? ''}" when naming the request.`,
          hasMockPayload
            ? 'A mock payload has already been prepared, so the service file can use the known mock response shape.'
            : `Do not return mock data; keep the code ready for real interaction.`,
          `Export the function name ${state.service?.exportName ?? `fetch${routeName}Report`}.`,
          mockSampleBlock ?? '',
          `Context: ${analysis}`
        ].join('\n')
      },
      {
        path: typesPath,
        phase: 'leaf',
        generator: hasMockPayload ? 'mock' : 'llm',
        instruction: [
          `Target file: ${typesPath}`,
          `Build the shared type definitions for "${routeTitle}".`,
          `Include metric, chart, and table row types that the page and widgets can reuse.`,
          `Use export interface declarations.`,
          mockSampleBlock ?? '',
          `Context: ${analysis}`
        ].join('\n')
      }
    ],
    aggregatePlans: [
      {
        path: pagePath,
        phase: 'aggregate',
        generator: hasMockPayload ? 'mock' : 'llm',
        instruction: [
          `Target file: ${pagePath}`,
          `Build the single report page for "${routeTitle}".`,
          `It must import any planned chart/metrics/table components from './components/*'.`,
          `Use @ant-design/pro-components PageContainer as the page shell.`,
          `Do not use mock data inside the page.`,
          `Assume the planned leaf components already exist.`,
          mockSampleBlock ?? '',
          `Context: ${analysis}`
        ].join('\n')
      }
    ]
  };
}

async function generateSingleFile(state: DataReportSandpackGraphState, plan: SingleReportFilePlan) {
  const routeName = state.intent?.routeName ?? state.analysis?.routeName ?? 'generatedReport';
  if (plan.generator === 'mock' && state.mockData?.mode === 'file' && typeof state.mockData.payload !== 'undefined') {
    const code =
      plan.path === (state.structure?.serviceFile ?? `/src/services/data/${routeName}.ts`)
        ? buildMockServiceCode(state, routeName, state.mockData.payload)
        : plan.path === (state.structure?.pageFile ?? `/src/pages/dataDashboard/${routeName}/index.tsx`)
          ? state.components?.singleReportMode === 'page-only'
            ? buildPageOnlyMockPageCode(
                state,
                routeName,
                state.scopeDecision?.routeTitle ?? state.analysis?.title ?? 'Data Report Preview'
              )
            : buildComponentPageCode(
                state,
                routeName,
                state.scopeDecision?.routeTitle ?? state.analysis?.title ?? 'Data Report Preview'
              )
          : plan.path === (state.structure?.typesFile ?? `/src/types/data/${routeName}.ts`)
            ? buildTypesFromMock(routeName, state.mockData.payload)
            : plan.path.toLowerCase().includes('table')
              ? buildTableComponentCode(
                  plan.path.split('/').pop()?.replace('.tsx', '') ?? 'ReportTable',
                  routeName,
                  state.scopeDecision?.routeTitle ?? state.analysis?.title ?? 'Data Report Preview',
                  state.mockData.payload
                )
              : plan.path.toLowerCase().includes('metrics')
                ? buildMetricsComponentCode(
                    plan.path.split('/').pop()?.replace('.tsx', '') ?? 'ReportMetrics',
                    routeName,
                    state.mockData.payload
                  )
                : buildChartComponentCode(
                    plan.path.split('/').pop()?.replace('.tsx', '') ?? 'ReportChart',
                    routeName,
                    state.mockData.payload
                  );
    state.onFileStage?.({ phase: plan.phase, path: plan.path, status: 'success' });
    return [plan.path, code.trim()] as const;
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a frontend code generator. Return only the file source code for the requested target file. Do not wrap in markdown fences.'
    },
    {
      role: 'user',
      content: plan.instruction
    }
  ];
  const options: GenerateTextOptions = {
    role: 'manager',
    modelId: state.modelId,
    temperature: typeof state.temperature === 'number' ? state.temperature : 0.1,
    maxTokens: state.maxTokens,
    requiredCapabilities: createModelCapabilities(MODEL_CAPABILITIES.TEXT)
  };
  const llm = state.llm;

  if (!llm) {
    throw new Error('Configured LLM provider does not support text generation.');
  }

  const code: string = await withLlmRetry(
    async currentMessages => {
      if (typeof llm.generateText === 'function') {
        return llm.generateText(currentMessages, options);
      }

      if (typeof llm.streamText === 'function') {
        let content = '';
        const streamed = await llm.streamText(currentMessages, options, (token: string) => {
          content += token;
        });
        return streamed || content;
      }

      throw new Error('Configured LLM provider does not support text generation.');
    },
    messages,
    {
      onRetry: state.onRetry
    }
  );

  state.onFileStage?.({ phase: plan.phase, path: plan.path, status: 'success' });
  return [plan.path, code.trim()] as const;
}

function emitPendingEvents(state: DataReportSandpackGraphState, plans: SingleReportFilePlan[]) {
  for (const plan of plans) {
    state.onFileStage?.({ phase: plan.phase, path: plan.path, status: 'pending' });
  }
}

export async function generateSingleReportPlannedFiles(
  state: DataReportSandpackGraphState,
  plans: SingleReportFilePlan[]
) {
  if (!state.llm || !isSingleReport(state) || plans.length === 0) {
    return null;
  }

  emitPendingEvents(state, plans);
  const entries = await Promise.all(plans.map(plan => generateSingleFile(state, plan)));
  return Object.fromEntries(entries) as DataReportSandpackFiles;
}

export async function generateSingleReportFiles(state: DataReportSandpackGraphState) {
  if (!state.llm || !isSingleReport(state)) {
    return null;
  }

  const { leafPlans, aggregatePlans } = buildFilePlans(state);
  const leafFiles = (await generateSingleReportPlannedFiles(state, leafPlans)) ?? {};
  const aggregateFiles = (await generateSingleReportPlannedFiles(state, aggregatePlans)) ?? {};
  const files: DataReportSandpackFiles = {
    ...buildRootFiles(state),
    ...leafFiles,
    ...aggregateFiles
  };

  return {
    content: JSON.stringify({ status: 'success', files }),
    payload: {
      status: 'success' as const,
      files
    }
  };
}
