import { AgentExecutionState, WorkflowPresetDefinition } from '@agent/shared';
import { MemoryRepository, RuleRepository, RuntimeStateRepository } from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import { ApprovalService, McpClientManager, SandboxExecutor, ToolRegistry } from '@agent/tools';

import { AgentModelRole, LlmProvider, LlmUsageMetadata } from '../adapters/llm/llm-provider';

export interface AgentRuntimeContext {
  taskId: string;
  goal: string;
  flow: 'chat' | 'approval' | 'learning';
  memoryRepository: MemoryRepository;
  ruleRepository?: RuleRepository;
  runtimeStateRepository?: RuntimeStateRepository;
  skillRegistry: SkillRegistry;
  approvalService: ApprovalService;
  toolRegistry: ToolRegistry;
  workflowPreset?: WorkflowPresetDefinition;
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
}

export interface AgentLike {
  getState(): AgentExecutionState;
}
