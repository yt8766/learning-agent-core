import {
  runBackgroundRunnerTick,
  startBackgroundRunnerLoop,
  type RuntimeBackgroundRunnerContext
} from '../helpers/runtime-background-runner';
import {
  syncEnabledRemoteSkillSources,
  type RuntimeSkillSourcesContext
} from '../skills/runtime-skill-sources.service';

export interface RuntimeBootstrapContext {
  sessionCoordinator: any;
  orchestrator: any;
  getSkillSourcesContext: () => RuntimeSkillSourcesContext;
  syncInstalledSkillWorkers: () => Promise<void>;
  applyStoredGovernanceOverrides: () => Promise<void>;
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

    if ('setLocalSkillSuggestionResolver' in ctx.orchestrator) {
      ctx.orchestrator.setLocalSkillSuggestionResolver(async ({ goal, usedInstalledSkills }: any) =>
        syncEnabledRemoteSkillSources ? undefined : { goal, usedInstalledSkills }
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
