import type {
  DataReportJsonAnalysisArtifact,
  DataReportJsonSchema,
  DataReportJsonTrimmedContexts
} from '../../../types/data-report-json';

export interface ParsedDisplayField {
  name: string;
  type: string;
  label: string;
}

export interface ParsedGoalArtifacts {
  title?: string;
  reportName?: string;
  apiName?: string;
  filterEntries: Array<{
    name: string;
    type: string;
    label: string;
    options?: Array<{
      label: string;
      value: string;
    }>;
  }>;
  displayFields: ParsedDisplayField[];
  metricFields: ParsedDisplayField[];
  dimensionFields: ParsedDisplayField[];
}

export function normalizeIdentifier(value: string) {
  const compact = value
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, ' ')
    .trim();
  if (!compact) {
    return '';
  }

  const asciiOnly = compact
    .split(/\s+/)
    .map((segment, index) => {
      if (/^[a-z0-9]+$/i.test(segment)) {
        return index === 0
          ? segment.replace(/^[A-Z]/, char => char.toLowerCase())
          : segment[0]!.toUpperCase() + segment.slice(1);
      }
      return '';
    })
    .join('');

  if (asciiOnly) {
    return asciiOnly;
  }

  return compact
    .replace(/[\u4e00-\u9fa5]/g, '')
    .replace(/\s+/g, '')
    .replace(/^[A-Z]/, char => char.toLowerCase());
}

export function extractLabeledValue(goal: string, label: string) {
  const pattern = new RegExp(`${label}[：:]\\s*([^\\n]+)`, 'i');
  return goal.match(pattern)?.[1]?.trim();
}

export function extractLabeledSection(goal: string, label: string) {
  const pattern = new RegExp(
    `${label}[：:]\\s*([\\s\\S]*?)(?=\\n\\s*(?:展示及文案|展示字段|字段说明|展示字段与文案|指标|维度|备注)[：:]|$)`,
    'i'
  );
  return goal.match(pattern)?.[1]?.trim();
}

function extractDisplaySection(goal: string) {
  const pattern = /(?:展示及文案|展示字段|字段说明|展示字段与文案)[：:]\s*([\s\S]*?)$/i;
  return goal.match(pattern)?.[1]?.trim();
}

function parseFilterSection(section?: string) {
  if (!section) {
    return [];
  }

  return section
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)\s*-\s*(.+)$/);
      if (!match) {
        return undefined;
      }

      const rawLabel = match[3]!.trim();
      const firstSeparatorIndex = rawLabel.indexOf('：') >= 0 ? rawLabel.indexOf('：') : rawLabel.indexOf(':');
      const optionSegments =
        firstSeparatorIndex > 0
          ? rawLabel
              .slice(firstSeparatorIndex + 1)
              .split(/[，,]/)
              .map(item => item.trim())
              .filter(Boolean)
          : [];
      const hasStructuredOptions =
        firstSeparatorIndex > 0 && optionSegments.length > 0 && optionSegments.every(item => /.+[：:].+/.test(item));
      const options = hasStructuredOptions
        ? optionSegments
            .map(item => item.match(/^(.+?)[：:](.+)$/))
            .filter((item): item is RegExpMatchArray => Boolean(item))
            .map(item => ({
              label: item[1]!.trim(),
              value: item[2]!.trim()
            }))
        : undefined;

      return {
        name: match[1]!.trim(),
        type: match[2]!.trim(),
        label:
          hasStructuredOptions && firstSeparatorIndex > 0 ? rawLabel.slice(0, firstSeparatorIndex).trim() : rawLabel,
        options
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function parseDisplaySection(section?: string): ParsedDisplayField[] {
  if (!section) {
    return [];
  }

  const lines = section
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const fields: ParsedDisplayField[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const name = lines[index];
    if (!name || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      continue;
    }

    const type = lines[index + 1];
    const label = lines[index + 2];
    if (type && label && /^(string|bigint|double|float|number|int|integer|decimal|boolean)$/i.test(type)) {
      fields.push({
        name,
        type,
        label
      });
      index += 3;
      continue;
    }

    const inlineMatch = name.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]+)\)\s*-\s*(.+)$/);
    if (inlineMatch) {
      fields.push({
        name: inlineMatch[1]!.trim(),
        type: inlineMatch[2]!.trim(),
        label: inlineMatch[3]!.trim()
      });
    }
  }

  return fields;
}

function isMetricField(field: ParsedDisplayField) {
  return /^(bigint|double|float|number|int|integer|decimal)$/i.test(field.type);
}

export function parseGoalArtifacts(goal: string): ParsedGoalArtifacts {
  const filterEntries = parseFilterSection(extractLabeledSection(goal, '筛选项'));
  const displayFields = parseDisplaySection(extractDisplaySection(goal));

  return {
    title: extractLabeledValue(goal, '标题') ?? undefined,
    reportName: extractLabeledValue(goal, '报表名称') ?? extractLabeledValue(goal, '标题') ?? undefined,
    apiName: extractLabeledValue(goal, '大数据接口') ?? extractLabeledValue(goal, '接口') ?? undefined,
    filterEntries,
    displayFields,
    metricFields: displayFields.filter(isMetricField),
    dimensionFields: displayFields.filter(field => !isMetricField(field))
  };
}

export function inferServiceKey(goal: string) {
  const artifacts = parseGoalArtifacts(goal);
  return (
    artifacts.apiName ??
    goal.match(/[a-z][a-z0-9_]*(?:service|report|data|list|dashboard)[a-z0-9_]*/i)?.[0] ??
    'getReportData'
  );
}

export function inferReportName(goal: string) {
  return parseGoalArtifacts(goal).reportName ?? '数据报表';
}

export function inferRouteName(goal: string) {
  const reportName = inferReportName(goal);
  if (/银币兑换记录/.test(reportName)) {
    return 'bcExchangeMall';
  }
  const normalizedName = normalizeIdentifier(reportName);
  if (normalizedName) {
    return normalizedName;
  }

  const serviceKey = inferServiceKey(goal);
  return normalizeIdentifier(serviceKey) || 'dataReport';
}

function formatHeaderLines(goal: string, analysis?: DataReportJsonAnalysisArtifact) {
  const title = extractLabeledValue(goal, '标题') ?? analysis?.title;
  const reportName = extractLabeledValue(goal, '报表名称') ?? analysis?.reportName;
  const apiName = extractLabeledValue(goal, '大数据接口') ?? extractLabeledValue(goal, '接口') ?? analysis?.serviceKey;

  return [
    title ? `标题：${title}` : undefined,
    reportName ? `报表名称：${reportName}` : undefined,
    apiName ? `大数据接口：${apiName}` : undefined
  ].filter((line): line is string => Boolean(line));
}

function formatNamedLines(title: string, rows: string[]) {
  if (!rows.length) {
    return undefined;
  }

  return [title, ...rows].join('\n');
}

export function buildDataReportJsonNodeContexts(params: {
  goal: string;
  analysis?: DataReportJsonAnalysisArtifact;
}): DataReportJsonTrimmedContexts {
  const artifacts = parseGoalArtifacts(params.goal);
  const headerLines = formatHeaderLines(params.goal, params.analysis);

  const filtersBlock = formatNamedLines(
    '筛选项：',
    artifacts.filterEntries.map(field => `${field.name} (${field.type}) - ${field.label}`)
  );
  const displayBlock = formatNamedLines(
    '展示及文案：',
    artifacts.displayFields.map(field => `${field.name} (${field.type}) - ${field.label}`)
  );
  const metricsBlock = formatNamedLines(
    '指标字段：',
    artifacts.metricFields.map(field => `${field.name} (${field.type}) - ${field.label}`)
  );
  const dimensionsBlock = formatNamedLines(
    '维度字段：',
    artifacts.dimensionFields.map(field => `${field.name} (${field.type}) - ${field.label}`)
  );

  return {
    filterSchemaNode: [...headerLines, filtersBlock].filter(Boolean).join('\n'),
    dataSourceNode: [...headerLines, filtersBlock].filter(Boolean).join('\n'),
    metricsBlockNode: [...headerLines, metricsBlock].filter(Boolean).join('\n'),
    chartBlockNode: [...headerLines, dimensionsBlock, metricsBlock].filter(Boolean).join('\n'),
    tableBlockNode: [...headerLines, displayBlock].filter(Boolean).join('\n'),
    sectionSchemaNode: [...headerLines, filtersBlock, displayBlock].filter(Boolean).join('\n')
  };
}

export function collectRequestedFilterKeys(goal: string) {
  const artifacts = parseGoalArtifacts(goal);
  if (!artifacts.filterEntries.length) {
    return new Set<string>();
  }

  const keys = new Set<string>();
  for (const field of artifacts.filterEntries) {
    keys.add(field.name);
  }

  return keys;
}

export function inferScope(goal: string): DataReportJsonSchema['meta']['scope'] {
  if (/单个报表|单报表|单页|单表|仅一个报表|只要一个报表/i.test(goal)) {
    return 'single';
  }

  if (
    extractLabeledValue(goal, '报表名称') &&
    (extractLabeledValue(goal, '大数据接口') || extractLabeledValue(goal, '接口'))
  ) {
    return 'single';
  }

  return /多个|multi|bundle|多报表|驾驶舱联动|多模块联动/i.test(goal) ? 'multiple' : 'single';
}

export function inferLayout(goal: string): DataReportJsonSchema['meta']['layout'] {
  return /单表|single\s*-?\s*table|table[-\s]?first/i.test(goal) ? 'single-table' : 'dashboard';
}

export function inferTemplateRef(goal: string) {
  return /bonus\s*center|bonuscenter|银币|福利中心|兑换中心/i.test(goal) ? 'bonus-center-data' : 'generic-report';
}
