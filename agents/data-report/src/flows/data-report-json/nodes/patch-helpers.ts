import type { DataReportJsonPatchIntent, DataReportJsonSchema } from '../../../types/data-report-json';
import {
  DataReportJsonPatchTarget,
  cloneSchema,
  getSectionPatchCache,
  setSectionPatchCache,
  stableStringify
} from './shared-core';
import { parsePatchIntents } from './patch-intent-parser';
export { applySchemaModification } from './schema-patch-mutations';
import { applySchemaModification } from './schema-patch-mutations';

export function resolveNodeScopedPatchTarget(request?: string): DataReportJsonPatchTarget | undefined {
  const normalized = request?.trim() ?? '';
  if (!normalized) {
    return undefined;
  }

  if (
    /(数据源|接口|serviceKey|data source)/i.test(normalized) &&
    !/图表|chart|指标|metric|明细表|表格|table|筛选|filter/i.test(normalized)
  ) {
    return 'dataSources';
  }

  const intents = parsePatchIntents(normalized);
  const uniqueTargets = Array.from(new Set(intents.map(intent => intent.target)));
  if (uniqueTargets.length === 1) {
    return uniqueTargets[0];
  }

  return undefined;
}

export function resolveNodeScopedPatchTargetFromIntents(
  intents?: Array<{ target: DataReportJsonPatchTarget }>
): DataReportJsonPatchTarget | undefined {
  const uniqueTargets = Array.from(new Set((intents ?? []).map(intent => intent.target)));
  return uniqueTargets.length === 1 ? uniqueTargets[0] : undefined;
}

export function buildNodeScopedPatchOperations(params: {
  currentSchema: DataReportJsonSchema;
  request?: string;
  target: DataReportJsonPatchTarget;
}) {
  const targetMeta: Record<DataReportJsonPatchTarget, { path: string; summary: string }> = {
    filterSchema: { path: '/filterSchema', summary: '定向重生成筛选 schema' },
    dataSources: { path: '/dataSources', summary: '定向重生成数据源配置' },
    metricsBlock: { path: '/sections/0/blocks/metrics', summary: '定向重生成指标卡' },
    chartBlock: { path: '/sections/0/blocks/chart', summary: '定向重生成图表' },
    tableBlock: { path: '/sections/0/blocks/table', summary: '定向重生成明细表' }
  };

  const targetInfo = targetMeta[params.target];
  const changeSuffix = params.request?.trim() ? `：${params.request.trim()}` : '';
  return [{ op: 'prepend-block' as const, path: targetInfo.path, summary: `${targetInfo.summary}${changeSuffix}` }];
}

function resolveAffectedSectionIds(baseSchema: DataReportJsonSchema, request: string) {
  if (!request.trim()) {
    return baseSchema.sections.map(section => section.id);
  }
  const firstSection = baseSchema.sections[0]?.id;
  if (/第一个报表|首个报表|第一个 section/i.test(request) && firstSection) {
    return [firstSection];
  }
  return baseSchema.sections.map(section => section.id);
}

export function applySchemaModificationWithCache(
  baseSchema: DataReportJsonSchema,
  request?: string,
  disableCache = false,
  intents?: DataReportJsonPatchIntent[]
) {
  const normalizedRequest = request?.trim() ?? '';
  if (!normalizedRequest) {
    return { schema: cloneSchema(baseSchema), cacheHit: false };
  }

  const affectedSectionIds = resolveAffectedSectionIds(baseSchema, normalizedRequest);
  const fingerprint = stableStringify(baseSchema.sections.filter(section => affectedSectionIds.includes(section.id)));
  const cacheKey = [baseSchema.meta.reportId, affectedSectionIds.join(','), normalizedRequest, fingerprint].join('|');
  const cached = getSectionPatchCache(cacheKey, disableCache);
  if (cached) {
    return {
      schema: cloneSchema(cached.schema),
      patchOperations: cloneSchema(cached.patchOperations),
      cacheHit: true
    };
  }

  const schema = applySchemaModification(baseSchema, normalizedRequest, intents);
  setSectionPatchCache(
    cacheKey,
    { schema: cloneSchema(schema), patchOperations: cloneSchema(schema.patchOperations ?? []) },
    disableCache
  );
  return { schema, patchOperations: schema.patchOperations ?? [], cacheHit: false };
}
