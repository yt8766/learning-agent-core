import type { DataReportJsonSchema } from '../../../types/data-report-json';
import { normalizeIdentifier } from './goal-artifacts';

export function normalizeTextValue(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value && typeof value === 'object') {
    const candidate = value as { text?: unknown; fallback?: unknown; id?: unknown };
    if (typeof candidate.text === 'string') {
      return candidate.text.trim();
    }
    if (typeof candidate.fallback === 'string') {
      return candidate.fallback.trim();
    }
    if (typeof candidate.id === 'string') {
      return candidate.id.trim();
    }
  }
  return '';
}

function toFieldName(dataIndex?: string) {
  if (!dataIndex) {
    return '';
  }
  return dataIndex.replace(/_label$/i, '');
}

/**
 * Resolves user-facing labels back to schema field names.
 * The lookup prefers explicit table/metric/chart bindings before falling back to normalized text.
 */
export function resolveFieldFromLabel(schema: DataReportJsonSchema, label: string) {
  const normalizedLabel = normalizeTextValue(label);
  if (!normalizedLabel) {
    return '';
  }

  for (const section of schema.sections) {
    for (const block of section.blocks) {
      if (block.type === 'table') {
        for (const column of block.columns) {
          const columnTitle = normalizeTextValue(column.title);
          if (columnTitle === normalizedLabel) {
            const fieldFromDataIndex = toFieldName(column.dataIndex);
            if (fieldFromDataIndex) {
              return fieldFromDataIndex;
            }
            const fieldFromKey = toFieldName((column as { key?: string }).key);
            if (fieldFromKey) {
              return fieldFromKey;
            }
          }
        }
      }

      if (block.type === 'metrics') {
        const matchedMetric = block.items.find(item => item.label === normalizedLabel);
        if (matchedMetric?.field) {
          return matchedMetric.field;
        }
      }

      if (block.type === 'chart') {
        const matchedSeries = block.series.find(series => series.label === normalizedLabel);
        if (matchedSeries?.field) {
          return matchedSeries.field;
        }
      }
    }
  }

  return normalizeIdentifier(normalizedLabel);
}

export function normalizePatchLabel(rawValue: string) {
  return rawValue
    .trim()
    .replace(/^(新增|增加|添加)/, '')
    .replace(/^(图表\s*)?series\s*/i, '')
    .replace(/^指标\s*/, '')
    .replace(/列$/, '')
    .trim();
}
