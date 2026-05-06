import type { ChatMessageRecord, CodexChatMessage } from '../types/chat';
import { splitReasoning } from '../utils/parse-reasoning';

export type UiMessageStatus = 'local' | 'loading' | 'updating' | 'success' | 'error';

export interface UiMessage {
  id: string;
  message: CodexChatMessage;
  status: UiMessageStatus;
}

export function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function toUiMessage(record: ChatMessageRecord): UiMessage {
  const parts = splitReasoning(record.content ?? '');

  return {
    id: record.id,
    status: 'success',
    message: {
      role: record.role,
      content: parts.visibleContent,
      reasoning: parts.reasoning
    }
  };
}

export function readPayloadText(payload: Record<string, unknown>) {
  return (
    readString(payload.content) ??
    readString(payload.delta) ??
    readString(payload.text) ??
    readString(payload.message) ??
    readString(payload.finalResponse) ??
    ''
  );
}
