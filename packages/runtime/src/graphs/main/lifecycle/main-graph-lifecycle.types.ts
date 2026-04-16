import {
  AgentExecutionState,
  AgentRole,
  CreateTaskDto,
  ExecutionTrace,
  LearningJob,
  LearningQueueItem,
  RequestedExecutionHints,
  SkillSearchStateRecord,
  SubgraphId,
  TaskRecord
} from '@agent/shared';
import { MemoryRepository, RuleRepository, RuntimeStateRepository, MemorySearchService } from '@agent/memory';

import { MainGraphBackgroundRuntime } from '../background/main-graph-background';
import { MainGraphLearningJobsRuntime } from '../background/main-graph-learning-jobs';
import { MainGraphTaskFactory } from '../task/main-graph-task-factory';
import { MainGraphTaskRuntime } from '../task/main-graph-task-runtime';
import type { PendingExecutionContext } from '../../../flows/approval';
import { LearningFlow } from '../../../flows/learning';
import { WorkerRegistry } from '../../../governance/worker-registry';

export type LocalSkillSuggestionResolver = (params: {
  goal: string;
  usedInstalledSkills?: string[];
  requestedHints?: RequestedExecutionHints;
  specialistDomain?: string;
}) => Promise<SkillSearchStateRecord>;

export type PreExecutionSkillInterventionResolver = (params: {
  goal: string;
  taskId: string;
  runId: string;
  sessionId?: string;
  skillSearch: SkillSearchStateRecord;
  usedInstalledSkills?: string[];
}) => Promise<
  | {
      skillSearch?: SkillSearchStateRecord;
      usedInstalledSkills?: string[];
      progressSummary?: string;
      traceSummary?: string;
      pendingApproval?: {
        toolName: string;
        reason?: string;
        preview?: Array<{
          label: string;
          value: string;
        }>;
      };
      pendingExecution?: {
        receiptId: string;
        skillDisplayName?: string;
      };
    }
  | undefined
>;

export type RuntimeSkillInterventionResolver = (params: {
  task: TaskRecord;
  goal: string;
  currentStep: 'direct_reply' | 'research';
  skillSearch: SkillSearchStateRecord;
  usedInstalledSkills?: string[];
}) => Promise<
  | {
      skillSearch?: SkillSearchStateRecord;
      usedInstalledSkills?: string[];
      progressSummary?: string;
      traceSummary?: string;
      pendingApproval?: {
        toolName: string;
        reason?: string;
        preview?: Array<{
          label: string;
          value: string;
        }>;
      };
      pendingExecution?: {
        receiptId: string;
        skillDisplayName?: string;
      };
    }
  | undefined
>;

export type SkillInstallApprovalResolver = (params: {
  task: TaskRecord;
  pending: PendingExecutionContext;
  actor?: string;
}) => Promise<
  | {
      skillSearch?: SkillSearchStateRecord;
      usedInstalledSkills?: string[];
      traceSummary?: string;
      progressSummary?: string;
    }
  | undefined
>;

export interface MainGraphLifecycleParams {
  tasks: Map<string, TaskRecord>;
  learningJobs: Map<string, LearningJob>;
  learningQueue: Map<string, LearningQueueItem>;
  pendingExecutions: Map<string, PendingExecutionContext>;
  runtimeStateRepository: RuntimeStateRepository;
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  ruleRepository: RuleRepository;
  workerRegistry: WorkerRegistry;
  taskFactory: MainGraphTaskFactory;
  runtime: MainGraphTaskRuntime;
  backgroundRuntime: MainGraphBackgroundRuntime;
  learningFlow: LearningFlow;
  learningJobsRuntime: MainGraphLearningJobsRuntime;
  getLocalSkillSuggestionResolver: () => LocalSkillSuggestionResolver | undefined;
  getPreExecutionSkillInterventionResolver: () => PreExecutionSkillInterventionResolver | undefined;
  getRuntimeSkillInterventionResolver: () => RuntimeSkillInterventionResolver | undefined;
  getSkillInstallApprovalResolver: () => SkillInstallApprovalResolver | undefined;
  emitTaskUpdate: (task: TaskRecord) => void;
  runTaskPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'retry' | 'approval_resume' | 'interrupt_resume';
      pending?: PendingExecutionContext;
      resume?: import('@agent/shared').ApprovalResumeInput;
    }
  ) => Promise<void>;
  runBootstrapGraph: (
    task: TaskRecord,
    dto: CreateTaskDto,
    options: {
      mode: 'initial' | 'interrupt_resume';
      resume?: import('@agent/shared').ApprovalResumeInput;
    }
  ) => Promise<void>;
  runApprovalRecoveryPipeline: (
    task: TaskRecord,
    dto: CreateTaskDto,
    pending: PendingExecutionContext
  ) => Promise<void>;
  addTrace: (trace: ExecutionTrace[], node: string, summary: string, data?: Record<string, unknown>) => void;
  addProgressDelta: (task: TaskRecord, content: string, from?: AgentRole) => void;
  markSubgraph: (task: TaskRecord, subgraphId: SubgraphId) => void;
  transitionQueueState: (task: TaskRecord, status: NonNullable<TaskRecord['queueState']>['status']) => void;
  setSubTaskStatus: (
    task: TaskRecord,
    role: AgentRole,
    status: 'pending' | 'running' | 'completed' | 'blocked'
  ) => void;
  upsertAgentState: (task: TaskRecord, nextState: AgentExecutionState) => void;
  getMinistryLabel: (ministry: string) => string;
}
