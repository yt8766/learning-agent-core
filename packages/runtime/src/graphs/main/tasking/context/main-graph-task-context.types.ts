import { loadSettings } from '@agent/config';
import type { MemoryRepository, MemorySearchService, RuleRepository, RuntimeStateRepository } from '@agent/memory';
import type { SkillRegistry } from '@agent/skill';
import type { McpClientManager } from '@agent/tools';
import type { ApprovalService } from '../../../../governance/approval';
import type { RuntimeKnowledgeSearchService } from '../../../../runtime/local-knowledge-search-service';
import type { SandboxExecutor } from '../../../../sandbox';

export interface MainGraphTaskContextDependencies {
  memoryRepository: MemoryRepository;
  memorySearchService?: MemorySearchService;
  knowledgeSearchService?: RuntimeKnowledgeSearchService;
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
