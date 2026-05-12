import type { ChatMessageRecord } from '@agent/core';

const STREAM_MESSAGE_PREFIXES = ['progress_stream_', 'direct_reply_', 'summary_stream_'] as const;

/**
 * Collapses assistant stream placeholders with their committed final messages.
 * Equivalence is task-based first and content-prefix based second to avoid duplicate UI answers after stream recovery.
 */
export function dedupeSessionMessages(messages: ChatMessageRecord[]) {
  const deduped: ChatMessageRecord[] = [];

  for (const message of messages) {
    const duplicateIndex = deduped.findIndex(candidate => shouldCollapseAssistantDuplicate(candidate, message));
    if (duplicateIndex >= 0) {
      deduped[duplicateIndex] = pickPreferredAssistantMessage(deduped[duplicateIndex]!, message);
      continue;
    }

    deduped.push(message);
  }

  return deduped;
}

function shouldCollapseAssistantDuplicate(left: ChatMessageRecord, right: ChatMessageRecord) {
  if (left.role !== 'assistant' || right.role !== 'assistant') {
    return false;
  }

  const leftTaskIdentity = resolveMessageTaskIdentity(left);
  const rightTaskIdentity = resolveMessageTaskIdentity(right);
  if (leftTaskIdentity !== rightTaskIdentity) {
    return false;
  }

  const leftContent = left.content.trim();
  const rightContent = right.content.trim();
  if (!leftContent || !rightContent) {
    return false;
  }

  return leftContent === rightContent || leftContent.startsWith(rightContent) || rightContent.startsWith(leftContent);
}

function resolveMessageTaskIdentity(message: ChatMessageRecord) {
  if (message.taskId) {
    return message.taskId;
  }

  for (const prefix of STREAM_MESSAGE_PREFIXES) {
    if (message.id.startsWith(prefix)) {
      return message.id.slice(prefix.length);
    }
  }

  return message.id;
}

function pickPreferredAssistantMessage(left: ChatMessageRecord, right: ChatMessageRecord) {
  const leftContent = left.content.trim();
  const rightContent = right.content.trim();

  if (isTransientAssistantMessage(left) && !isTransientAssistantMessage(right)) {
    return {
      ...right,
      content: rightContent.length >= leftContent.length ? right.content : left.content,
      createdAt: right.createdAt || left.createdAt
    };
  }

  if (!isTransientAssistantMessage(left) && isTransientAssistantMessage(right)) {
    return {
      ...left,
      content: leftContent.length >= rightContent.length ? left.content : right.content,
      createdAt: right.createdAt || left.createdAt
    };
  }

  return rightContent.length >= leftContent.length ? right : left;
}

function isTransientAssistantMessage(message: ChatMessageRecord) {
  return STREAM_MESSAGE_PREFIXES.some(prefix => message.id.startsWith(prefix));
}
