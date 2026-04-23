import { loadSettings } from '@agent/config';
import type { MemoryRepository, MemorySearchService, RuleRepository, RuntimeStateRepository } from '@agent/memory';
import type { SkillRegistry } from '@agent/skill-runtime';
import type { ApprovalService, McpClientManager, SandboxExecutor } from '@agent/tools';
import type { LocalKnowledgeSearchService } from '../../../../runtime/local-knowledge-search-service';

export interface MainGraphTaskContextDependencies {
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  knowledgeSearchService?: LocalKnowledgeSearchService;
  ruleRepository: RuleRepository;
  runtimeStateRepository: RuntimeStateRepository;
  skillRegistry: SkillRegistry;
  approvalService: ApprovalService;
  sandboxExecutor: SandboxExecutor;
  mcpClientManager?: McpClientManager;
}

export type RuntimeSettings = ReturnType<typeof loadSettings> & {
  zhipuThinking: {
    manager: boolean;
    research: boolean;
    executor: boolean;
    reviewer: boolean;
  };
};
