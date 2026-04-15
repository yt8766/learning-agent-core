import {
  AgentExecutionState,
  BudgetState,
  ContextFilterRecord,
  type ExecutionMode,
  EvidenceRecord,
  SkillStep,
  WorkerDefinition,
  WorkflowPresetDefinition
} from '@agent/shared';
import { ContextStrategy } from '@agent/config';
import { MemoryRepository, RuleRepository, RuntimeStateRepository, MemorySearchService } from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import { ApprovalService, McpClientManager, ToolRegistry, SandboxExecutor } from '@agent/tools';

import { AgentModelRole, LlmProvider, LlmUsageMetadata } from '../adapters/llm/llm-provider';

export interface AgentRuntimeContext {
  taskId: string;
  goal: string;
  taskContext?: string;
  budgetState?: BudgetState;
  externalSources?: EvidenceRecord[];
  flow: 'chat' | 'approval' | 'learning';
  executionMode?: ExecutionMode;
  contextStrategy?: ContextStrategy;
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  knowledgeSearchService?: {
    search(
      query: string,
      limit?: number
    ): Promise<
      Array<{
        chunkId: string;
        documentId: string;
        sourceId: string;
        uri: string;
        title: string;
        sourceType: string;
        content: string;
        score: number;
      }>
    >;
  };
  ruleRepository?: RuleRepository;
  runtimeStateRepository?: RuntimeStateRepository;
  skillRegistry: SkillRegistry;
  approvalService: ApprovalService;
  toolRegistry: ToolRegistry;
  workflowPreset?: WorkflowPresetDefinition;
  currentWorker?: WorkerDefinition;
  compiledSkill?: {
    id: string;
    name: string;
    description?: string;
    steps: SkillStep[];
    constraints?: string[];
    successSignals?: string[];
    requiredTools?: string[];
    requiredConnectors?: string[];
    approvalSensitiveTools?: string[];
  };
  mcpClientManager?: McpClientManager;
  sandbox: SandboxExecutor;
  llm: LlmProvider;
  thinking: {
    manager: boolean;
    research: boolean;
    executor: boolean;
    reviewer: boolean;
  };
  onToken?: (payload: { token: string; role: AgentModelRole; messageId: string; model?: string }) => void;
  onUsage?: (payload: { usage: LlmUsageMetadata; role: AgentModelRole }) => void;
  onModelEvent?: (payload: {
    role: AgentModelRole;
    modelUsed?: string;
    isFallback?: boolean;
    fallbackReason?: string;
    status: 'fallback' | 'failed';
  }) => void;
  isTaskCancelled?: () => boolean;
  onContextCompaction?: (payload: {
    trigger: string;
    result: Pick<
      NonNullable<ContextFilterRecord['filteredContextSlice']>,
      | 'summary'
      | 'compressionApplied'
      | 'compressionSource'
      | 'compressedMessageCount'
      | 'artifactCount'
      | 'originalCharacterCount'
      | 'compactedCharacterCount'
      | 'reactiveRetryCount'
      | 'pipelineAudit'
    >;
  }) => void | Promise<void>;
}

export interface AgentLike {
  getState(): AgentExecutionState;
}
