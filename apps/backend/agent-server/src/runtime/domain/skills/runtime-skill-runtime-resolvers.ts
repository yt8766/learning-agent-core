import type { RuntimeHost } from '../../core/runtime.host';
import type { RuntimeServiceContextFactory } from '../../runtime.service-contexts';
import type { RuntimeCentersService } from '../../centers/runtime-centers.service';
import type { RuntimeSkillSearchPayload } from './runtime-skill-orchestration';
import {
  resolvePreExecutionSkillIntervention,
  resolveRuntimeSkillIntervention,
  resolveSkillInstallApproval
} from './runtime-skill-orchestration';
import { resolveTaskSkillSearch } from '../../skills/runtime-skill-sources.service';

interface SkillInstallApprovalInput {
  task: { goal: string; usedInstalledSkills?: string[] };
  pending: {
    receiptId?: string;
    usedInstalledSkills?: string[];
    skillDisplayName?: string;
  };
  actor?: string;
}

interface RuntimeSkillResolverInput {
  task: { id: string };
  goal: string;
  currentStep: 'direct_reply' | 'research';
  skillSearch?: RuntimeSkillSearchPayload;
  usedInstalledSkills?: string[];
}

interface PreExecutionSkillResolverInput {
  goal: string;
  skillSearch?: RuntimeSkillSearchPayload;
  usedInstalledSkills?: string[];
}

interface LocalSkillSuggestionResolverInput {
  goal: string;
  usedInstalledSkills?: string[];
  requestedHints?: Record<string, unknown>;
  specialistDomain?: string;
}

interface SkillResolverDeps {
  settings: RuntimeHost['settings'];
  centersService: RuntimeCentersService;
  contextFactory: RuntimeServiceContextFactory;
}

export function resolveRuntimeServiceSkillInstallApproval(
  deps: SkillResolverDeps,
  task: { goal: string; usedInstalledSkills?: string[] },
  pending: {
    receiptId?: string;
    usedInstalledSkills?: string[];
    skillDisplayName?: string;
  },
  actor?: string
) {
  return resolveSkillInstallApproval({
    centersService: deps.centersService,
    getSkillSourcesContext: () => deps.contextFactory.getSkillSourcesContext(),
    task,
    pending,
    actor
  });
}

export function resolveRuntimeServiceSkillIntervention(
  deps: SkillResolverDeps,
  task: { id: string },
  goal: string,
  currentStep: 'direct_reply' | 'research',
  skillSearch?: RuntimeSkillSearchPayload,
  usedInstalledSkills?: string[]
) {
  return resolveRuntimeSkillIntervention({
    settings: deps.settings,
    centersService: deps.centersService,
    getSkillSourcesContext: () => deps.contextFactory.getSkillSourcesContext(),
    goal,
    currentStep,
    skillSearch,
    usedInstalledSkills
  });
}

export function resolveRuntimeServicePreExecutionSkillIntervention(
  deps: SkillResolverDeps,
  goal: string,
  skillSearch?: RuntimeSkillSearchPayload,
  usedInstalledSkills?: string[]
) {
  return resolvePreExecutionSkillIntervention({
    settings: deps.settings,
    centersService: deps.centersService,
    getSkillSourcesContext: () => deps.contextFactory.getSkillSourcesContext(),
    goal,
    skillSearch,
    usedInstalledSkills
  });
}

export function registerRuntimeServiceSkillResolvers(
  orchestrator: RuntimeHost['orchestrator'] & {
    setLocalSkillSuggestionResolver?: (
      resolver: (input: LocalSkillSuggestionResolverInput) => Promise<unknown>
    ) => void;
    setPreExecutionSkillInterventionResolver?: (
      resolver: (input: PreExecutionSkillResolverInput) => Promise<unknown>
    ) => void;
    setRuntimeSkillInterventionResolver?: (resolver: (input: RuntimeSkillResolverInput) => Promise<unknown>) => void;
    setSkillInstallApprovalResolver?: (resolver: (input: SkillInstallApprovalInput) => Promise<unknown>) => void;
  },
  deps: SkillResolverDeps
) {
  if (!('setLocalSkillSuggestionResolver' in orchestrator)) {
    return;
  }

  orchestrator.setLocalSkillSuggestionResolver?.(
    async ({ goal, usedInstalledSkills, requestedHints, specialistDomain }: LocalSkillSuggestionResolverInput) =>
      resolveTaskSkillSearch(deps.contextFactory.getSkillSourcesContext(), goal, {
        usedInstalledSkills,
        requestedHints,
        specialistDomain
      })
  );
  orchestrator.setPreExecutionSkillInterventionResolver?.(
    async ({ goal, skillSearch, usedInstalledSkills }: PreExecutionSkillResolverInput) =>
      resolveRuntimeServicePreExecutionSkillIntervention(deps, goal, skillSearch, usedInstalledSkills)
  );
  orchestrator.setRuntimeSkillInterventionResolver?.(
    async ({ task, goal, currentStep, skillSearch, usedInstalledSkills }: RuntimeSkillResolverInput) =>
      resolveRuntimeServiceSkillIntervention(deps, task, goal, currentStep, skillSearch, usedInstalledSkills)
  );
  orchestrator.setSkillInstallApprovalResolver?.(async ({ task, pending, actor }: SkillInstallApprovalInput) =>
    resolveRuntimeServiceSkillInstallApproval(deps, task, pending, actor)
  );
}
