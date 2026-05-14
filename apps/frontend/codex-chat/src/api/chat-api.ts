import type { ChatEventRecord, ChatMessageRecord, ChatModelOption, ChatSessionRecord } from '@/types/chat';

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const chatApi = {
  listSessions() {
    return requestJson<ChatSessionRecord[]>('/api/chat/sessions');
  },

  createSession(title = '新对话') {
    return requestJson<ChatSessionRecord>('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
  },

  deleteSession(sessionId: string) {
    return requestJson<void>(`/api/chat/sessions/${sessionId}`, {
      method: 'DELETE'
    });
  },

  updateSession(sessionId: string, title: string) {
    return requestJson<ChatSessionRecord>(`/api/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, titleSource: 'manual' })
    });
  },

  updateGeneratedSessionTitle(sessionId: string, title: string) {
    return requestJson<ChatSessionRecord>(`/api/chat/sessions/${sessionId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, titleSource: 'generated' })
    });
  },

  listMessages(sessionId: string) {
    return requestJson<ChatMessageRecord[]>(`/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`);
  },

  listEvents(sessionId: string) {
    return requestJson<ChatEventRecord[]>(`/api/chat/events?sessionId=${encodeURIComponent(sessionId)}`);
  },

  listModels() {
    return requestJson<ChatModelOption[]>('/api/chat/models');
  },

  postMessage(sessionId: string, message: string, modelId?: string) {
    return requestJson<ChatMessageRecord>('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message, modelId })
    });
  },

  approveSession(sessionId: string, reason: string) {
    return requestJson<ChatSessionRecord>('/api/chat/approve', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        actor: 'codex-chat',
        reason,
        approvalScope: 'once',
        interrupt: { action: 'approve', feedback: reason }
      })
    });
  },

  rejectSession(sessionId: string, reason: string) {
    return requestJson<ChatSessionRecord>('/api/chat/reject', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        actor: 'codex-chat',
        reason,
        interrupt: { action: 'abort', feedback: reason }
      })
    });
  },

  async generateTitle(userMessage: string, assistantMessage: string) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, text/event-stream',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        preferLlm: true,
        stream: false,
        message: [
          '请为下面这轮对话生成一个中文会话标题。',
          '只输出标题本身，不超过 12 个中文字符，不要标点，不要解释。',
          `用户：${userMessage}`,
          `助手：${assistantMessage.slice(0, 800)}`
        ].join('\n')
      })
    });

    if (!response.ok) {
      throw new Error((await response.text()) || `Request failed with ${response.status}`);
    }

    return response.text();
  }
};
