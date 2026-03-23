import axios from 'axios';

import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '../types/chat';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';
const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

async function request<T>(
  path: string,
  config?: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
    data?: unknown;
  }
): Promise<T> {
  const response = await http.request<T>({
    url: path,
    method: config?.method ?? 'GET',
    data: config?.data
  });

  return response.data;
}

function withSessionId(path: string, sessionId?: string) {
  if (!sessionId) {
    return path;
  }

  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}

export function listSessions() {
  return request<ChatSessionRecord[]>('/chat/sessions');
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
  return request<ChatMessageRecord[]>(withSessionId('/chat/messages', sessionId));
}

export function listEvents(sessionId: string) {
  return request<ChatEventRecord[]>(withSessionId('/chat/events', sessionId));
}

export function getCheckpoint(sessionId: string) {
  return request<ChatCheckpointRecord | undefined>(withSessionId('/chat/checkpoint', sessionId));
}

export function appendMessage(sessionId: string, message: string) {
  return request<ChatMessageRecord>('/chat/messages', {
    method: 'POST',
    data: { message, sessionId }
  });
}

export function approveSession(sessionId: string, intent: string, feedback?: string) {
  return request<ChatSessionRecord>('/chat/approve', {
    method: 'POST',
    data: { intent, actor: 'agent-chat-user', sessionId, feedback }
  });
}

export function rejectSession(sessionId: string, intent: string, feedback?: string) {
  return request<ChatSessionRecord>('/chat/reject', {
    method: 'POST',
    data: { intent, actor: 'agent-chat-user', sessionId, feedback }
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
