import {
  AgentMessageRecord,
  AgentStateRecord,
  PlatformConsoleRecord,
  ReviewRecord,
  SkillRecord,
  TaskBundle,
  TaskPlan,
  TaskRecord,
  TraceRecord
} from '../types/admin';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getHealth() {
  return request<{ status: string; now: string }>('/health');
}

export async function getPlatformConsole(days = 30) {
  return request<PlatformConsoleRecord>(`/platform/console?days=${days}`);
}

export async function getRuntimeCenter(days = 30) {
  return request<PlatformConsoleRecord['runtime']>(`/platform/runtime-center?days=${days}`);
}

export async function getRuntimeCenterFiltered(params: {
  days?: number;
  status?: string;
  model?: string;
  pricingSource?: string;
}) {
  const search = new URLSearchParams();
  search.set('days', String(params.days ?? 30));
  if (params.status) search.set('status', params.status);
  if (params.model) search.set('model', params.model);
  if (params.pricingSource) search.set('pricingSource', params.pricingSource);
  return request<PlatformConsoleRecord['runtime']>(`/platform/runtime-center?${search.toString()}`);
}

export async function getApprovalsCenter() {
  return request<PlatformConsoleRecord['approvals']>('/platform/approvals-center');
}

export async function getLearningCenter() {
  return request<PlatformConsoleRecord['learning']>('/learning/center');
}

export async function getEvidenceCenter() {
  return request<PlatformConsoleRecord['evidence']>('/evidence/center');
}

export async function getConnectorsCenter() {
  return request<PlatformConsoleRecord['connectors']>('/platform/connectors-center');
}

export async function closeConnectorSession(connectorId: string) {
  return request<{ connectorId: string; closed: boolean }>(`/platform/connectors-center/${connectorId}/close-session`, {
    method: 'POST'
  });
}

export async function getEvalsCenter(days = 30) {
  return request<PlatformConsoleRecord['evals']>(`/platform/evals-center?days=${days}`);
}

export async function getEvalsCenterFiltered(params: { days?: number; scenarioId?: string; outcome?: string }) {
  const search = new URLSearchParams();
  search.set('days', String(params.days ?? 30));
  if (params.scenarioId) search.set('scenarioId', params.scenarioId);
  if (params.outcome) search.set('outcome', params.outcome);
  return request<PlatformConsoleRecord['evals']>(`/platform/evals-center?${search.toString()}`);
}

export async function exportRuntimeCenter(params: {
  days?: number;
  status?: string;
  model?: string;
  pricingSource?: string;
  format?: 'csv' | 'json';
}) {
  const search = new URLSearchParams();
  search.set('days', String(params.days ?? 30));
  if (params.status) search.set('status', params.status);
  if (params.model) search.set('model', params.model);
  if (params.pricingSource) search.set('pricingSource', params.pricingSource);
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

export async function getTaskBundle(taskId: string): Promise<TaskBundle> {
  const [task, plan, agents, messages, review, traces] = await Promise.all([
    request<TaskRecord>(`/tasks/${taskId}`),
    request<TaskPlan>(`/tasks/${taskId}/plan`).catch(() => undefined),
    request<AgentStateRecord[]>(`/tasks/${taskId}/agents`).catch(() => []),
    request<AgentMessageRecord[]>(`/tasks/${taskId}/messages`).catch(() => []),
    request<ReviewRecord>(`/tasks/${taskId}/review`).catch(() => undefined),
    request<TraceRecord[]>(`/tasks/${taskId}/traces`).catch(() => [])
  ]);

  return { task, plan, agents, messages, review, traces };
}

export async function createTask(goal: string) {
  return request<TaskRecord>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ goal })
  });
}

export async function approveTask(taskId: string, intent: string) {
  return request<TaskRecord>(`/tasks/${taskId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ intent, actor: 'agent-admin-user' })
  });
}

export async function rejectTask(taskId: string, intent: string) {
  return request<TaskRecord>(`/tasks/${taskId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ intent, actor: 'agent-admin-user' })
  });
}

export async function promoteSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/promote`, { method: 'POST' });
}

export async function disableSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/disable`, { method: 'POST' });
}

export async function invalidateMemory(memoryId: string, reason: string) {
  return request(`/memory/${memoryId}/invalidate`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function supersedeMemory(memoryId: string, replacementId: string, reason: string) {
  return request(`/memory/${memoryId}/supersede`, {
    method: 'POST',
    body: JSON.stringify({ replacementId, reason })
  });
}

export async function restoreMemory(memoryId: string) {
  return request(`/memory/${memoryId}/restore`, {
    method: 'POST'
  });
}

export async function retireMemory(memoryId: string, reason: string) {
  return request(`/memory/${memoryId}/retire`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function invalidateRule(ruleId: string, reason: string) {
  return request(`/rules/${ruleId}/invalidate`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function supersedeRule(ruleId: string, replacementId: string, reason: string) {
  return request(`/rules/${ruleId}/supersede`, {
    method: 'POST',
    body: JSON.stringify({ replacementId, reason })
  });
}

export async function restoreRule(ruleId: string) {
  return request(`/rules/${ruleId}/restore`, {
    method: 'POST'
  });
}

export async function retireRule(ruleId: string, reason: string) {
  return request(`/rules/${ruleId}/retire`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  });
}

export async function restoreSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/restore`, { method: 'POST' });
}

export async function retireSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/retire`, { method: 'POST' });
}
