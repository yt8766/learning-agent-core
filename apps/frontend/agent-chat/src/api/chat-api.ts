import axios from 'axios';

import { normalizeExecutionMode } from '@/lib/runtime-semantics';
import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 12000,
  headers: {
    'Content-Type': 'application/json'
  }
});

const inFlightRequests = new Map<string, Promise<unknown>>();
const resolvedRequestCache = new Map<string, { expiresAt: number; data: unknown }>();

async function request<T>(
  path: string,
  config?: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
    data?: unknown;
    dedupeKey?: string;
    cacheWindowMs?: number;
    timeoutMs?: number;
  }
): Promise<T> {
  const dedupeKey = config?.dedupeKey;
  const cacheWindowMs = config?.cacheWindowMs ?? 0;
  if (dedupeKey && cacheWindowMs > 0) {
    const cached = resolvedRequestCache.get(dedupeKey);
    if (cached && cached.expiresAt > Date.now()) {
      return Promise.resolve(cached.data as T);
    }
    if (cached) {
      resolvedRequestCache.delete(dedupeKey);
    }
  }
  if (dedupeKey) {
    const existing = inFlightRequests.get(dedupeKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const run = http
    .request<T>({
      url: path,
      method: config?.method ?? 'GET',
      data: config?.data,
      timeout: config?.timeoutMs
    })
    .then(response => {
      if (dedupeKey && cacheWindowMs > 0) {
        resolvedRequestCache.set(dedupeKey, {
          expiresAt: Date.now() + cacheWindowMs,
          data: response.data
        });
      }
      return response.data;
    })
    .finally(() => {
      if (dedupeKey) {
        inFlightRequests.delete(dedupeKey);
      }
    });

  if (dedupeKey) {
    inFlightRequests.set(dedupeKey, run);
  }

  return run;
}

function withSessionId(path: string, sessionId?: string) {
  if (!sessionId) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}

function toApiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export function listSessions() {
  return request<ChatSessionRecord[]>('/chat/sessions', {
    dedupeKey: 'GET:/chat/sessions',
    cacheWindowMs: 1000,
    timeoutMs: 5000
  });
}

export function createSession(message?: string, title?: string) {
  return request<ChatSessionRecord>('/chat/sessions', {
    method: 'POST',
    data: { message, title }
  });
}

export function selectSession(sessionId: string) {
  return request<ChatSessionRecord>(`/chat/sessions/${sessionId}`);
}

export function listMessages(sessionId: string) {
  return request<ChatMessageRecord[]>(withSessionId('/chat/messages', sessionId), {
    dedupeKey: `GET:/chat/messages:${sessionId}`,
    cacheWindowMs: 400,
    timeoutMs: 5000
  });
}

export function listEvents(sessionId: string) {
  return request<ChatEventRecord[]>(withSessionId('/chat/events', sessionId), {
    dedupeKey: `GET:/chat/events:${sessionId}`,
    cacheWindowMs: 400,
    timeoutMs: 5000
  });
}

export function getCheckpoint(sessionId: string) {
  return request<ChatCheckpointRecord | undefined>(withSessionId('/chat/checkpoint', sessionId), {
    dedupeKey: `GET:/chat/checkpoint:${sessionId}`,
    timeoutMs: 5000
  });
}

export function appendMessage(sessionId: string, message: string) {
  return request<ChatMessageRecord>('/chat/messages', {
    method: 'POST',
    data: { message, sessionId }
  });
}

export function approveSession(
  sessionId: string,
  intent: string,
  feedback?: string,
  approvalScope?: 'once' | 'session' | 'always'
) {
  return request<ChatSessionRecord>('/chat/approve', {
    method: 'POST',
    data: { intent, actor: 'agent-chat-user', sessionId, feedback, approvalScope }
  });
}

export function rejectSession(sessionId: string, intent: string, feedback?: string) {
  return request<ChatSessionRecord>('/chat/reject', {
    method: 'POST',
    data: { intent, actor: 'agent-chat-user', sessionId, feedback }
  });
}

export function respondInterrupt(
  sessionId: string,
  params: {
    endpoint: 'approve' | 'reject';
    intent?: string;
    feedback?: string;
    interrupt: {
      interruptId?: string;
      action: 'approve' | 'reject' | 'feedback' | 'input' | 'bypass' | 'abort';
      payload?: Record<string, unknown>;
    };
  }
) {
  return request<ChatSessionRecord>(`/chat/${params.endpoint}`, {
    method: 'POST',
    data: {
      sessionId,
      intent: params.intent,
      actor: 'agent-chat-user',
      feedback: params.feedback,
      interrupt: params.interrupt
    }
  });
}

export function allowApprovalCapability(connectorId: string, capabilityId: string) {
  return request(
    `/platform/connectors-center/${encodeURIComponent(connectorId)}/capabilities/${encodeURIComponent(capabilityId)}/policy/allow`,
    {
      method: 'POST'
    }
  );
}

export function allowApprovalConnector(connectorId: string) {
  return request(`/platform/connectors-center/${encodeURIComponent(connectorId)}/policy/allow`, {
    method: 'POST'
  });
}

export function installRemoteSkill(params: {
  repo: string;
  skillName?: string;
  detailsUrl?: string;
  installCommand?: string;
  triggerReason?: 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed';
  summary?: string;
}) {
  return request<{
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'installed' | 'failed';
    phase?: string;
    result?: string;
  }>('/platform/skill-sources-center/install-remote', {
    method: 'POST',
    data: {
      ...params,
      actor: 'agent-chat-user'
    }
  });
}

export function getRemoteSkillInstallReceipt(receiptId: string) {
  return request<{
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'installed' | 'failed';
    phase?: string;
    result?: string;
    failureCode?: string;
    failureDetail?: string;
    installedAt?: string;
  }>(`/platform/skill-sources-center/receipts/${encodeURIComponent(receiptId)}`, {
    dedupeKey: `GET:/platform/skill-sources-center/receipts/${receiptId}`,
    cacheWindowMs: 300,
    timeoutMs: 5000
  });
}

export function confirmLearning(sessionId: string, candidateIds?: string[]) {
  return request<ChatSessionRecord>('/chat/learning/confirm', {
    method: 'POST',
    data: { candidateIds, actor: 'agent-chat-user', sessionId }
  });
}

export function recoverSession(sessionId: string) {
  return request<ChatSessionRecord>('/chat/recover', {
    method: 'POST',
    data: { sessionId }
  });
}

export function cancelSession(sessionId: string, reason?: string) {
  return request<ChatSessionRecord>('/chat/cancel', {
    method: 'POST',
    data: { sessionId, actor: 'agent-chat-user', reason }
  });
}

export function deleteSession(sessionId: string) {
  return request<void>(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE'
  });
}

export function updateSession(sessionId: string, title: string) {
  return request<ChatSessionRecord>(`/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    data: { title }
  });
}

export function createSessionStream(sessionId: string) {
  return new EventSource(`${API_BASE}${withSessionId('/chat/stream', sessionId)}`, {
    withCredentials: true
  });
}

export function exportRuntimeCenter(params?: {
  executionMode?: string;
  interactionKind?: string;
  format?: 'csv' | 'json';
}) {
  return request<{ filename: string; mimeType: string; content: string }>(buildRuntimeCenterExportPath(params));
}

export function buildRuntimeCenterExportPath(params?: {
  executionMode?: string;
  interactionKind?: string;
  format?: 'csv' | 'json';
}) {
  const search = new URLSearchParams();
  search.set('days', '30');
  const executionMode = normalizeExecutionMode(params?.executionMode) ?? params?.executionMode;
  if (executionMode) search.set('executionMode', executionMode);
  if (params?.interactionKind) search.set('interactionKind', params.interactionKind);
  search.set('format', params?.format ?? 'json');
  return `/platform/runtime-center/export?${search.toString()}`;
}

export function buildRuntimeCenterExportUrl(params?: {
  executionMode?: string;
  interactionKind?: string;
  format?: 'csv' | 'json';
}) {
  return toApiUrl(buildRuntimeCenterExportPath(params));
}

export function exportApprovalsCenter(params?: {
  executionMode?: string;
  interactionKind?: string;
  format?: 'csv' | 'json';
}) {
  return request<{ filename: string; mimeType: string; content: string }>(buildApprovalsCenterExportPath(params));
}

export function buildApprovalsCenterExportPath(params?: {
  executionMode?: string;
  interactionKind?: string;
  format?: 'csv' | 'json';
}) {
  const search = new URLSearchParams();
  const executionMode = normalizeExecutionMode(params?.executionMode) ?? params?.executionMode;
  if (executionMode) search.set('executionMode', executionMode);
  if (params?.interactionKind) search.set('interactionKind', params.interactionKind);
  search.set('format', params?.format ?? 'json');
  return `/platform/approvals-center/export?${search.toString()}`;
}

export function buildApprovalsCenterExportUrl(params?: {
  executionMode?: string;
  interactionKind?: string;
  format?: 'csv' | 'json';
}) {
  return toApiUrl(buildApprovalsCenterExportPath(params));
}

export function getBrowserReplay(sessionId: string) {
  return request<Record<string, unknown>>(buildBrowserReplayPath(sessionId));
}

export function buildBrowserReplayPath(sessionId: string) {
  return `/platform/browser-replays/${encodeURIComponent(sessionId)}`;
}

export function buildBrowserReplayUrl(sessionId: string) {
  return toApiUrl(buildBrowserReplayPath(sessionId));
}

export interface ReportSchemaStreamRequest {
  message: string;
  reportSchemaInput?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  modelId?: string;
  currentSchema?: Record<string, unknown>;
  preferLlm?: boolean;
}

export interface ReportSchemaStreamEvent {
  type: string;
  data?: Record<string, unknown>;
  message?: string;
}

export async function streamReportSchema(
  input: ReportSchemaStreamRequest,
  onEvent: (event: ReportSchemaStreamEvent) => void
) {
  const message = input.currentSchema
    ? `CHANGE_REQUEST: ${input.message}\nCURRENT_SCHEMA:\n${JSON.stringify(input.currentSchema)}`
    : input.message;
  const response = await fetch(toApiUrl('/chat'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message,
      preferLlm: input.preferLlm ?? true,
      reportSchemaInput: input.reportSchemaInput,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      modelId: input.modelId,
      responseFormat: 'report-schema'
    })
  });

  if (!response.ok || !response.body) {
    throw new Error(`Report schema request failed with status ${response.status}.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const parsed = parseSseFrame(frame);
      if (parsed) {
        onEvent(parsed);
      }
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseFrame(buffer);
    if (parsed) {
      onEvent(parsed);
    }
  }
}

function parseSseFrame(frame: string): ReportSchemaStreamEvent | null {
  const trimmed = frame.trim();
  if (!trimmed || trimmed.startsWith(':')) {
    return null;
  }

  const eventType = trimmed
    .split('\n')
    .find(line => line.startsWith('event:'))
    ?.slice('event:'.length)
    .trim();
  const dataText = trimmed
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trim())
    .join('\n');

  if (!eventType) {
    return null;
  }

  if (!dataText) {
    return { type: eventType };
  }

  try {
    return {
      type: eventType,
      data: JSON.parse(dataText) as Record<string, unknown>
    };
  } catch {
    return {
      type: eventType,
      message: dataText
    };
  }
}
