import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@/types/chat';

export interface CreateChatSessionActionsOptions {
  activeSessionId: string;
  activeSession?: ChatSessionRecord;
  checkpoint?: ChatCheckpointRecord;
  draft: string;
  setDraft: Dispatch<SetStateAction<string>>;
  setError: Dispatch<SetStateAction<string>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setSessions: Dispatch<SetStateAction<ChatSessionRecord[]>>;
  setMessages: Dispatch<SetStateAction<ChatMessageRecord[]>>;
  setEvents: Dispatch<SetStateAction<ChatEventRecord[]>>;
  setCheckpoint: Dispatch<SetStateAction<ChatCheckpointRecord | undefined>>;
  setActiveSessionId: Dispatch<SetStateAction<string>>;
  requestStreamReconnect: (sessionId: string) => void;
  pendingInitialMessage: MutableRefObject<{ sessionId: string; content: string } | null>;
  pendingUserIds: MutableRefObject<Record<string, string>>;
  pendingAssistantIds: MutableRefObject<Record<string, string>>;
  optimisticThinkingStartedAt: MutableRefObject<Record<string, string>>;
}

export interface OutboundChatMessage {
  display: string;
  payload: string;
  modelId?: string;
}
