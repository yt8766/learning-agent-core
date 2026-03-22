export type ChatSessionStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'waiting_learning_confirmation'
  | 'completed'
  | 'failed';

export interface ApprovalRecord {
  intent: string;
  decision: string;
  reason?: string;
}

export interface AgentStateRecord {
  role: string;
  status: string;
  subTask?: string;
  finalOutput?: string;
}

export interface ChatSessionRecord {
  id: string;
  title: string;
  status: ChatSessionStatus;
  currentTaskId?: string;
  compression?: {
    summary: string;
    condensedMessageCount: number;
    condensedCharacterCount: number;
    totalCharacterCount: number;
    trigger: 'message_count' | 'character_count';
    source: 'heuristic' | 'llm';
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  linkedAgent?: string;
  createdAt: string;
}

export interface ChatEventRecord {
  id: string;
  sessionId: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface ChatCheckpointRecord {
  sessionId: string;
  taskId: string;
  traceCursor: number;
  messageCursor: number;
  approvalCursor: number;
  learningCursor: number;
  graphState: {
    status: string;
    currentStep?: string;
    retryCount?: number;
    maxRetries?: number;
  };
  pendingApprovals: ApprovalRecord[];
  agentStates: AgentStateRecord[];
  createdAt: string;
  updatedAt: string;
}
