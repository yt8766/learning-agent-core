import type {
  DataReportJsonBlock,
  DataReportJsonDataSource,
  DataReportJsonFilterSchema,
  DataReportJsonGraphState,
  DataReportJsonSection
} from '../../../types/data-report-json';
import {
  collectRequestedFilterKeys,
  inferReportName,
  inferRouteName,
  inferServiceKey,
  normalizeIdentifier,
  parseGoalArtifacts
} from './goal-artifacts';
import { cloneSchema } from './shared-core';

function inferSectionId(state: Pick<DataReportJsonGraphState, 'analysis' | 'meta'>) {
  return state.analysis?.routeName ?? state.meta?.reportId ?? 'dataReport';
}

function inferSectionTitle(state: Pick<DataReportJsonGraphState, 'analysis' | 'meta'>) {
  return state.analysis?.reportName ?? state.meta?.title ?? '数据报表';
}

export function buildSingleReportSectionPlan(
  state: Pick<DataReportJsonGraphState, 'analysis' | 'meta' | 'pageDefaults' | 'dataSources'>
): Omit<DataReportJsonSection, 'blocks'> {
  const dataSourceKey = Object.keys(state.dataSources ?? {})[0] ?? inferSectionId(state);
  const sectionTitle = inferSectionTitle(state);
  return {
    id: inferSectionId(state),
    title: sectionTitle,
    description: `${sectionTitle}核心分析`,
    dataSourceKey,
    sectionDefaults: {
      filters: cloneSchema(state.pageDefaults?.filters ?? {}),
      table: {
        pageSize: 100,
        defaultSort: {
          field: 'dt',
          order: 'desc'
        }
      },
      chart: {
        granularity: 'day'
      }
    }
  };
}

export function buildSingleReportFilterSchema(
  state: Pick<DataReportJsonGraphState, 'analysis' | 'meta' | 'pageDefaults' | 'goal'>
): DataReportJsonFilterSchema {
  const reportId = state.meta?.reportId ?? state.analysis?.routeName ?? 'dataReport';
  const requestedFilterKeys = collectRequestedFilterKeys(state.goal);
  const fields: DataReportJsonFilterSchema['fields'] = [
    {
      name: 'dateRange',
      label: '日期',
      component: {
        type: 'custom',
        componentKey: 'gosh-date-range',
        props: {
          allowClear: false
        }
      },
      valueType: 'date-range',
      required: true,
      defaultValue: state.pageDefaults?.filters?.dateRange ?? {
        preset: 'last7Days'
      },
      requestMapping: {
        start: 'start_dt',
        end: 'end_dt'
      }
    }
  ];

  if (requestedFilterKeys.has('app')) {
    fields.push({
      name: 'app',
      label: '商户ID',
      component: {
        type: 'custom',
        componentKey: 'merchant-app-select',
        props: {}
      },
      valueType: 'string[]',
      required: false,
      defaultValue: state.pageDefaults?.filters?.app ?? []
    });
  }

  if (requestedFilterKeys.has('user_type')) {
    const userTypeField = parseGoalArtifacts(state.goal).filterEntries.find(field => field.name === 'user_type');
    const options =
      userTypeField?.options?.map(option => ({
        label: option.label,
        value: option.value
      })) ?? undefined;
    fields.push({
      name: 'user_type',
      label: '新老用户',
      options,
      component: {
        type: 'custom',
        componentKey: 'user-type-select',
        props: {}
      },
      valueType: 'string',
      required: false,
      defaultValue: state.pageDefaults?.filters?.user_type ?? options?.[0]?.value ?? 'all'
    });
  }

  return {
    formKey: `${reportId}SearchForm`,
    layout: 'inline',
    fields
  };
}

export function buildSingleReportDataSources(
  state: Pick<DataReportJsonGraphState, 'analysis' | 'goal'>
): Record<string, DataReportJsonDataSource> {
  const dataSourceKey = state.analysis?.routeName ?? inferRouteName(state.goal);
  const serviceKey = state.analysis?.serviceKey ?? inferServiceKey(state.goal);
  const requestedFilterKeys = collectRequestedFilterKeys(state.goal);
  const requestAdapter: Record<string, string> = {
    'dateRange.start': 'start_dt',
    'dateRange.end': 'end_dt'
  };

  if (requestedFilterKeys.has('app')) {
    requestAdapter.app = 'app';
  }
  if (requestedFilterKeys.has('user_type')) {
    requestAdapter.user_type = 'user_type';
  }

  return {
    [dataSourceKey]: {
      serviceKey,
      requestAdapter,
      responseAdapter: {
        listPath: 'data.list',
        totalPath: 'data.total'
      }
    }
  };
}

function inferMetricLabel(state: Pick<DataReportJsonGraphState, 'analysis' | 'goal'>) {
  const artifacts = parseGoalArtifacts(state.goal);
  if (artifacts.metricFields[0]) {
    return artifacts.metricFields[0].label;
  }
  const reportName = state.analysis?.reportName ?? inferReportName(state.goal);
  if (/分类/.test(reportName)) {
    return `${reportName}数`;
  }
  return '核心指标';
}

export function buildSingleReportMetricsBlock(
  state: Pick<DataReportJsonGraphState, 'analysis' | 'goal'>
): Extract<DataReportJsonBlock, { type: 'metrics' }> {
  const artifacts = parseGoalArtifacts(state.goal);
  if (artifacts.metricFields.length > 0) {
    return {
      type: 'metrics',
      title: '核心指标',
      items: artifacts.metricFields.slice(0, 4).map(field => ({
        key: normalizeIdentifier(field.name) || normalizeIdentifier(field.label) || 'metricValue',
        label: field.label,
        field: field.name,
        format:
          /avg|rate|ratio|percent|占比/i.test(field.name) || /均|率|占比|比例/.test(field.label) ? 'percent' : 'number',
        aggregate: 'latest'
      }))
    };
  }

  const metricLabel = inferMetricLabel(state);
  const metricKey = normalizeIdentifier(metricLabel) || 'summaryValue';
  return {
    type: 'metrics',
    title: '核心指标',
    items: [
      {
        key: metricKey,
        label: metricLabel,
        field: metricKey === 'summaryValue' ? 'value' : metricKey,
        format: 'number',
        aggregate: 'latest'
      }
    ]
  };
}

function inferChartXField(state: Pick<DataReportJsonGraphState, 'analysis' | 'goal'>) {
  const artifacts = parseGoalArtifacts(state.goal);
  const dateLikeDimension = artifacts.dimensionFields.find(
    field => /(^dt$|date|day|time)/i.test(field.name) || /日期|时间/.test(field.label)
  );
  if (dateLikeDimension) {
    return dateLikeDimension.name;
  }

  if (artifacts.dimensionFields[0]) {
    return artifacts.dimensionFields[0].name;
  }

  if (/分类/.test(state.analysis?.reportName ?? state.goal)) {
    return 'category_name';
  }
  return 'dt';
}

export function buildSingleReportChartBlock(
  state: Pick<DataReportJsonGraphState, 'analysis' | 'goal'>
): Extract<DataReportJsonBlock, { type: 'chart' }> {
  const metrics = buildSingleReportMetricsBlock(state);
  const artifacts = parseGoalArtifacts(state.goal);
  return {
    type: 'chart',
    title: `${inferSectionTitle(state)}趋势`,
    chartType: /饼图|pie/i.test(state.goal)
      ? 'pie'
      : /柱状|bar/i.test(state.goal)
        ? 'bar'
        : artifacts.dimensionFields.some(
              field => /(^dt$|date|day|time)/i.test(field.name) || /日期|时间/.test(field.label)
            )
          ? 'line'
          : 'bar',
    xField: inferChartXField(state),
    series: metrics.items.map(item => ({
      key: item.key,
      label: item.label,
      field: item.field
    }))
  };
}

function inferFirstColumnTitle(state: Pick<DataReportJsonGraphState, 'analysis' | 'goal'>) {
  const artifacts = parseGoalArtifacts(state.goal);
  if (artifacts.dimensionFields[0]) {
    return artifacts.dimensionFields[0].label;
  }
  if (/分类/.test(state.analysis?.reportName ?? state.goal)) {
    return '直播间分类';
  }
  return '日期';
}

function inferTableTitle(state: Pick<DataReportJsonGraphState, 'analysis' | 'meta' | 'goal'>) {
  return inferSectionTitle(state);
}

export function buildSingleReportTableBlock(
  state: Pick<DataReportJsonGraphState, 'analysis' | 'meta' | 'goal'>
): Extract<DataReportJsonBlock, { type: 'table' }> {
  const artifacts = parseGoalArtifacts(state.goal);
  const tableTitle = inferTableTitle(state);
  if (artifacts.displayFields.length > 0) {
    return {
      type: 'table',
      title: tableTitle,
      exportable: true,
      columns: artifacts.displayFields.map((field, index) => ({
        title: field.label,
        dataIndex: artifacts.dimensionFields.some(dimension => dimension.name === field.name)
          ? `${field.name}_label`
          : field.name,
        width: index === 0 ? 180 : 160,
        ...(index === 0 ? { fixed: 'left' as const } : {})
      }))
    };
  }

  const firstColumnTitle = inferFirstColumnTitle(state);
  const firstColumnDataIndex = /日期/.test(firstColumnTitle) ? 'dt_label' : 'category_name';
  return {
    type: 'table',
    title: tableTitle,
    exportable: true,
    columns: [
      {
        title: firstColumnTitle,
        dataIndex: firstColumnDataIndex,
        width: 180
      }
    ]
  };
}
