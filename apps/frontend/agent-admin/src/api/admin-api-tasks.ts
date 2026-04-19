import type { CreateTaskDto } from '@agent/core';

import type {
  AgentMessageRecord,
  AgentStateRecord,
  ReviewRecord,
  TaskBundle,
  TaskPlan,
  TaskRecord,
  TraceRecord
} from '@/types/admin';
import { request } from './admin-api-core';

export interface CreateAgentDiagnosisTaskDto {
  taskId: string;
  errorCode: string;
  message: string;
  goal?: string;
  ministry?: string;
  diagnosisHint?: string;
  recommendedAction?: string;
  recoveryPlaybook?: string[];
  stack?: string;
}

function shouldRequestTaskReview(task: TaskRecord) {
  return ['completed', 'failed', 'cancelled'].includes(task.status);
}

export async function getTaskBundle(taskId: string): Promise<TaskBundle> {
  const task = await request<TaskRecord>(`/tasks/${taskId}`, {
    cancelKey: `task:${taskId}:record`,
    cancelPrevious: true
  });

  const [plan, agents, messages, review, traces, audit] = await Promise.all([
    request<TaskPlan>(`/tasks/${taskId}/plan`).catch(() => undefined),
    request<AgentStateRecord[]>(`/tasks/${taskId}/agents`).catch(() => []),
    request<AgentMessageRecord[]>(`/tasks/${taskId}/messages`).catch(() => []),
    shouldRequestTaskReview(task)
      ? request<ReviewRecord | null>(`/tasks/${taskId}/review`).catch(() => undefined)
      : Promise.resolve(undefined),
    request<TraceRecord[]>(`/tasks/${taskId}/traces`).catch(() => []),
    request<TaskBundle['audit']>(`/tasks/${taskId}/audit`).catch(() => undefined)
  ]);

  return { task, plan, agents, messages, review: review ?? undefined, traces, audit };
}

export async function createTask(input: string | CreateTaskDto) {
  return request<TaskRecord>('/tasks', {
    method: 'POST',
    body: JSON.stringify(typeof input === 'string' ? { goal: input } : input)
  });
}

export async function createAgentDiagnosisTask(dto: CreateAgentDiagnosisTaskDto) {
  return request<TaskRecord>('/tasks/diagnosis', {
    method: 'POST',
    body: JSON.stringify(dto)
  });
}

export async function retryTask(taskId: string) {
  return request<TaskRecord>(`/tasks/${taskId}/retry`, {
    method: 'POST'
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
