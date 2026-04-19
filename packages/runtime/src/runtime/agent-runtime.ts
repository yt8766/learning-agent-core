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
import { SkillRegistry } from '@agent/skill-runtime';
import {
  ApprovalService,
  ExecutionWatchdog,
  McpCapabilityRegistry,
  McpClientManager,
  McpServerRegistry,
  SandboxExecutor,
  StubSandboxExecutor,
  ToolRegistry,
  createDefaultToolRegistry
} from '@agent/tools';

import { AgentOrchestrator } from '../orchestration/agent-orchestrator';
import { XingbuClassifier } from './xingbu-classifier';
import { LocalKnowledgeSearchService } from './local-knowledge-search-service';
import { SessionCoordinator } from '../session/session-coordinator';
import {
  configureRuntimeAgentDependencies,
  type RuntimeAgentDependencies
} from '../contracts/runtime-agent-dependencies';

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
    const xingbuClassifier = new XingbuClassifier(this.llmProvider);
    this.approvalService = new ApprovalService(this.settings, {
      classifier: input => xingbuClassifier.classify(input as never)
    });
    this.mcpServerRegistry = new McpServerRegistry();
    this.mcpCapabilityRegistry = new McpCapabilityRegistry();
    this.registerMcpServers();
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

  private registerMcpServers(): void {
    this.mcpServerRegistry.register({
      id: 'local-workspace',
      displayName: '本地工作区 MCP 兼容适配器',
      transport: 'local-adapter',
      enabled: true,
      source: 'workspace',
      trustClass: 'internal',
      dataScope: 'workspace files and local runtime data',
      writeScope: 'local workspace actions',
      installationMode: 'builtin',
      allowedProfiles: ['platform', 'company', 'personal', 'cli']
    });

    if (this.settings.mcp.bigmodelApiKey) {
      const authHeaders = {
        Authorization: `Bearer ${this.settings.mcp.bigmodelApiKey}`
      };
      this.mcpServerRegistry.register({
        id: 'bigmodel-web-search',
        displayName: 'BigModel Web Search MCP',
        transport: 'http',
        endpoint: this.settings.mcp.webSearchEndpoint,
        headers: authHeaders,
        enabled: true,
        source: 'bigmodel-official',
        trustClass: 'official',
        dataScope: 'open web search results',
        writeScope: 'none',
        installationMode: 'builtin',
        allowedProfiles: ['platform', 'company', 'personal', 'cli']
      });
      this.mcpServerRegistry.register({
        id: 'bigmodel-web-reader',
        displayName: 'BigModel Web Reader MCP',
        transport: 'http',
        endpoint: this.settings.mcp.webReaderEndpoint,
        headers: authHeaders,
        enabled: true,
        source: 'bigmodel-official',
        trustClass: 'official',
        dataScope: 'open web document content',
        writeScope: 'none',
        installationMode: 'builtin',
        allowedProfiles: ['platform', 'company', 'personal', 'cli']
      });
      this.mcpServerRegistry.register({
        id: 'bigmodel-zread',
        displayName: 'BigModel ZRead MCP',
        transport: 'http',
        endpoint: this.settings.mcp.zreadEndpoint,
        headers: authHeaders,
        enabled: true,
        source: 'bigmodel-official',
        trustClass: 'official',
        dataScope: 'repository and document retrieval',
        writeScope: 'none',
        installationMode: 'builtin',
        allowedProfiles: ['platform', 'company', 'personal', 'cli']
      });
      this.mcpServerRegistry.register({
        id: 'bigmodel-vision',
        displayName: 'BigModel Vision MCP',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@z_ai/mcp-server@latest'],
        env: {
          Z_AI_API_KEY: this.settings.mcp.bigmodelApiKey,
          Z_AI_MODE: this.settings.mcp.visionMode
        },
        enabled: true,
        source: 'bigmodel-official',
        trustClass: 'official',
        dataScope: 'images and UI snapshots',
        writeScope: 'artifact generation only',
        installationMode: 'configured',
        allowedProfiles: ['platform', 'company', 'personal', 'cli']
      });
      this.mcpCapabilityRegistry.register({
        id: 'webSearchPrime',
        toolName: 'webSearchPrime',
        serverId: 'bigmodel-web-search',
        displayName: 'Web Search Prime',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge',
        dataScope: 'open web search results',
        writeScope: 'none'
      });
      this.mcpCapabilityRegistry.register({
        id: 'webReader',
        toolName: 'webReader',
        serverId: 'bigmodel-web-reader',
        displayName: 'Web Reader',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge',
        dataScope: 'web page content',
        writeScope: 'none'
      });
      this.mcpCapabilityRegistry.register({
        id: 'search_doc',
        toolName: 'search_doc',
        serverId: 'bigmodel-zread',
        displayName: 'ZRead Search Doc',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge',
        dataScope: 'remote docs and repositories',
        writeScope: 'none'
      });
      this.mcpCapabilityRegistry.register({
        id: 'get_repo_structure',
        toolName: 'get_repo_structure',
        serverId: 'bigmodel-zread',
        displayName: 'ZRead Repo Structure',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge',
        dataScope: 'repository structure metadata',
        writeScope: 'none'
      });
      this.mcpCapabilityRegistry.register({
        id: 'read_file',
        toolName: 'read_file',
        serverId: 'bigmodel-zread',
        displayName: 'ZRead Read File',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge',
        dataScope: 'repository file content',
        writeScope: 'none'
      });
      this.mcpCapabilityRegistry.register({
        id: 'ui_to_artifact',
        toolName: 'ui_to_artifact',
        serverId: 'bigmodel-vision',
        displayName: 'Vision UI To Artifact',
        riskLevel: 'medium',
        requiresApproval: false,
        category: 'knowledge',
        dataScope: 'uploaded UI screenshots',
        writeScope: 'artifact generation'
      });
      this.mcpCapabilityRegistry.register({
        id: 'image_analysis',
        toolName: 'image_analysis',
        serverId: 'bigmodel-vision',
        displayName: 'Vision Image Analysis',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge',
        dataScope: 'uploaded images',
        writeScope: 'none'
      });
      this.mcpCapabilityRegistry.register({
        id: 'ui_diff_check',
        toolName: 'ui_diff_check',
        serverId: 'bigmodel-vision',
        displayName: 'Vision UI Diff Check',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge',
        dataScope: 'UI snapshots and diffs',
        writeScope: 'none'
      });
    }

    if (this.settings.mcp.researchHttpEndpoint) {
      this.mcpServerRegistry.register({
        id: 'remote-research',
        displayName: 'Remote Research MCP',
        transport: 'http',
        endpoint: this.settings.mcp.researchHttpEndpoint,
        headers: this.settings.mcp.researchHttpApiKey
          ? { Authorization: `Bearer ${this.settings.mcp.researchHttpApiKey}` }
          : undefined,
        enabled: true,
        source: 'workspace-configured',
        trustClass: 'curated',
        dataScope: 'controlled research summaries',
        writeScope: 'none',
        installationMode: 'configured',
        allowedProfiles: ['platform', 'company', 'personal', 'cli']
      });
      this.mcpCapabilityRegistry.register({
        id: 'collect_research_source',
        toolName: 'collect_research_source',
        serverId: 'remote-research',
        displayName: 'Collect research source',
        riskLevel: 'low',
        requiresApproval: false,
        category: 'knowledge',
        dataScope: 'research source summaries',
        writeScope: 'none'
      });
    }

    this.mcpServerRegistry.register({
      id: 'github-mcp-template',
      displayName: 'GitHub MCP Template',
      transport: 'stdio',
      enabled: false,
      source: 'github-official-template',
      trustClass: 'official',
      dataScope: 'repos, issues, pull requests, workflows',
      writeScope: 'repository operations after approval',
      installationMode: 'configured',
      allowedProfiles: ['platform', 'company', 'personal', 'cli']
    });
    this.mcpServerRegistry.register({
      id: 'browser-mcp-template',
      displayName: 'Browser MCP Template',
      transport: 'http',
      enabled: false,
      source: 'browserbase-playwright-template',
      trustClass: 'official',
      dataScope: 'browser sessions, screenshots, extracted DOM data',
      writeScope: 'browser actions after approval',
      installationMode: 'configured',
      allowedProfiles: ['platform', 'company', 'personal', 'cli']
    });
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
