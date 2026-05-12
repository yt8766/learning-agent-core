import type {
  IntelligenceOverviewProjection,
  KnowledgeGovernanceProjection,
  RunBundleRecord,
  WorkflowPresetDefinition
} from '@agent/core';
import type { PlatformConsoleLogAnalysisRecord, PlatformConsoleRecord, RuntimeArchitectureRecord } from '@/types/admin';
import { request, type ChannelDeliveryRecord } from './admin-api-core';
import { normalizeExecutionMode } from '@/utils/runtime-semantics';

export * from './admin-api-agent-tools';
export * from './admin-api-sandbox';
export * from './admin-api-auto-review';

export async function getRuntimeCenter(days = 30) {
  return request<PlatformConsoleRecord['runtime']>(`/platform/runtime-center?days=${days}`, {
    cancelKey: 'runtime-center',
    cancelPrevious: true
  });
}

export async function getRuntimeCenterFiltered(params: {
  days?: number;
  status?: string;
  model?: string;
  pricingSource?: string;
  executionMode?: string;
  interactionKind?: string;
}) {
  const search = new URLSearchParams();
  search.set('days', String(params.days ?? 30));
  if (params.status) search.set('status', params.status);
  if (params.model) search.set('model', params.model);
  if (params.pricingSource) search.set('pricingSource', params.pricingSource);
  const executionMode = normalizeExecutionMode(params.executionMode) ?? params.executionMode;
  if (executionMode) search.set('executionMode', executionMode);
  if (params.interactionKind) search.set('interactionKind', params.interactionKind);
  return request<PlatformConsoleRecord['runtime']>(`/platform/runtime-center?${search.toString()}`, {
    cancelKey: 'runtime-center',
    cancelPrevious: true
  });
}

export async function getApprovalsCenter(params?: { executionMode?: string; interactionKind?: string }) {
  const search = new URLSearchParams();
  const executionMode = normalizeExecutionMode(params?.executionMode) ?? params?.executionMode;
  if (executionMode) search.set('executionMode', executionMode);
  if (params?.interactionKind) search.set('interactionKind', params.interactionKind);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return request<PlatformConsoleRecord['approvals']>(`/platform/approvals-center${suffix}`, {
    cancelKey: 'approvals-center',
    cancelPrevious: true
  });
}

export async function getRunObservatory(params?: {
  status?: string;
  model?: string;
  pricingSource?: string;
  executionMode?: string;
  interactionKind?: string;
  q?: string;
  hasInterrupt?: boolean;
  hasFallback?: boolean;
  hasRecoverableCheckpoint?: boolean;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  if (params?.model) search.set('model', params.model);
  if (params?.pricingSource) search.set('pricingSource', params.pricingSource);
  const executionMode = normalizeExecutionMode(params?.executionMode) ?? params?.executionMode;
  if (executionMode) search.set('executionMode', executionMode);
  if (params?.interactionKind) search.set('interactionKind', params.interactionKind);
  if (params?.q) search.set('q', params.q);
  if (typeof params?.hasInterrupt === 'boolean') search.set('hasInterrupt', String(params.hasInterrupt));
  if (typeof params?.hasFallback === 'boolean') search.set('hasFallback', String(params.hasFallback));
  if (typeof params?.hasRecoverableCheckpoint === 'boolean') {
    search.set('hasRecoverableCheckpoint', String(params.hasRecoverableCheckpoint));
  }
  if (typeof params?.limit === 'number') search.set('limit', String(Math.max(1, Math.floor(params.limit))));
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return request<RunBundleRecord['run'][]>(`/platform/run-observatory${suffix}`, {
    cancelKey: 'run-observatory',
    cancelPrevious: true
  });
}

export async function getRunObservatoryDetail(taskId: string) {
  return request<RunBundleRecord>(`/platform/run-observatory/${encodeURIComponent(taskId)}`, {
    cancelKey: `run-observatory:${taskId}`,
    cancelPrevious: true
  });
}

export async function getWorkflowPresets() {
  return request<WorkflowPresetDefinition[]>('/platform/workflow-presets', {
    cancelKey: 'workflow-presets',
    cancelPrevious: true
  });
}

export async function getApprovalScopePolicies() {
  return request<NonNullable<PlatformConsoleRecord['runtime']['approvalScopePolicies']>>(
    '/platform/approval-policies',
    {
      cancelKey: 'approval-policies',
      cancelPrevious: true
    }
  );
}

export async function revokeApprovalScopePolicy(policyId: string) {
  return request(`/platform/approval-policies/${encodeURIComponent(policyId)}/revoke`, {
    method: 'POST'
  });
}

export async function getLearningCenter() {
  return request<PlatformConsoleRecord['learning']>('/learning/center', {
    cancelKey: 'learning-center',
    cancelPrevious: true
  });
}

export async function getEvidenceCenter() {
  return request<PlatformConsoleRecord['evidence']>('/evidence/center', {
    cancelKey: 'evidence-center',
    cancelPrevious: true
  });
}

export async function recoverToCheckpoint(params: {
  sessionId: string;
  checkpointCursor?: number;
  checkpointId?: string;
  reason?: string;
}) {
  return request('/chat/recover-to-checkpoint', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}

export async function getBrowserReplay(sessionId: string) {
  return request<Record<string, unknown>>(`/platform/browser-replays/${sessionId}`);
}

export async function getChannelDeliveries() {
  return request<ChannelDeliveryRecord[]>('/gateway/deliveries', {
    cancelKey: 'gateway-deliveries',
    cancelPrevious: true
  });
}

export async function getConnectorsCenter() {
  return request<PlatformConsoleRecord['connectors']>('/platform/connectors-center', {
    cancelKey: 'connectors-center',
    cancelPrevious: true
  });
}

export async function getToolsCenter() {
  return request<NonNullable<PlatformConsoleRecord['runtime']['tools']>>('/platform/tools-center', {
    cancelKey: 'tools-center',
    cancelPrevious: true
  });
}

export async function getRuntimeArchitecture() {
  return request<RuntimeArchitectureRecord>('/runtime/architecture', {
    cancelKey: 'runtime-architecture',
    cancelPrevious: true
  });
}

export async function getSkillSourcesCenter() {
  return request<PlatformConsoleRecord['skillSources']>('/platform/skill-sources-center', {
    cancelKey: 'skill-sources-center',
    cancelPrevious: true
  });
}

export async function getCompanyAgentsCenter() {
  return request<PlatformConsoleRecord['companyAgents']>('/platform/company-agents-center', {
    cancelKey: 'company-agents-center',
    cancelPrevious: true
  });
}

export async function getIntelligenceOverview() {
  return request<IntelligenceOverviewProjection>('/platform/intelligence/overview', {
    cancelKey: 'intelligence-overview',
    cancelPrevious: true
  });
}

export async function forceIntelligenceRun(channel: string) {
  return request(`/platform/intelligence/${encodeURIComponent(channel)}/force-run`, {
    method: 'POST'
  });
}

export async function getKnowledgeGovernanceProjection() {
  return request<KnowledgeGovernanceProjection>('/platform/knowledge/governance', {
    cancelKey: 'knowledge-governance',
    cancelPrevious: true
  });
}

export async function refreshMetricsSnapshots(days = 30) {
  return request<{
    days: number;
    refreshedAt: string;
  }>(`/platform/console/refresh-metrics?days=${days}`, {
    method: 'POST'
  });
}

export async function getPlatformConsoleLogAnalysis(days = 7) {
  return request<PlatformConsoleLogAnalysisRecord>(`/platform/console/log-analysis?days=${days}`, {
    cancelKey: 'platform-console-log-analysis',
    cancelPrevious: true
  });
}

export async function getEvalsCenter(days = 30) {
  return request<PlatformConsoleRecord['evals']>(`/platform/evals-center?days=${days}`, {
    cancelKey: 'evals-center',
    cancelPrevious: true
  });
}

export async function getEvalsCenterFiltered(params: { days?: number; scenarioId?: string; outcome?: string }) {
  const search = new URLSearchParams();
  search.set('days', String(params.days ?? 30));
  if (params.scenarioId) search.set('scenarioId', params.scenarioId);
  if (params.outcome) search.set('outcome', params.outcome);
  return request<PlatformConsoleRecord['evals']>(`/platform/evals-center?${search.toString()}`, {
    cancelKey: 'evals-center',
    cancelPrevious: true
  });
}

export async function exportRuntimeCenter(params: {
  days?: number;
  status?: string;
  model?: string;
  pricingSource?: string;
  executionMode?: string;
  interactionKind?: string;
  format?: 'csv' | 'json';
}) {
  const search = new URLSearchParams();
  search.set('days', String(params.days ?? 30));
  if (params.status) search.set('status', params.status);
  if (params.model) search.set('model', params.model);
  if (params.pricingSource) search.set('pricingSource', params.pricingSource);
  const executionMode = normalizeExecutionMode(params.executionMode) ?? params.executionMode;
  if (executionMode) search.set('executionMode', executionMode);
  if (params.interactionKind) search.set('interactionKind', params.interactionKind);
  search.set('format', params.format ?? 'csv');
  return request<{ filename: string; mimeType: string; content: string }>(
    `/platform/runtime-center/export?${search.toString()}`
  );
}

export async function exportEvalsCenter(params: {
  days?: number;
  scenarioId?: string;
  outcome?: string;
  format?: 'csv' | 'json';
}) {
  const search = new URLSearchParams();
  search.set('days', String(params.days ?? 30));
  if (params.scenarioId) search.set('scenarioId', params.scenarioId);
  if (params.outcome) search.set('outcome', params.outcome);
  search.set('format', params.format ?? 'csv');
  return request<{ filename: string; mimeType: string; content: string }>(
    `/platform/evals-center/export?${search.toString()}`
  );
}

export async function exportApprovalsCenter(params: {
  executionMode?: string;
  interactionKind?: string;
  format?: 'csv' | 'json';
}) {
  const search = new URLSearchParams();
  const executionMode = normalizeExecutionMode(params.executionMode) ?? params.executionMode;
  if (executionMode) search.set('executionMode', executionMode);
  if (params.interactionKind) search.set('interactionKind', params.interactionKind);
  search.set('format', params.format ?? 'csv');
  return request<{ filename: string; mimeType: string; content: string }>(
    `/platform/approvals-center/export?${search.toString()}`
  );
}
