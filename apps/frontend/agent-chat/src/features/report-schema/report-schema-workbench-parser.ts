function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function toRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(item => toRecord(item)).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
}

export function parseWorkbenchJsonDraft<T>(draft: string, label: string): T | undefined {
  const trimmed = draft.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`${label} JSON 解析失败：${reason}`);
  }
}

export function normalizeWorkbenchSchema(
  schema: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const base = toRecord(schema);
  if (!base) {
    return undefined;
  }

  const normalizedSections = toRecordArray(base.sections).map(section => ({
    ...section,
    blocks: toRecordArray(section.blocks).map(block => {
      if (block.type === 'metrics') {
        return {
          ...block,
          items: toRecordArray(block.items)
        };
      }

      if (block.type === 'chart') {
        return {
          ...block,
          series: toRecordArray(block.series)
        };
      }

      if (block.type === 'table') {
        return {
          ...block,
          columns: toRecordArray(block.columns)
        };
      }

      return block;
    })
  }));

  const normalizedDataSources = Object.fromEntries(
    Object.entries(toRecord(base.dataSources) ?? {}).flatMap(([key, value]) => {
      const source = toRecord(value);
      return source ? [[key, source] as const] : [];
    })
  );
  const filterSchema = toRecord(base.filterSchema);

  return {
    ...base,
    filterSchema: filterSchema
      ? {
          ...filterSchema,
          fields: toRecordArray(filterSchema.fields)
        }
      : undefined,
    dataSources: normalizedDataSources,
    sections: normalizedSections,
    warnings: Array.isArray(base.warnings) ? base.warnings.map(item => String(item)) : []
  };
}

export function toWorkbenchRecord(value: unknown) {
  return toRecord(value);
}
