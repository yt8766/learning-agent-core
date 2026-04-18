import type { ApprovalResumeInput, CreateTaskDto, RequestedExecutionHints, SkillSearchStateRecord } from '@agent/core';
import type { loadSettings } from '@agent/config';
import type { MemoryRepository, MemorySearchService, RuleRepository, RuntimeStateRepository } from '@agent/memory';
import type { SkillRegistry } from '@agent/skill-runtime';
import type { ApprovalService, McpClientManager, SandboxExecutor, ToolRegistry } from '@agent/tools';
import type { LocalKnowledgeSearchService } from '../../../runtime/local-knowledge-search-service';
import type { RuntimeTaskRecord as TaskRecord } from '../../../runtime/runtime-task.types';
import type { WorkerRegistry } from '../../../governance/worker-registry';
import type { LlmProvider } from '@agent/adapters';
import type { PendingExecutionContext } from '../../../flows/approval';

export interface AgentRuntimeSettings {
  zhipuModels: {
    manager: string;
    research: string;
    executor: string;
    reviewer: string;
  };
  zhipuThinking: {
    manager: boolean;
    research: boolean;
    executor: boolean;
    reviewer: boolean;
  };
}

export interface AgentOrchestratorDependencies {
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  knowledgeSearchService?: LocalKnowledgeSearchService;
  skillRegistry: SkillRegistry;
  approvalService: ApprovalService;
  runtimeStateRepository: RuntimeStateRepository;
  llmProvider: LlmProvider;
  ruleRepository: RuleRepository;
  sandboxExecutor: SandboxExecutor;
  toolRegistry?: ToolRegistry;
  workerRegistry?: WorkerRegistry;
  mcpClientManager?: McpClientManager;
  settings?: ReturnType<typeof loadSettings> & AgentRuntimeSettings;
}

export type LocalSkillSuggestionResolver = (params: {
  goal: string;
  usedInstalledSkills?: string[];
  requestedHints?: RequestedExecutionHints;
  specialistDomain?: string;
}) => Promise<SkillSearchStateRecord>;

export type SkillInterventionResult =
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
  | undefined;

export type PreExecutionSkillInterventionResolver = (params: {
  goal: string;
  taskId: string;
  runId: string;
  sessionId?: string;
  skillSearch: SkillSearchStateRecord;
  usedInstalledSkills?: string[];
}) => Promise<SkillInterventionResult>;

export type RuntimeSkillInterventionResolver = (params: {
  task: TaskRecord;
  goal: string;
  currentStep: 'direct_reply' | 'research';
  skillSearch: SkillSearchStateRecord;
  usedInstalledSkills?: string[];
}) => Promise<SkillInterventionResult>;

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

export interface TaskPipelineRunOptions {
  mode: 'initial' | 'retry' | 'approval_resume' | 'interrupt_resume';
  pending?: PendingExecutionContext;
  resume?: ApprovalResumeInput;
}

export interface BootstrapRunOptions {
  mode: 'initial' | 'interrupt_resume';
  resume?: ApprovalResumeInput;
}
