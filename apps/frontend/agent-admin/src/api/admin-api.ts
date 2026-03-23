import {
  AgentMessageRecord,
  AgentStateRecord,
  ReviewRecord,
  RuleRecord,
  SkillRecord,
  TaskApprovalRecord,
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

export async function listTasks() {
  return request<TaskRecord[]>('/tasks');
}

export async function listPendingApprovals() {
  return request<Array<TaskRecord & { approvals: TaskApprovalRecord[] }>>('/approvals/pending');
}
export async function createTask(goal: string) {
  return request<TaskRecord>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ goal })
  });
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

export async function retryTask(taskId: string) {
  return request<TaskRecord>(`/tasks/${taskId}/retry`, { method: 'POST' });
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

export async function listLabSkills() {
  return request<SkillRecord[]>('/skills/lab');
}

export async function promoteSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/promote`, { method: 'POST' });
}

export async function disableSkill(skillId: string) {
  return request<SkillRecord>(`/skills/${skillId}/disable`, { method: 'POST' });
}

export async function listRules() {
  return request<RuleRecord[]>('/rules');
}

export async function createLearningJob(documentUri: string) {
  return request<{ id: string; status: string; summary?: string }>('/learning/documents', {
    method: 'POST',
    body: JSON.stringify({ documentUri })
  });
}
