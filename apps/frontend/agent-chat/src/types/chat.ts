export type ChatSessionStatus =
  | 'idle'
  | 'running'
  | 'waiting_approval'
  | 'waiting_learning_confirmation'
  | 'cancelled'
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
  card?:
    | {
        type: 'approval_request';
        intent: string;
        toolName?: string;
        reason?: string;
        riskLevel?: string;
        requestedBy?: string;
      }
    | {
        type: 'run_cancelled';
        reason?: string;
      };
  createdAt: string;
}

export interface ChatEventRecord {
  id: string;
  sessionId: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
}

export interface ChatThoughtChainItem {
  key: string;
  title: string;
  description?: string;
  content?: string;
  footer?: string;
  status?: 'loading' | 'success' | 'error' | 'abort';
  collapsible?: boolean;
  blink?: boolean;
}

export interface ChatThinkState {
  title: string;
  content: string;
  loading?: boolean;
  blink?: boolean;
}

export interface ChatCheckpointRecord {
  sessionId: string;
  taskId: string;
  runId?: string;
  skillId?: string;
  skillStage?: string;
  resolvedWorkflow?: {
    id: string;
    displayName: string;
    command?: string;
    requiredMinistries: string[];
    allowedCapabilities: string[];
    approvalPolicy: string;
    outputContract: {
      type: string;
      requiredSections: string[];
    };
  };
  currentNode?: string;
  currentMinistry?: string;
  currentWorker?: string;
  pendingAction?: {
    toolName: string;
    intent: string;
    riskLevel?: string;
    requestedBy: string;
  };
  pendingApproval?: {
    toolName: string;
    intent: string;
    riskLevel?: string;
    requestedBy: string;
    reason?: string;
    feedback?: string;
  };
  approvalFeedback?: string;
  modelRoute?: Array<{
    ministry: string;
    workerId: string;
    defaultModel: string;
    selectedModel: string;
    reason: string;
  }>;
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
  thoughtChain?: ChatThoughtChainItem[];
  thinkState?: ChatThinkState;
  createdAt: string;
  updatedAt: string;
}
