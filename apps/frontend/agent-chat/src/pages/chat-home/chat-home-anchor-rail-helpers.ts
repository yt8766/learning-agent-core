import type { ChatMessageRecord } from '@/types/chat';
import { stripWorkflowCommandPrefix } from '@/features/chat/chat-message-adapter-helpers';

export type ConversationAnchorTone = 'user' | 'assistant' | 'approval' | 'evidence' | 'governance';

export interface ConversationAnchor {
  id: string;
  messageId: string;
  label: string;
  tone: ConversationAnchorTone;
}

const MAX_ANCHOR_LABEL_LENGTH = 38;

export function buildConversationAnchors(messages: ChatMessageRecord[]): ConversationAnchor[] {
  const anchors = messages
    .map(message => {
      const label = resolveAnchorLabel(message);
      if (!label) {
        return null;
      }

      return {
        id: getConversationAnchorId(message.id),
        messageId: message.id,
        label: truncateAnchorLabel(label),
        tone: resolveAnchorTone(message)
      } satisfies ConversationAnchor;
    })
    .filter((anchor): anchor is ConversationAnchor => Boolean(anchor));

  return anchors.length >= 2 ? anchors : [];
}

export function getConversationAnchorId(messageId: string) {
  return `chatx-message-anchor-${messageId}`;
}

export function scrollToConversationAnchor(anchor: ConversationAnchor, setActiveId: (anchorId: string) => void) {
  document.getElementById(anchor.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  setActiveId(anchor.id);
}

function resolveAnchorTone(message: ChatMessageRecord): ConversationAnchorTone {
  switch (message.card?.type) {
    case 'approval_request':
      return 'approval';
    case 'evidence_digest':
      return 'evidence';
    case 'plan_question':
    case 'control_notice':
    case 'compression_summary':
    case 'learning_summary':
    case 'skill_reuse':
    case 'worker_dispatch':
    case 'skill_suggestions':
    case 'runtime_issue':
      return 'governance';
    default:
      return message.role === 'user' ? 'user' : 'assistant';
  }
}

function resolveAnchorLabel(message: ChatMessageRecord) {
  const cardTitle = resolveCardTitle(message.card);
  if (cardTitle) {
    return cardTitle;
  }

  if (message.card?.type === 'approval_request') {
    return '审批请求';
  }

  if (message.card?.type === 'evidence_digest') {
    return 'Evidence digest';
  }

  const displayContent = message.role === 'user' ? stripWorkflowCommandPrefix(message.content) : message.content;
  const content = displayContent.replace(/\s+/g, ' ').trim();
  if (content) {
    return content;
  }

  if (message.role === 'user') {
    return '用户消息';
  }

  if (message.role === 'assistant') {
    return '助手回复';
  }

  return '';
}

function resolveCardTitle(card: ChatMessageRecord['card']) {
  if (!card || !('title' in card) || typeof card.title !== 'string') {
    return '';
  }

  return card.title.trim();
}

function truncateAnchorLabel(label: string) {
  const normalized = label.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_ANCHOR_LABEL_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_ANCHOR_LABEL_LENGTH - 3)}...`;
}
