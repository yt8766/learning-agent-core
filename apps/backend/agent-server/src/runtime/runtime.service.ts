import { Injectable, OnModuleInit } from '@nestjs/common';

import { describeConnectorProfilePolicy } from '@agent/agent-core';
import { SkillCard } from '@agent/shared';

import { applyGovernanceOverrides, registerInstalledSkillWorker } from './helpers/runtime-connector-registry';
import {
  runBackgroundRunnerTick,
  startBackgroundRunnerLoop,
  type RuntimeBackgroundRunnerContext
} from './helpers/runtime-background-runner';
import { fetchProviderUsageAudit, type ProviderAuditSyncResult } from './helpers/provider-audit';
import { RemoteSkillDiscoveryService } from './skills/remote-skill-discovery.service';
import { SkillArtifactFetcher } from './skills/skill-artifact-fetcher';
import type { RuntimeSkillInstallContext } from './skills/runtime-skill-install.service';
import {
  resolveTaskSkillSearch,
  syncEnabledRemoteSkillSources,
  type RuntimeSkillSourcesContext
} from './skills/runtime-skill-sources.service';
import { SkillSourceSyncService } from './skills/skill-source-sync.service';
import { RuntimeHost } from './core/runtime.host';
import { RuntimeCentersService } from './centers/runtime-centers.service';
import { RuntimeBootstrapService } from './services/runtime-bootstrap.service';
import { RuntimeKnowledgeContext, RuntimeKnowledgeService } from './services/runtime-knowledge.service';
import { RuntimeOperationalStateService } from './services/runtime-operational-state.service';
import { RuntimeSessionService } from './services/runtime-session.service';
import { RuntimeSkillCatalogService } from './services/runtime-skill-catalog.service';
import { RuntimeTaskService } from './services/runtime-task.service';
import { RuntimeWenyuanFacade } from './wenyuan/runtime-wenyuan-facade';
import {
  bindServiceMethods,
  CENTER_METHOD_NAMES,
  createSkillInstallContext,
  createSkillSourcesContext,
  KNOWLEDGE_METHOD_NAMES,
  resolvePreExecutionSkillIntervention,
  resolveRuntimeSkillIntervention,
  resolveSkillInstallApproval,
  resolveTaskSkillSuggestions,
  SESSION_METHOD_NAMES,
  SKILL_CATALOG_METHOD_NAMES,
  syncInstalledSkillWorkers,
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
  private readonly remoteSkillDiscoveryService;
  private readonly skillArtifactFetcher;
  private readonly operationalState: RuntimeOperationalStateService;
  private readonly bootstrapService: RuntimeBootstrapService;
  private readonly centersService: RuntimeCentersService;
  private readonly sessionService: RuntimeSessionService;
  private readonly knowledgeService: RuntimeKnowledgeService;
  private readonly skillCatalogService: RuntimeSkillCatalogService;
  private readonly taskService: RuntimeTaskService;
  private readonly wenyuanFacade: RuntimeWenyuanFacade;

  constructor(
    private readonly runtimeHost: RuntimeHost = new RuntimeHost(),
    operationalState?: RuntimeOperationalStateService,
    bootstrapService?: RuntimeBootstrapService,
    centersService?: RuntimeCentersService,
    sessionService?: RuntimeSessionService,
    knowledgeService?: RuntimeKnowledgeService,
    skillCatalogService?: RuntimeSkillCatalogService,
    taskService?: RuntimeTaskService
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
    this.remoteSkillDiscoveryService = runtimeHost.remoteSkillDiscoveryService;
    this.skillArtifactFetcher = runtimeHost.skillArtifactFetcher;
    this.wenyuanFacade = new RuntimeWenyuanFacade(() => ({
      settings: this.settings,
      memoryRepository: this.memoryRepository,
      runtimeStateRepository: this.runtimeStateRepository,
      sessionCoordinator: this.sessionCoordinator,
      orchestrator: this.orchestrator
    }));
    this.operationalState = operationalState ?? new RuntimeOperationalStateService();
    this.bootstrapService =
      bootstrapService ??
      new RuntimeBootstrapService(() => ({
        sessionCoordinator: this.sessionCoordinator,
        orchestrator: this.orchestrator,
        getSkillSourcesContext: () => this.getSkillSourcesContext(),
        syncInstalledSkillWorkers: () => this.syncInstalledSkillWorkers(),
        applyStoredGovernanceOverrides: () => this.applyStoredGovernanceOverrides(),
        getBackgroundRunnerContext: () => this.getBackgroundRunnerContext()
      }));
    this.centersService = centersService ?? new RuntimeCentersService(() => this.getCentersContext());
    this.sessionService =
      sessionService ?? new RuntimeSessionService(() => ({ sessionCoordinator: this.sessionCoordinator }));
    this.knowledgeService = knowledgeService ?? new RuntimeKnowledgeService(() => this.getKnowledgeContext());
    this.skillCatalogService =
      skillCatalogService ?? new RuntimeSkillCatalogService(() => this.getSkillCatalogContext());
    this.taskService = taskService ?? new RuntimeTaskService(() => this.getTaskContext());
    bindServiceMethods(this, this.taskService, TASK_METHOD_NAMES);
    bindServiceMethods(this, this.knowledgeService, KNOWLEDGE_METHOD_NAMES);
    bindServiceMethods(this, this.skillCatalogService, SKILL_CATALOG_METHOD_NAMES);
    bindServiceMethods(this, this.centersService, CENTER_METHOD_NAMES);
    bindServiceMethods(this, this.sessionService, SESSION_METHOD_NAMES);
  }

  async onModuleInit() {
    await this.bootstrapService.initialize();
    if ('setLocalSkillSuggestionResolver' in this.orchestrator) {
      this.orchestrator.setLocalSkillSuggestionResolver(
        async ({ goal, usedInstalledSkills, requestedHints, specialistDomain }: any) =>
          resolveTaskSkillSearch(this.getSkillSourcesContext(), goal, {
            usedInstalledSkills,
            requestedHints,
            specialistDomain
          })
      );
      this.orchestrator.setPreExecutionSkillInterventionResolver(
        async ({ goal, skillSearch, usedInstalledSkills }: any) =>
          this.resolvePreExecutionSkillIntervention(goal, skillSearch, usedInstalledSkills)
      );
      this.orchestrator.setRuntimeSkillInterventionResolver(
        async ({ task, goal, currentStep, skillSearch, usedInstalledSkills }: any) =>
          this.resolveRuntimeSkillIntervention(task, goal, currentStep, skillSearch, usedInstalledSkills)
      );
      this.orchestrator.setSkillInstallApprovalResolver(async ({ task, pending, actor }: any) =>
        this.resolveSkillInstallApproval(task, pending, actor)
      );
    }
  }

  private async resolveSkillInstallApproval(
    task: { goal: string; usedInstalledSkills?: string[] },
    pending: {
      receiptId?: string;
      usedInstalledSkills?: string[];
      skillDisplayName?: string;
    },
    actor?: string
  ) {
    return resolveSkillInstallApproval({
      centersService: this.centersService,
      getSkillSourcesContext: () => this.getSkillSourcesContext(),
      task,
      pending,
      actor
    });
  }

  private async resolveRuntimeSkillIntervention(
    task: { id: string },
    goal: string,
    currentStep: 'direct_reply' | 'research',
    skillSearch?: {
      suggestions?: Array<{
        id: string;
        kind: string;
        displayName: string;
        availability: string;
        repo?: string;
        skillName?: string;
        detailsUrl?: string;
        installCommand?: string;
        triggerReason?: 'user_requested' | 'capability_gap_detected' | 'domain_specialization_needed';
        summary?: string;
        sourceLabel?: string;
      }>;
    },
    usedInstalledSkills?: string[]
  ) {
    return resolveRuntimeSkillIntervention({
      settings: this.settings,
      centersService: this.centersService,
      getSkillSourcesContext: () => this.getSkillSourcesContext(),
      goal,
      currentStep,
      skillSearch,
      usedInstalledSkills
    });
  }

  private async resolvePreExecutionSkillIntervention(
    goal: string,
    skillSearch?: { suggestions?: Array<any> },
    usedInstalledSkills?: string[]
  ) {
    return resolvePreExecutionSkillIntervention({
      settings: this.settings,
      centersService: this.centersService,
      getSkillSourcesContext: () => this.getSkillSourcesContext(),
      goal,
      skillSearch,
      usedInstalledSkills
    });
  }

  private resolveTaskSkillSuggestions(goal: string, options?: { usedInstalledSkills?: string[]; limit?: number }) {
    return resolveTaskSkillSuggestions(() => this.getSkillSourcesContext(), goal, options);
  }

  private getBackgroundWorkerSlots(): Map<string, { taskId: string; startedAt: string }> {
    return this.operationalState.getBackgroundWorkerSlots();
  }

  private getConnectorRegistryContext() {
    return {
      settings: this.settings,
      mcpServerRegistry: this.mcpServerRegistry,
      mcpCapabilityRegistry: this.mcpCapabilityRegistry,
      mcpClientManager: this.mcpClientManager,
      orchestrator: this.orchestrator
    };
  }

  private getSkillInstallContext(): RuntimeSkillInstallContext {
    return createSkillInstallContext({
      settings: this.settings,
      skillRegistry: this.skillRegistry,
      skillArtifactFetcher: this.skillArtifactFetcher,
      remoteSkillDiscoveryService: this.remoteSkillDiscoveryService,
      getSkillSourcesContext: () => this.getSkillSourcesContext(),
      registerSkillWorker: (skill: SkillCard) => registerInstalledSkillWorker(this.getConnectorRegistryContext(), skill)
    });
  }

  private getSkillSourcesContext(): RuntimeSkillSourcesContext & {
    listSkillSources?: () => Promise<any[]>;
  } {
    return createSkillSourcesContext({
      settings: this.settings,
      toolRegistry: this.toolRegistry,
      skillRegistry: this.skillRegistry,
      skillSourceSyncService: this.skillSourceSyncService,
      remoteSkillDiscoveryService: this.remoteSkillDiscoveryService,
      getDisabledSkillSourceIds: () => this.getDisabledSkillSourceIds(),
      getSkillInstallContext: () => this.getSkillInstallContext()
    });
  }

  private getPlatformConsoleContext() {
    return {
      skillRegistry: this.skillRegistry,
      orchestrator: this.orchestrator,
      sessionCoordinator: this.sessionCoordinator,
      getRuntimeCenter: (days?: number, filters?: Record<string, unknown>) => this.getRuntimeCenter(days, filters),
      getApprovalsCenter: (filters?: Record<string, unknown>) => this.getApprovalsCenter(filters),
      getLearningCenter: () => this.getLearningCenter(),
      getEvalsCenter: (days?: number, filters?: Record<string, unknown>) => this.getEvalsCenter(days, filters),
      getEvidenceCenter: () => this.getEvidenceCenter(),
      getConnectorsCenter: () => this.getConnectorsCenter(),
      getSkillSourcesCenter: () => this.getSkillSourcesCenter(),
      getCompanyAgentsCenter: () => this.getCompanyAgentsCenter()
    };
  }

  private async fetchProviderUsageAudit(days: number): Promise<ProviderAuditSyncResult> {
    return fetchProviderUsageAudit(
      this.settings.providerAudit.adapters,
      this.settings.providerAudit.primaryProvider,
      days
    );
  }

  private getBackgroundRunnerContext(): RuntimeBackgroundRunnerContext {
    return {
      enabled: this.settings.runtimeBackground.enabled,
      orchestrator: this.orchestrator,
      runnerId: this.backgroundRunnerId,
      workerPoolSize: this.backgroundWorkerPoolSize,
      leaseTtlMs: this.backgroundLeaseTtlMs,
      heartbeatMs: this.backgroundHeartbeatMs,
      pollMs: this.backgroundPollMs,
      backgroundWorkerSlots: this.operationalState.getBackgroundWorkerSlots(),
      isSweepInFlight: () => this.operationalState.isBackgroundRunnerSweepInFlight(),
      setSweepInFlight: value => this.operationalState.setBackgroundRunnerSweepInFlight(value)
    };
  }

  private async syncInstalledSkillWorkers(): Promise<void> {
    await syncInstalledSkillWorkers({
      skillRegistry: this.skillRegistry,
      registerSkillWorker: (skill: SkillCard) => registerInstalledSkillWorker(this.getConnectorRegistryContext(), skill)
    });
  }

  private async applyStoredGovernanceOverrides(): Promise<void> {
    const snapshot = await this.runtimeStateRepository.load();
    applyGovernanceOverrides(this.getConnectorRegistryContext(), snapshot);
  }

  private async getDisabledSkillSourceIds(): Promise<string[]> {
    const snapshot = await this.runtimeStateRepository.load();
    return snapshot.governance?.disabledSkillSourceIds ?? [];
  }

  private getKnowledgeContext(): RuntimeKnowledgeContext {
    return {
      wenyuanFacade: this.wenyuanFacade,
      ruleRepository: this.ruleRepository,
      orchestrator: this.orchestrator,
      runtimeStateRepository: this.runtimeStateRepository
    };
  }

  private getSkillCatalogContext() {
    return {
      skillRegistry: this.skillRegistry,
      llmProvider: this.llmProvider,
      registerSkillWorker: (skill: SkillCard) => registerInstalledSkillWorker(this.getConnectorRegistryContext(), skill)
    };
  }

  private getTaskContext() {
    return {
      orchestrator: this.orchestrator,
      runtimeStateRepository: this.runtimeStateRepository,
      resolveTaskSkillSuggestions: (goal: string, options?: { usedInstalledSkills?: string[]; limit?: number }) =>
        this.resolveTaskSkillSuggestions(goal, options)
    };
  }

  private getCentersContext() {
    return {
      settings: this.settings,
      wenyuanFacade: this.wenyuanFacade,
      sessionCoordinator: this.sessionCoordinator,
      orchestrator: this.orchestrator,
      runtimeStateRepository: this.runtimeStateRepository,
      memoryRepository: this.memoryRepository,
      ruleRepository: this.ruleRepository,
      skillRegistry: this.skillRegistry,
      toolRegistry: this.toolRegistry,
      mcpClientManager: this.mcpClientManager,
      mcpServerRegistry: this.mcpServerRegistry,
      mcpCapabilityRegistry: this.mcpCapabilityRegistry,
      describeConnectorProfilePolicy: this.describeConnectorProfilePolicy,
      fetchProviderUsageAudit: (days: number) => this.fetchProviderUsageAudit(days),
      getBackgroundWorkerSlots: () => this.getBackgroundWorkerSlots(),
      getConnectorRegistryContext: () => this.getConnectorRegistryContext(),
      getSkillInstallContext: () => this.getSkillInstallContext(),
      getSkillSourcesContext: () => this.getSkillSourcesContext(),
      getPlatformConsoleContext: () => this.getPlatformConsoleContext()
    };
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
