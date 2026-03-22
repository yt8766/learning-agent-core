import type { ChatCheckpointRecord, ChatEventRecord, ChatMessageRecord, ChatSessionRecord } from '@agent/shared';

export interface SessionStoreSnapshot {
  chatSessions: ChatSessionRecord[];
  chatMessages: ChatMessageRecord[];
  chatEvents: ChatEventRecord[];
  chatCheckpoints: ChatCheckpointRecord[];
}
