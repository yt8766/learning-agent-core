import {
  runBackgroundRunnerTick,
  startBackgroundRunnerLoop,
  type RuntimeBackgroundRunnerContext
} from '../helpers/runtime-background-runner';
import {
  resolveTaskSkillSearch,
  syncEnabledRemoteSkillSources,
  type RuntimeSkillSourcesContext
} from '../skills/runtime-skill-sources.service';

interface RuntimeBootstrapSessionCoordinator {
  initialize: () => Promise<void>;
}

interface LocalSkillSuggestionResolverInput {
  goal: string;
  usedInstalledSkills?: string[];
  requestedHints?: Record<string, unknown>;
  specialistDomain?: string;
}

interface RuntimeBootstrapOrchestrator {
  setLocalSkillSuggestionResolver?: (resolver: (input: LocalSkillSuggestionResolverInput) => Promise<unknown>) => void;
}

export interface RuntimeBootstrapContext {
  sessionCoordinator: RuntimeBootstrapSessionCoordinator;
  orchestrator: RuntimeBootstrapOrchestrator;
  getSkillSourcesContext: () => RuntimeSkillSourcesContext;
  syncInstalledSkillWorkers: () => Promise<void>;
  applyStoredGovernanceOverrides: () => Promise<void>;
  initializeMetricsSnapshots: () => Promise<void>;
  initializeDailyTechBriefing: () => Promise<void>;
  initializeScheduleRunner: () => Promise<void>;
  getBackgroundRunnerContext: () => RuntimeBackgroundRunnerContext;
}

export class RuntimeBootstrapService {
  private backgroundRunnerTimer?: NodeJS.Timeout;
  private initialized = false;

  constructor(private readonly getContext: () => RuntimeBootstrapContext) {}

  async initialize() {
    if (this.initialized) {
      return;
    }

    const ctx = this.getContext();
    await ctx.sessionCoordinator.initialize();
    await syncEnabledRemoteSkillSources(ctx.getSkillSourcesContext());
    await ctx.syncInstalledSkillWorkers();
    await ctx.applyStoredGovernanceOverrides();
    await ctx.initializeDailyTechBriefing();
    await ctx.initializeScheduleRunner();
    void ctx.initializeMetricsSnapshots().catch(() => undefined);

    if (typeof ctx.orchestrator.setLocalSkillSuggestionResolver === 'function') {
      ctx.orchestrator.setLocalSkillSuggestionResolver(
        async ({ goal, usedInstalledSkills, requestedHints, specialistDomain }: LocalSkillSuggestionResolverInput) =>
          resolveTaskSkillSearch(ctx.getSkillSourcesContext(), goal, {
            usedInstalledSkills,
            requestedHints,
            specialistDomain
          })
      );
    }

    if (ctx.getBackgroundRunnerContext().enabled) {
      this.backgroundRunnerTimer = startBackgroundRunnerLoop(ctx.getBackgroundRunnerContext(), () =>
        runBackgroundRunnerTick(ctx.getBackgroundRunnerContext())
      );
    }
    this.initialized = true;
  }

  dispose() {
    if (this.backgroundRunnerTimer) {
      clearTimeout(this.backgroundRunnerTimer);
    }
  }
}
