import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface BonusCenterTemplateEntry {
  key: string;
  moduleId: string;
  routeName: string;
  title: string;
  apiName?: string;
}

interface StructuredReportIntent {
  pageTitle?: string;
  reportName?: string;
  serviceKey?: string;
  fields: string[];
  routeName?: string;
}

const BONUS_CENTER_ROUTE_NAME_OVERRIDES: Record<string, string> = {
  exchangeMall: 'silverCoinExchangeRecord'
};

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function camelCase(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function buildRouteNameFromKey(key: string) {
  return BONUS_CENTER_ROUTE_NAME_OVERRIDES[key] ?? key;
}

function normalizeRouteNameFromServiceKey(serviceKey: string) {
  const normalized = serviceKey.trim();
  if (/^get_bc_exchange_mall_data$/i.test(normalized)) {
    return 'silverCoinExchangeRecord';
  }

  return camelCase(
    normalized
      .replace(/^get_/i, '')
      .replace(/_data$/i, '')
      .replace(/^bc_/, 'bc ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, char => char.toUpperCase())
      .replace(/\s+/g, '')
  );
}

function parseBonusCenterTitles(templateDir: string) {
  const configPath = join(templateDir, 'pages', 'dataDashboard', 'bonusCenterData', 'config.tsx');
  const raw = readFileSync(configPath, 'utf8');
  return Array.from(raw.matchAll(/^\s*(\w+)\s*=\s*\d+,\s*\/\/\s*(.+)$/gm))
    .map(match => {
      const key = match[1];
      const title = match[2];
      return key && title
        ? {
            key,
            title: title.trim()
          }
        : null;
    })
    .filter((item): item is { key: string; title: string } => item !== null);
}

function parseBonusCenterApis(templateDir: string) {
  const servicePath = join(templateDir, 'services', 'data', 'bonusCenter.ts');
  const raw = readFileSync(servicePath, 'utf8');
  return Array.from(
    raw.matchAll(
      /\/\*\*[\s\S]*?使用大数据接口\s+([a-z0-9_]+)[\s\S]*?\*\/\s*export\s+async\s+function\s+get([A-Z][A-Za-z0-9]+)Data\(/g
    )
  )
    .map(match => {
      const apiName = match[1];
      const moduleId = match[2];
      return apiName && moduleId ? { apiName, moduleId } : null;
    })
    .filter((item): item is { apiName: string; moduleId: string } => item !== null);
}

export function collectBonusCenterTemplateEntries(templateDir: string): BonusCenterTemplateEntry[] {
  const titleByModule = new Map(
    parseBonusCenterTitles(templateDir).map(item => [item.key.toLowerCase(), item.title] as const)
  );
  const apis = parseBonusCenterApis(templateDir);

  return apis.map(item => {
    const key = camelCase(item.moduleId);
    return {
      key,
      moduleId: item.moduleId,
      routeName: buildRouteNameFromKey(key),
      title: titleByModule.get(key.toLowerCase()) ?? item.moduleId,
      apiName: item.apiName
    };
  });
}

export function findMatchedBonusCenterEntry(
  goal: string,
  taskContext: string | undefined,
  entries: BonusCenterTemplateEntry[],
  structuredIntent: StructuredReportIntent | undefined
) {
  if (structuredIntent) {
    const serviceKey = normalize(structuredIntent.serviceKey ?? '');
    const reportName = normalize(structuredIntent.reportName ?? '');
    const routeName = normalize(structuredIntent.routeName ?? '');

    const structuredMatch = entries.find(entry => {
      const candidates = [entry.apiName, entry.title, entry.routeName, entry.key, entry.moduleId]
        .filter(Boolean)
        .map(candidate => normalize(candidate!));
      return (
        (serviceKey && candidates.includes(serviceKey)) ||
        (reportName && candidates.includes(reportName)) ||
        (routeName && candidates.includes(routeName))
      );
    });

    if (structuredMatch) {
      return structuredMatch;
    }
  }

  const text = normalize(`${goal}\n${taskContext ?? ''}`);
  return entries.find(entry => {
    const candidates = [entry.title, entry.key, entry.moduleId, entry.routeName, entry.apiName].filter(
      Boolean
    ) as string[];
    return candidates.some(candidate => text.includes(normalize(candidate)));
  });
}
