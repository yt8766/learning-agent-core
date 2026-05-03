import type { ChatCheckpointRecord, ChatMessageRecord, ChatSessionRecord } from '@agent/core';

import type { SessionCoordinatorStore } from './session-coordinator-store';

export function dedupeById<T extends { id: string }>(items: T[]) {
  const deduped = new Map<string, T>();
  for (const item of items) {
    deduped.set(item.id, item);
  }
  return Array.from(deduped.values());
}

export function finalizeInlineCapabilityCheckpoint(checkpoint: ChatCheckpointRecord, completedAt: string): void {
  checkpoint.updatedAt = completedAt;
  checkpoint.graphState = {
    ...(checkpoint.graphState ?? {}),
    status: 'completed'
  } as never;
  checkpoint.thinkState = checkpoint.thinkState
    ? {
        ...checkpoint.thinkState,
        loading: false,
        blink: false
      }
    : undefined;
  checkpoint.pendingApproval = undefined;
  checkpoint.pendingApprovals = [];
  checkpoint.activeInterrupt = undefined;
  checkpoint.pendingAction = undefined;
  checkpoint.streamStatus = undefined;
}

export function completeInlineCapabilitySession(params: {
  store: SessionCoordinatorStore;
  session: ChatSessionRecord;
  sessionId: string;
  userMessageContent: string;
  response: {
    role?: ChatMessageRecord['role'];
    content: string;
    card?: ChatMessageRecord['card'];
  };
}) {
  const userMessage = params.store.addMessage(params.sessionId, 'user', params.userMessageContent);
  const responseMessage = params.store.addMessage(
    params.sessionId,
    params.response.role ?? 'assistant',
    params.response.content,
    undefined,
    params.response.card
  );
  const completedAt = new Date().toISOString();
  params.session.updatedAt = completedAt;
  params.session.status = 'completed';
  const checkpoint =
    params.store.getCheckpoint(params.sessionId) ??
    params.store.createCheckpoint(
      params.sessionId,
      params.session.currentTaskId ?? `inline-capability:${params.sessionId}`
    );
  finalizeInlineCapabilityCheckpoint(checkpoint, completedAt);

  params.store.addEvent(params.sessionId, 'user_message', {
    messageId: userMessage.id,
    content: userMessage.content,
    title: params.session.title
  });
  params.store.addEvent(params.sessionId, 'assistant_message', {
    messageId: responseMessage.id,
    content: responseMessage.content,
    role: responseMessage.role,
    card: responseMessage.card,
    title: params.session.title,
    summary: responseMessage.content
  });
  params.store.addEvent(params.sessionId, 'final_response_completed', {
    messageId: responseMessage.id,
    content: responseMessage.content,
    title: params.session.title,
    taskId: checkpoint.taskId
  });

  return {
    userMessage,
    responseMessage,
    checkpoint
  };
}
