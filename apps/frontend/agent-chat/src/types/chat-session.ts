export type ChatSessionStatus =
  | 'idle'
  | 'running'
  | 'waiting_interrupt'
  | 'waiting_approval'
  | 'waiting_learning_confirmation'
  | 'cancelled'
  | 'completed'
  | 'failed';

export interface ApprovalRecord {
  intent: string;
  decision: string;
  toolName?: string;
  reason?: string;
  reasonCode?: string;
  riskLevel?: string;
  requestedBy?: string;
  serverId?: string;
  capabilityId?: string;
  interruptId?: string;
  interruptSource?: 'graph' | 'tool';
  interruptMode?: 'blocking' | 'non-blocking';
  resumeStrategy?: 'command' | 'approval-recovery';
  preview?: Array<{
    label: string;
    value: string;
  }>;
}

export interface AgentStateRecord {
  role: string;
  status: string;
  subTask?: string;
  finalOutput?: string;
  observations?: string[];
}

export type MainChainNode =
  | 'entry_router'
  | 'mode_gate'
  | 'dispatch_planner'
  | 'context_filter'
  | 'result_aggregator'
  | 'interrupt_controller'
  | 'learning_recorder';

export interface ChatSessionRecord {
  id: string;
  title: string;
  status: ChatSessionStatus;
  currentTaskId?: string;
  compression?: {
    summary: string;
    periodOrTopic?: string;
    focuses?: string[];
    keyDeliverables?: string[];
    risks?: string[];
    nextActions?: string[];
    supportingFacts?: string[];
    decisionSummary?: string;
    confirmedPreferences?: string[];
    openLoops?: string[];
    condensedMessageCount: number;
    condensedCharacterCount: number;
    totalCharacterCount: number;
    previewMessages?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
    trigger: 'message_count' | 'character_count';
    source: 'heuristic' | 'llm';
    summaryLength?: number;
    heuristicFallback?: boolean;
    effectiveThreshold?: number;
    compressionProfile?: 'default' | 'long-flow' | 'light-chat';
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}
