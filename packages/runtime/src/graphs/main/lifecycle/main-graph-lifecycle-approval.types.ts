import type {
  AgentRole,
  ApprovalResumeInput,
  CreateTaskDto,
  ExecutionTrace,
  SkillSearchStateRecord,
  TaskRecord
} from '@agent/shared';
import type { PendingExecutionContext } from '../../../flows/approval';

export type LifecycleApprovalParams = {
  tasks: Map<string, TaskRecord>;
  pendingExecutions: Map<string, PendingExecutionContext>;
  runTaskPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'retry' | 'approval_resume' | 'interrupt_resume';
      pending?: PendingExecutionContext;
      resume?: ApprovalResumeInput;
    }
  ) => Promise<void>;
  runBootstrapGraph: (
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'interrupt_resume';
      resume?: ApprovalResumeInput;
    }
  ) => Promise<void>;
  runApprovalRecoveryPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    pending: PendingExecutionContext
  ) => Promise<void>;
  addTrace: (trace: ExecutionTrace[], node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  transitionQueueState: (task: TaskRecord, status: NonNullable<TaskRecord['queueState']>['status']) => void;
  setSubTaskStatus: (
    task: TaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  getSkillInstallApprovalResolver: () =>
    | ((params: { task: TaskRecord; pending: PendingExecutionContext; actor?: string }) => Promise<
        | {
            skillSearch?: SkillSearchStateRecord;
            usedInstalledSkills?: string[];
            traceSummary?: string;
            progressSummary?: string;
          }
        | undefined
      >)
    | undefined;
  runtime: {
    attachTool: (
      task: TaskRecord,
      params: {
        toolName: string;
        attachedBy: 'user';
        preferred?: boolean;
        reason?: string;
        ownerType?: 'user-attached';
        ownerId?: string;
      }
    ) => void;
    recordToolUsage: (
      task: TaskRecord,
      params: {
        toolName: string;
        status: 'blocked' | 'approved';
        requestedBy?: string;
        reason?: string;
        blockedReason?: string;
        serverId?: string;
        capabilityId?: string;
        approvalRequired?: boolean;
        riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      }
    ) => void;
  };
};

export type LifecyclePersistCallbacks = {
  persistAndEmitTask: (task: TaskRecord) => Promise<void>;
};
