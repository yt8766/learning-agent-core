import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '../types/chat';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
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

export function listSessions() {
  return request<ChatSessionRecord[]>('/chat/sessions');
}

export function createSession(message: string, title?: string) {
  return request<ChatSessionRecord>('/chat/sessions', {
    method: 'POST',
    body: JSON.stringify({ message, title })
  });
}

export function selectSession(sessionId: string) {
  return request<ChatSessionRecord>(`/chat/sessions/${sessionId}`);
}

export function listMessages() {
  return request<ChatMessageRecord[]>('/chat/messages');
}

export function listEvents() {
  return request<ChatEventRecord[]>('/chat/events');
}

export function getCheckpoint() {
  return request<ChatCheckpointRecord | undefined>('/chat/checkpoint');
}

export function appendMessage(message: string) {
  return request<ChatMessageRecord>('/chat/messages', {
    method: 'POST',
    body: JSON.stringify({ message })
  });
}

export function approveSession(intent: string) {
  return request<ChatSessionRecord>('/chat/approve', {
    method: 'POST',
    body: JSON.stringify({ intent, actor: 'agent-chat-user' })
  });
}

export function rejectSession(intent: string) {
  return request<ChatSessionRecord>('/chat/reject', {
    method: 'POST',
    body: JSON.stringify({ intent, actor: 'agent-chat-user' })
  });
}

export function confirmLearning(candidateIds?: string[]) {
  return request<ChatSessionRecord>('/chat/learning/confirm', {
    method: 'POST',
    body: JSON.stringify({ candidateIds, actor: 'agent-chat-user' })
  });
}

export function recoverSession() {
  return request<ChatSessionRecord>('/chat/recover', {
    method: 'POST',
    body: JSON.stringify({})
  });
}

export function createSessionStream() {
  return new EventSource(`${API_BASE}/chat/stream`, {
    withCredentials: true
  });
}
