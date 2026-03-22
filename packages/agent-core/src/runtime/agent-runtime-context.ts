import { MemoryRepository } from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import { ApprovalService, StubSandboxExecutor, ToolRegistry } from '@agent/tools';

import { AgentExecutionState } from '@agent/shared';

import { AgentModelRole, LlmProvider } from '../adapters/llm/llm-provider';

export interface AgentRuntimeContext {
  taskId: string;
  goal: string;
  memoryRepository: MemoryRepository;
  skillRegistry: SkillRegistry;
  approvalService: ApprovalService;
  toolRegistry: ToolRegistry;
  sandbox: StubSandboxExecutor;
  llm: LlmProvider;
  thinking: {
    manager: boolean;
    research: boolean;
    executor: boolean;
    reviewer: boolean;
  };
  onToken?: (payload: { token: string; role: AgentModelRole; messageId: string; model?: string }) => void;
}

export interface AgentLike {
  getState(): AgentExecutionState;
}
