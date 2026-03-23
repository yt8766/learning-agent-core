export interface TaskApprovalRecord {
  intent: string;
  decision: string;
  reason?: string;
}

export interface TaskRecord {
  id: string;
  goal: string;
  status: string;
  currentStep?: string;
  retryCount?: number;
  maxRetries?: number;
  result?: string;
  updatedAt?: string;
  approvals: TaskApprovalRecord[];
}

export interface TaskPlan {
  id: string;
  summary: string;
  steps: string[];
  subTasks: Array<{ id: string; title: string; description: string; assignedTo: string; status: string }>;
}

export interface AgentStateRecord {
  agentId: string;
  role: string;
  goal: string;
  subTask?: string;
  plan: string[];
  toolCalls: string[];
  observations: string[];
  shortTermMemory: string[];
  status: string;
  finalOutput?: string;
}

export interface AgentMessageRecord {
  id: string;
  from: string;
  to: string;
  type: string;
  content: string;
  createdAt: string;
}

export interface ReviewRecord {
  taskId: string;
  decision: string;
  notes: string[];
}

export interface TraceRecord {
  node: string;
  at: string;
  summary: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  status: string;
  description: string;
}

export interface RuleRecord {
  id: string;
  name: string;
  summary: string;
  action: string;
}

export interface ApprovalCenterItem {
  taskId: string;
  goal: string;
  status: string;
  intent: string;
  reason?: string;
}

export interface TaskBundle {
  task: TaskRecord;
  plan?: TaskPlan;
  agents: AgentStateRecord[];
  messages: AgentMessageRecord[];
  review?: ReviewRecord;
  traces: TraceRecord[];
}
