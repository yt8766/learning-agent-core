import { WorkerDefinition } from '@agent/core';
import { ContextStrategy } from '@agent/config';
import type {
  AgentExecutionState,
  ContextFilterRecord,
  ExecutionMode,
  ILLMProvider,
  LlmProviderAgentRole as AgentModelRole,
  SkillStep,
  SpecialistDomain,
  WorkflowPresetDefinition
} from '@agent/core';
import type { BudgetState } from '@agent/core';
import type { EvidenceRecord } from '@agent/memory';
import { MemoryRepository, RuleRepository, RuntimeStateRepository, MemorySearchService } from '@agent/memory';
import { SkillRegistry } from '@agent/skill';
import { McpClientManager, ToolRegistry } from '@agent/tools';

import type { LlmUsageMetadata } from '@agent/adapters';
import type { ApprovalService } from '../governance/approval';
import type { SandboxExecutor } from '../sandbox';

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
  specialistLead?: {
    id: SpecialistDomain;
    displayName: string;
    domain: SpecialistDomain;
    reason?: string;
    requiredCapabilities?: string[];
    agentId?: string;
    candidateAgentIds?: string[];
  };
  supportingSpecialists?: Array<{
    id: SpecialistDomain;
    displayName: string;
    domain: SpecialistDomain;
    reason?: string;
    requiredCapabilities?: string[];
    agentId?: string;
    candidateAgentIds?: string[];
  }>;
  routeConfidence?: number;
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
  llm: ILLMProvider;
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
