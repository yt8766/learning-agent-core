export interface ChatEventRecord {
  id: string;
  sessionId: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface ChatThoughtChainItem {
  key: string;
  messageId?: string;
  thinkingDurationMs?: number;
  title: string;
  description?: string;
  content?: string;
  footer?: string;
  status?: 'loading' | 'success' | 'error' | 'abort';
  collapsible?: boolean;
  blink?: boolean;
}

export interface ChatThinkState {
  messageId?: string;
  thinkingDurationMs?: number;
  title: string;
  content: string;
  loading?: boolean;
  blink?: boolean;
}
