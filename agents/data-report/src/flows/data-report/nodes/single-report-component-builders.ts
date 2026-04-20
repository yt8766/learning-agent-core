import type { DataReportSandpackGraphState } from '../../../types/data-report';
import { buildMetricKeys, getMockRecords, toPascalCase } from './single-report-type-helpers';

export function buildPageOnlyMockPageCode(state: DataReportSandpackGraphState, routeName: string, routeTitle: string) {
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

export function buildTableComponentCode(
  componentName: string,
  routeName: string,
  routeTitle: string,
  payload: unknown
) {
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

export function buildMetricsComponentCode(componentName: string, routeName: string, payload: unknown) {
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

export function buildChartComponentCode(componentName: string, routeName: string, payload: unknown) {
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

export function buildComponentPageCode(state: DataReportSandpackGraphState, routeName: string, routeTitle: string) {
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
