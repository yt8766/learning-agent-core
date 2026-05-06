export interface ChatEventRecord {
  id: string;
  sessionId: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface ChatThoughtChainWebSearch {
  query: string;
  resultCount?: number;
  topHosts?: string[];
  hitIds?: string[];
}

export interface ChatThoughtChainItem {
  key: string;
  messageId?: string;
  thinkingDurationMs?: number;
  kind?: 'reasoning' | 'web_search' | 'browser';
  title: string;
  description?: string;
  content?: string;
  footer?: string;
  status?: 'loading' | 'success' | 'error' | 'abort';
  collapsible?: boolean;
  blink?: boolean;
  webSearch?: ChatThoughtChainWebSearch;
}

export interface ChatThinkState {
  messageId?: string;
  thinkingDurationMs?: number;
  title: string;
  content: string;
  loading?: boolean;
  blink?: boolean;
}
