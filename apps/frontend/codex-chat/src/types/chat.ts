export type CodexRole = 'user' | 'assistant' | 'system';

export type CodexStepStatus = 'pending' | 'running' | 'completed' | 'blocked' | 'failed';

export interface CodexThoughtStep {
  id: string;
  title: string;
  description?: string;
  status: CodexStepStatus;
  agentLabel?: string;
  durationMs?: number;
}

export interface CodexSource {
  id: string;
  title: string;
  href?: string;
  description?: string;
}

export interface CodexChatMessage {
  role: CodexRole;
  content: string;
  reasoning?: string;
  steps?: CodexThoughtStep[];
  sources?: CodexSource[];
  approvalPending?: boolean;
  thinkingDurationMs?: number;
}

export interface CodexChatInput {
  message: string;
  messages?: Array<Pick<CodexChatMessage, 'role' | 'content'>>;
  modelId?: string;
  stream?: boolean;
  preferLlm?: boolean;
}

export interface DirectChatChunk {
  event?: string;
  data?: unknown;
  content?: string;
  stage?: string;
  payload?: Record<string, unknown>;
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  titleSource?: 'placeholder' | 'generated' | 'manual' | string;
  status:
    | 'idle'
    | 'running'
    | 'waiting_interrupt'
    | 'waiting_approval'
    | 'waiting_learning_confirmation'
    | 'cancelled'
    | 'completed'
    | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: CodexRole;
  content: string;
  createdAt: string;
}

export interface ChatModelOption {
  id: string;
  displayName: string;
  providerId: string;
}

export interface ChatEventRecord {
  id: string;
  sessionId: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
}
