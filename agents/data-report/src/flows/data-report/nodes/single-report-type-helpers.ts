import type { DataReportSandpackGraphState } from '../../../types/data-report';

export function toPascalCase(value: string) {
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

export function buildTypesFromMock(routeName: string, payload: unknown) {
  const declarations: string[] = [];
  const responseName = `${toPascalCase(routeName)}Response`;
  inferTypeLiteral(payload, responseName, declarations);

  const rowDeclaration = buildRowTypeFromRecords(routeName, payload);

  return `${[...declarations, rowDeclaration].filter(Boolean).join('\n\n')}\n`;
}

export function buildMockServiceCode(state: DataReportSandpackGraphState, routeName: string, payload: unknown) {
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

export function getMockRecords(payload: unknown) {
  const payloadRecord = typeof payload === 'object' && payload ? (payload as Record<string, unknown>) : undefined;
  const dataRecord =
    payloadRecord && typeof payloadRecord.data === 'object' && payloadRecord.data
      ? (payloadRecord.data as Record<string, unknown>)
      : undefined;
  return Array.isArray(dataRecord?.records) ? (dataRecord.records as Array<Record<string, unknown>>) : [];
}

export function buildMetricKeys(payload: unknown) {
  const firstRow = getMockRecords(payload)[0] ?? {};
  return Object.keys(firstRow)
    .filter(key => key !== 'id' && key !== 'dt' && typeof firstRow[key] === 'number')
    .slice(0, 4);
}
