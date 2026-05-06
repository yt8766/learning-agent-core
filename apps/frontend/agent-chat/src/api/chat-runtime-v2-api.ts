import { ChatViewStreamEventSchema, ChatViewStreamEventTypeSchema, type ChatViewStreamEvent } from '@agent/core';

import { API_BASE } from '@/utils/http-client';

export interface ChatViewStreamParams {
  sessionId: string;
  runId?: string;
  afterSeq?: number;
}

export function buildChatViewStreamPath(params: ChatViewStreamParams) {
  const search = new URLSearchParams();
  search.set('sessionId', params.sessionId);
  if (params.runId) {
    search.set('runId', params.runId);
  }
  if (typeof params.afterSeq === 'number') {
    search.set('afterSeq', String(params.afterSeq));
  }

  return `/chat/view-stream?${search.toString()}`;
}

export function createChatViewStream(params: ChatViewStreamParams) {
  if (!params.sessionId || !params.runId) {
    return undefined;
  }

  return new EventSource(`${API_BASE}${buildChatViewStreamPath(params)}`, {
    withCredentials: true
  });
}

export function parseChatViewStreamEvent(data: string): ChatViewStreamEvent | undefined {
  try {
    return ChatViewStreamEventSchema.parse(JSON.parse(data));
  } catch {
    return undefined;
  }
}

export function getRunIdForChatRuntimeV2ViewStream(result: unknown) {
  if (!isRecord(result) || result.handledAs !== 'new_run' || !isRecord(result.run)) {
    return undefined;
  }

  return typeof result.run.id === 'string' ? result.run.id : undefined;
}

export const CHAT_VIEW_STREAM_EVENT_TYPES = ChatViewStreamEventTypeSchema.options;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
