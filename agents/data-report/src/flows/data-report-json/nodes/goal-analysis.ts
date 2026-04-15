import type { DataReportJsonAnalysisArtifact, DataReportJsonSchema } from '../../../types/data-report-json';
import { resetDataReportJsonNodeCaches as resetSharedNodeCaches } from './shared-core';
import {
  inferLayout,
  inferReportName,
  inferRouteName,
  inferScope,
  inferServiceKey,
  inferTemplateRef,
  parseGoalArtifacts
} from './goal-parser';

const analysisCache = new Map<string, DataReportJsonAnalysisArtifact>();

function buildCacheKey(goal: string, suffix: string) {
  return `${suffix}:${goal.trim()}`;
}

export function resetDataReportJsonGoalArtifactCaches() {
  analysisCache.clear();
  resetSharedNodeCaches();
}

export function deriveAnalysisFromSchema(schema: DataReportJsonSchema): DataReportJsonAnalysisArtifact {
  return {
    templateRef: schema.meta.templateRef,
    scope: schema.meta.scope,
    routeName: schema.meta.reportId,
    route: schema.meta.route,
    title: schema.meta.title,
    layout: schema.meta.layout
  };
}

export function deriveAnalysisFromGoal(goal: string) {
  const cached = analysisCache.get(buildCacheKey(goal, 'analysis'));
  if (cached) {
    return {
      analysis: cached,
      cacheHit: true
    };
  }

  const artifacts = parseGoalArtifacts(goal);
  const title = artifacts.title ?? inferReportName(goal);
  const reportName = artifacts.reportName ?? inferReportName(goal);
  const routeName = inferRouteName(goal);
  const analysis: DataReportJsonAnalysisArtifact = {
    templateRef: inferTemplateRef(goal),
    scope: inferScope(goal),
    routeName,
    route: `/dataDashboard/${routeName}`,
    title,
    layout: inferLayout(goal),
    reportName,
    serviceKey: inferServiceKey(goal)
  };
  analysisCache.set(buildCacheKey(goal, 'analysis'), analysis);
  return {
    analysis,
    cacheHit: false
  };
}

export function deriveAnalysisFromGoalWithCacheControl(goal: string, disableCache = false) {
  if (disableCache) {
    const artifacts = parseGoalArtifacts(goal);
    const title = artifacts.title ?? inferReportName(goal);
    const reportName = artifacts.reportName ?? inferReportName(goal);
    const routeName = inferRouteName(goal);
    return {
      analysis: {
        templateRef: inferTemplateRef(goal),
        scope: inferScope(goal),
        routeName,
        route: `/dataDashboard/${routeName}`,
        title,
        layout: inferLayout(goal),
        reportName,
        serviceKey: inferServiceKey(goal)
      } satisfies DataReportJsonAnalysisArtifact,
      cacheHit: false
    };
  }

  return deriveAnalysisFromGoal(goal);
}
