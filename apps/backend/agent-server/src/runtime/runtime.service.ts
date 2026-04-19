import { Injectable, OnModuleInit } from '@nestjs/common';
import { describeConnectorProfilePolicy } from '@agent/runtime';
import { AppLoggerService } from '../logger/app-logger.service';
import { syncEnabledRemoteSkillSources } from './skills/runtime-skill-sources.service';
import { RuntimeHost } from './core/runtime.host';
import { RuntimeCentersService } from './centers/runtime-centers.service';
import { RuntimeBootstrapService } from './services/runtime-bootstrap.service';
import { RuntimeKnowledgeService } from './services/runtime-knowledge.service';
import { RuntimeOperationalStateService } from './services/runtime-operational-state.service';
import { RuntimeSessionService } from './services/runtime-session.service';
import { RuntimeSkillCatalogService } from './services/runtime-skill-catalog.service';
import { RuntimeTaskService } from './services/runtime-task.service';
import { RuntimeWenyuanFacade } from './wenyuan/runtime-wenyuan-facade';
import { RuntimeTechBriefingService } from './briefings/runtime-tech-briefing.service';
import { RuntimeScheduleService } from './schedules/runtime-schedule.service';
import { RuntimeServiceContextFactory } from './runtime.service-contexts';
import { registerRuntimeServiceSkillResolvers } from './domain/skills/runtime-skill-runtime-resolvers';
import {
  bindServiceMethods,
  CENTER_METHOD_NAMES,
  KNOWLEDGE_METHOD_NAMES,
  SESSION_METHOD_NAMES,
  SKILL_CATALOG_METHOD_NAMES,
  TASK_METHOD_NAMES
} from './runtime.service.helpers';

@Injectable()
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class RuntimeService implements OnModuleInit {
  private readonly settings;
  private readonly memoryRepository;
  private readonly ruleRepository;
  private readonly skillRegistry;
  private readonly runtimeStateRepository;
  private readonly toolRegistry;
  private readonly llmProvider;
  private readonly mcpServerRegistry;
  private readonly mcpCapabilityRegistry;
  private readonly mcpClientManager;
  private readonly orchestrator;
  private readonly sessionCoordinator;
  private readonly describeConnectorProfilePolicy = describeConnectorProfilePolicy;

  private readonly backgroundRunnerId;
  private readonly backgroundWorkerPoolSize;
  private readonly backgroundLeaseTtlMs;
  private readonly backgroundHeartbeatMs;
  private readonly backgroundPollMs;
  private readonly skillSourceSyncService;
  private readonly operationalState: RuntimeOperationalStateService;
  private readonly bootstrapService: RuntimeBootstrapService;
  private readonly centersService: RuntimeCentersService;
  private readonly sessionService: RuntimeSessionService;
  private readonly knowledgeService: RuntimeKnowledgeService;
  private readonly skillCatalogService: RuntimeSkillCatalogService;
  private readonly taskService: RuntimeTaskService;
  private readonly wenyuanFacade: RuntimeWenyuanFacade;
  private readonly techBriefingService: RuntimeTechBriefingService;
  private readonly scheduleService: RuntimeScheduleService;
  private readonly contextFactory: RuntimeServiceContextFactory;
  private readonly appLogger?: AppLoggerService;

  constructor(
    private readonly runtimeHost: RuntimeHost = new RuntimeHost(),
    operationalState?: RuntimeOperationalStateService,
    bootstrapService?: RuntimeBootstrapService,
    techBriefingService?: RuntimeTechBriefingService,
    scheduleService?: RuntimeScheduleService,
    centersService?: RuntimeCentersService,
    sessionService?: RuntimeSessionService,
    knowledgeService?: RuntimeKnowledgeService,
    skillCatalogService?: RuntimeSkillCatalogService,
    taskService?: RuntimeTaskService,
    appLogger?: AppLoggerService
  ) {
    this.settings = runtimeHost.settings;
    this.memoryRepository = runtimeHost.memoryRepository;
    this.ruleRepository = runtimeHost.ruleRepository;
    this.skillRegistry = runtimeHost.skillRegistry;
    this.runtimeStateRepository = runtimeHost.runtimeStateRepository;
    this.toolRegistry = runtimeHost.toolRegistry;
    this.llmProvider = runtimeHost.llmProvider;
    this.mcpServerRegistry = runtimeHost.mcpServerRegistry;
    this.mcpCapabilityRegistry = runtimeHost.mcpCapabilityRegistry;
    this.mcpClientManager = runtimeHost.mcpClientManager;
    this.orchestrator = runtimeHost.orchestrator;
    this.sessionCoordinator = runtimeHost.sessionCoordinator;
    this.backgroundRunnerId = `${this.settings.runtimeBackground.runnerIdPrefix}-${process.pid}`;
    this.backgroundWorkerPoolSize = this.settings.runtimeBackground.workerPoolSize;
    this.backgroundLeaseTtlMs = this.settings.runtimeBackground.leaseTtlMs;
    this.backgroundHeartbeatMs = this.settings.runtimeBackground.heartbeatMs;
    this.backgroundPollMs = this.settings.runtimeBackground.pollMs;
    this.skillSourceSyncService = runtimeHost.skillSourceSyncService;
    this.appLogger = appLogger;
    this.techBriefingService =
      techBriefingService ??
      new RuntimeTechBriefingService(() => ({
        settings: this.settings,
        mcpClientManager: this.mcpClientManager,
        llmProvider: this.llmProvider
      }));
    this.scheduleService =
      scheduleService ??
      new RuntimeScheduleService(() => ({
        settings: this.settings,
        techBriefingService: this.techBriefingService,
        refreshMetricsSnapshots: (days: number) => this.centersService.refreshMetricsSnapshots(days)
      }));
    this.wenyuanFacade = new RuntimeWenyuanFacade(() => ({
      settings: this.settings,
      memoryRepository: this.memoryRepository,
      runtimeStateRepository: this.runtimeStateRepository,
      sessionCoordinator: this.sessionCoordinator,
      orchestrator: this.orchestrator
    }));
    this.operationalState = operationalState ?? new RuntimeOperationalStateService();
    this.centersService = centersService ?? new RuntimeCentersService(() => this.contextFactory.getCentersContext());
    this.contextFactory = new RuntimeServiceContextFactory({
      settings: () => this.settings,
      appLogger: () => this.appLogger,
      runtimeHost: () => this.runtimeHost,
      skillRegistry: () => this.skillRegistry,
      toolRegistry: () => this.toolRegistry,
      llmProvider: () => this.llmProvider,
      mcpServerRegistry: () => this.mcpServerRegistry,
      mcpCapabilityRegistry: () => this.mcpCapabilityRegistry,
      mcpClientManager: () => this.mcpClientManager,
      orchestrator: () => this.orchestrator,
      sessionCoordinator: () => this.sessionCoordinator,
      runtimeStateRepository: () => this.runtimeStateRepository,
      memoryRepository: () => this.memoryRepository,
      ruleRepository: () => this.ruleRepository,
      skillSourceSyncService: () => this.skillSourceSyncService,
      skillArtifactFetcher: () => this.runtimeHost.skillArtifactFetcher,
      describeConnectorProfilePolicy: this.describeConnectorProfilePolicy,
      operationalState: () => this.operationalState,
      wenyuanFacade: () => this.wenyuanFacade,
      centersService: () => this.centersService,
      backgroundRunnerId: this.backgroundRunnerId,
      backgroundWorkerPoolSize: this.backgroundWorkerPoolSize,
      backgroundLeaseTtlMs: this.backgroundLeaseTtlMs,
      backgroundHeartbeatMs: this.backgroundHeartbeatMs,
      backgroundPollMs: this.backgroundPollMs
    });
    this.bootstrapService =
      bootstrapService ??
      new RuntimeBootstrapService(() => ({
        sessionCoordinator: this.sessionCoordinator,
        orchestrator: this.orchestrator,
        getSkillSourcesContext: () => this.contextFactory.getSkillSourcesContext(),
        syncInstalledSkillWorkers: () => this.contextFactory.syncInstalledSkillWorkers(),
        applyStoredGovernanceOverrides: () => this.contextFactory.applyStoredGovernanceOverrides(),
        initializeMetricsSnapshots: () => this.centersService.refreshMetricsSnapshots(30).then(() => undefined),
        initializeDailyTechBriefing: () => this.techBriefingService.initializeSchedule().then(() => undefined),
        initializeScheduleRunner: () => this.scheduleService.initialize(),
        getBackgroundRunnerContext: () => this.contextFactory.getBackgroundRunnerContext()
      }));
    this.sessionService =
      sessionService ?? new RuntimeSessionService(() => ({ sessionCoordinator: this.sessionCoordinator }));
    this.knowledgeService =
      knowledgeService ?? new RuntimeKnowledgeService(() => this.contextFactory.getKnowledgeContext());
    this.skillCatalogService =
      skillCatalogService ?? new RuntimeSkillCatalogService(() => this.contextFactory.getSkillCatalogContext());
    this.taskService = taskService ?? new RuntimeTaskService(() => this.contextFactory.getTaskContext());
    bindServiceMethods(this, this.taskService, TASK_METHOD_NAMES);
    bindServiceMethods(this, this.knowledgeService, KNOWLEDGE_METHOD_NAMES);
    bindServiceMethods(this, this.skillCatalogService, SKILL_CATALOG_METHOD_NAMES);
    bindServiceMethods(this, this.centersService, CENTER_METHOD_NAMES);
    bindServiceMethods(this, this.sessionService, SESSION_METHOD_NAMES);
  }

  async onModuleInit() {
    await this.bootstrapService.initialize();
    registerRuntimeServiceSkillResolvers(this.orchestrator as RuntimeHost['orchestrator'] & Record<string, unknown>, {
      settings: this.settings,
      centersService: this.centersService,
      contextFactory: this.contextFactory
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface RuntimeService extends Pick<RuntimeKnowledgeService, (typeof KNOWLEDGE_METHOD_NAMES)[number]> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface RuntimeService extends Pick<RuntimeCentersService, (typeof CENTER_METHOD_NAMES)[number]> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface RuntimeService extends Pick<RuntimeSessionService, (typeof SESSION_METHOD_NAMES)[number]> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface RuntimeService extends Pick<RuntimeSkillCatalogService, (typeof SKILL_CATALOG_METHOD_NAMES)[number]> {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unsafe-declaration-merging
export interface RuntimeService extends Pick<RuntimeTaskService, (typeof TASK_METHOD_NAMES)[number]> {}
