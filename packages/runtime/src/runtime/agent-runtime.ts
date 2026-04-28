import { loadSettings, LoadSettingsOptions, RuntimeProfile, RuntimeSettings } from '@agent/config';
import { createRuntimeEmbeddingProvider } from '@agent/adapters';
import type { ILLMProvider } from '@agent/core';
import {
  FileMemoryRepository,
  FileRuleRepository,
  FileRuntimeStateRepository,
  FileSemanticCacheRepository,
  DefaultMemorySearchService,
  LocalVectorIndexRepository
} from '@agent/memory';
import { SkillRegistry } from '@agent/skill';
import {
  McpCapabilityRegistry,
  McpClientManager,
  McpServerRegistry,
  ToolRegistry,
  createDefaultToolRegistry
} from '@agent/tools';
import { ApprovalService, type ApprovalClassifier } from '../governance/approval';
import { type SandboxExecutor, StubSandboxExecutor } from '../sandbox';
import { ExecutionWatchdog } from '../watchdog';

import { AgentOrchestrator } from '../orchestration/agent-orchestrator';
import { LocalKnowledgeSearchService } from './local-knowledge-search-service';
import { SessionCoordinator } from '../session/session-coordinator';
import {
  configureRuntimeAgentDependencies,
  type RuntimeAgentDependencies
} from '../contracts/runtime-agent-dependencies';
import { registerBuiltinMcpServers } from './agent-runtime-mcp-configuration';

export interface AgentRuntimeOptions {
  settings?: RuntimeSettings;
  settingsOptions?: LoadSettingsOptions;
  profile?: RuntimeProfile;
  llmProvider?: ILLMProvider;
  createLlmProvider?: (input: {
    settings: RuntimeSettings;
    semanticCacheRepository: FileSemanticCacheRepository;
  }) => ILLMProvider;
  sandboxExecutor?: SandboxExecutor;
  agentDependencies?: RuntimeAgentDependencies;
  /** 直接注入已实例化的治理风险分类器。 */
  approvalClassifier?: ApprovalClassifier;
  /**
   * 工厂方法：在 LlmProvider 初始化完成后被调用，返回 ApprovalClassifier。
   * 优先级低于 approvalClassifier。未注入时 ApprovalService 仅使用静态规则。
   * 默认实现（XingbuClassifier）由 platform-runtime 通过此工厂注入。
   */
  createApprovalClassifier?: (llm: ILLMProvider) => ApprovalClassifier;
}

export class AgentRuntime {
  readonly settings: RuntimeSettings;
  readonly memoryRepository;
  readonly ruleRepository;
  readonly memorySearchService;
  readonly vectorIndexRepository;
  readonly knowledgeSearchService;
  readonly skillRegistry;
  readonly approvalService;
  readonly runtimeStateRepository;
  readonly semanticCacheRepository;
  readonly toolRegistry: ToolRegistry;
  readonly sandboxExecutor: SandboxExecutor;
  readonly mcpServerRegistry: McpServerRegistry;
  readonly mcpCapabilityRegistry: McpCapabilityRegistry;
  readonly mcpClientManager: McpClientManager;
  readonly llmProvider: ILLMProvider;
  readonly orchestrator: AgentOrchestrator;
  readonly sessionCoordinator: SessionCoordinator;

  constructor(options: AgentRuntimeOptions = {}) {
    const agentDependencies = options.agentDependencies ?? failMissingAgentDependencies();
    configureRuntimeAgentDependencies(agentDependencies);
    this.settings =
      options.settings ??
      loadSettings({
        ...(options.settingsOptions ?? {}),
        profile: options.profile ?? options.settingsOptions?.profile
      });
    this.memoryRepository = new FileMemoryRepository(this.settings.memoryFilePath);
    this.ruleRepository = new FileRuleRepository(this.settings.rulesFilePath);
    const embeddingProvider = createRuntimeEmbeddingProvider(this.settings);
    this.vectorIndexRepository = new LocalVectorIndexRepository(
      this.memoryRepository,
      this.ruleRepository,
      embeddingProvider,
      {
        filePath: this.settings.vectorIndexFilePath,
        knowledgeRoot: this.settings.knowledgeRoot
      }
    );
    this.memoryRepository.setVectorIndexRepository?.(this.vectorIndexRepository);
    this.ruleRepository.setVectorIndexRepository?.(this.vectorIndexRepository);
    this.memorySearchService = new DefaultMemorySearchService(
      this.memoryRepository,
      this.ruleRepository,
      this.vectorIndexRepository
    );
    this.knowledgeSearchService = new LocalKnowledgeSearchService(this.settings, this.vectorIndexRepository);
    this.skillRegistry = new SkillRegistry(this.settings.skillsRoot);
    this.runtimeStateRepository = new FileRuntimeStateRepository(this.settings.tasksStateFilePath);
    this.semanticCacheRepository = new FileSemanticCacheRepository(this.settings.semanticCacheFilePath);
    this.toolRegistry = createDefaultToolRegistry();
    this.sandboxExecutor = options.sandboxExecutor ?? new StubSandboxExecutor();
    this.llmProvider =
      options.llmProvider ??
      options.createLlmProvider?.({
        settings: this.settings,
        semanticCacheRepository: this.semanticCacheRepository
      }) ??
      failMissingLlmProvider();
    const approvalClassifier = options.approvalClassifier ?? options.createApprovalClassifier?.(this.llmProvider);
    this.approvalService = new ApprovalService(this.settings, {
      classifier: approvalClassifier
    });
    this.mcpServerRegistry = new McpServerRegistry();
    this.mcpCapabilityRegistry = new McpCapabilityRegistry();
    registerBuiltinMcpServers({
      settings: this.settings,
      mcpServerRegistry: this.mcpServerRegistry,
      mcpCapabilityRegistry: this.mcpCapabilityRegistry
    });
    this.mcpCapabilityRegistry.registerFromTools('local-workspace', this.toolRegistry.list());
    this.mcpClientManager = new McpClientManager(
      this.mcpServerRegistry,
      this.mcpCapabilityRegistry,
      this.sandboxExecutor,
      {
        stdioMaxSessions: this.settings.mcp.stdioSessionMaxCount,
        watchdog: new ExecutionWatchdog()
      }
    );
    this.orchestrator = new AgentOrchestrator({
      memoryRepository: this.memoryRepository,
      memorySearchService: this.memorySearchService,
      knowledgeSearchService: this.knowledgeSearchService,
      skillRegistry: this.skillRegistry,
      approvalService: this.approvalService,
      runtimeStateRepository: this.runtimeStateRepository,
      llmProvider: this.llmProvider,
      ruleRepository: this.ruleRepository,
      sandboxExecutor: this.sandboxExecutor,
      toolRegistry: this.toolRegistry,
      mcpClientManager: this.mcpClientManager,
      settings: this.settings,
      agentDependencies
    });
    this.sessionCoordinator = new SessionCoordinator(
      this.orchestrator,
      this.runtimeStateRepository,
      this.llmProvider,
      this.settings.contextStrategy,
      this.memorySearchService
    );
  }

  async start(): Promise<void> {
    await this.sessionCoordinator.initialize();
  }

  async stop(): Promise<void> {
    const servers = this.mcpServerRegistry.list();
    await Promise.all(servers.map(server => this.mcpClientManager.closeServerSession(server.id).catch(() => false)));
  }
}

function failMissingAgentDependencies(): never {
  throw new Error(
    'AgentRuntime requires agentDependencies to be supplied by the composition root. Use @agent/platform-runtime or pass agentDependencies explicitly.'
  );
}

function failMissingLlmProvider(): never {
  throw new Error('AgentRuntime requires llmProvider or createLlmProvider to be supplied by the host application.');
}
