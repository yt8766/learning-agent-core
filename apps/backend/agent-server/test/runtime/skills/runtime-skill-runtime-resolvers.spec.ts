import { describe, expect, it, vi } from 'vitest';

import {
  resolveRuntimeServiceSkillInstallApproval,
  resolveRuntimeServiceSkillIntervention,
  resolveRuntimeServicePreExecutionSkillIntervention,
  registerRuntimeServiceSkillResolvers
} from '../../../src/runtime/domain/skills/runtime-skill-runtime-resolvers';

vi.mock('../../../src/runtime/domain/skills/runtime-skill-orchestration', () => ({
  resolveSkillInstallApproval: vi.fn().mockResolvedValue({ approved: true }),
  resolveRuntimeSkillIntervention: vi.fn().mockResolvedValue({ intervention: 'none' }),
  resolvePreExecutionSkillIntervention: vi.fn().mockResolvedValue({ intervention: 'none' })
}));

vi.mock('../../../src/runtime/skills/runtime-skill-sources.service', () => ({
  resolveTaskSkillSearch: vi.fn().mockResolvedValue({ suggestions: [] })
}));

function createMockDeps(overrides: Record<string, unknown> = {}) {
  return {
    settings: {
      skillInterventionMode: 'auto' as const
    },
    centersService: {
      getSkillRegistry: vi.fn().mockReturnValue({ list: vi.fn().mockReturnValue([]) })
    },
    contextFactory: {
      getSkillSourcesContext: vi.fn().mockReturnValue({ listSkillSources: vi.fn().mockResolvedValue([]) })
    },
    ...overrides
  } as any;
}

function createMockOrchestrator(overrides: Record<string, unknown> = {}) {
  return {
    setLocalSkillSuggestionResolver: vi.fn(),
    setPreExecutionSkillInterventionResolver: vi.fn(),
    setRuntimeSkillInterventionResolver: vi.fn(),
    setSkillInstallApprovalResolver: vi.fn(),
    ...overrides
  } as any;
}

describe('resolveRuntimeServiceSkillInstallApproval', () => {
  it('delegates to resolveSkillInstallApproval with deps', async () => {
    const { resolveSkillInstallApproval } =
      await import('../../../src/runtime/domain/skills/runtime-skill-orchestration');
    const deps = createMockDeps();

    await resolveRuntimeServiceSkillInstallApproval(deps, { goal: 'install skill' }, { receiptId: 'r1' }, 'admin');

    expect(resolveSkillInstallApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        centersService: deps.centersService,
        task: { goal: 'install skill' },
        pending: { receiptId: 'r1' },
        actor: 'admin'
      })
    );
  });

  it('works without optional actor parameter', async () => {
    const { resolveSkillInstallApproval } =
      await import('../../../src/runtime/domain/skills/runtime-skill-orchestration');
    const deps = createMockDeps();

    await resolveRuntimeServiceSkillInstallApproval(deps, { goal: 'install skill' }, { receiptId: 'r1' });

    expect(resolveSkillInstallApproval).toHaveBeenCalledWith(expect.objectContaining({ actor: undefined }));
  });
});

describe('resolveRuntimeServiceSkillIntervention', () => {
  it('delegates to resolveRuntimeSkillIntervention', async () => {
    const { resolveRuntimeSkillIntervention } =
      await import('../../../src/runtime/domain/skills/runtime-skill-orchestration');
    const deps = createMockDeps();

    await resolveRuntimeServiceSkillIntervention(
      deps,
      { id: 'task-1' },
      'build a website',
      'research',
      { query: 'web dev' },
      ['skill-1']
    );

    expect(resolveRuntimeSkillIntervention).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: deps.settings,
        centersService: deps.centersService,
        goal: 'build a website',
        currentStep: 'research',
        skillSearch: { query: 'web dev' },
        usedInstalledSkills: ['skill-1']
      })
    );
  });

  it('works without optional parameters', async () => {
    const { resolveRuntimeSkillIntervention } =
      await import('../../../src/runtime/domain/skills/runtime-skill-orchestration');
    const deps = createMockDeps();

    await resolveRuntimeServiceSkillIntervention(deps, { id: 'task-1' }, 'build a website', 'direct_reply');

    expect(resolveRuntimeSkillIntervention).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: 'build a website',
        currentStep: 'direct_reply',
        skillSearch: undefined,
        usedInstalledSkills: undefined
      })
    );
  });
});

describe('resolveRuntimeServicePreExecutionSkillIntervention', () => {
  it('delegates to resolvePreExecutionSkillIntervention', async () => {
    const { resolvePreExecutionSkillIntervention } =
      await import('../../../src/runtime/domain/skills/runtime-skill-orchestration');
    const deps = createMockDeps();

    await resolveRuntimeServicePreExecutionSkillIntervention(deps, 'analyze data', { query: 'data analysis' }, [
      'skill-1'
    ]);

    expect(resolvePreExecutionSkillIntervention).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: deps.settings,
        centersService: deps.centersService,
        goal: 'analyze data',
        skillSearch: { query: 'data analysis' },
        usedInstalledSkills: ['skill-1']
      })
    );
  });

  it('works without optional parameters', async () => {
    const { resolvePreExecutionSkillIntervention } =
      await import('../../../src/runtime/domain/skills/runtime-skill-orchestration');
    const deps = createMockDeps();

    await resolveRuntimeServicePreExecutionSkillIntervention(deps, 'analyze data');

    expect(resolvePreExecutionSkillIntervention).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: 'analyze data',
        skillSearch: undefined,
        usedInstalledSkills: undefined
      })
    );
  });
});

describe('registerRuntimeServiceSkillResolvers', () => {
  it('registers all four resolvers on the orchestrator', () => {
    const deps = createMockDeps();
    const orchestrator = createMockOrchestrator();

    registerRuntimeServiceSkillResolvers(orchestrator, deps);

    expect(orchestrator.setLocalSkillSuggestionResolver).toHaveBeenCalled();
    expect(orchestrator.setPreExecutionSkillInterventionResolver).toHaveBeenCalled();
    expect(orchestrator.setRuntimeSkillInterventionResolver).toHaveBeenCalled();
    expect(orchestrator.setSkillInstallApprovalResolver).toHaveBeenCalled();
  });

  it('returns early when setLocalSkillSuggestionResolver is not available', () => {
    const deps = createMockDeps();
    const orchestrator = {} as any;

    registerRuntimeServiceSkillResolvers(orchestrator, deps);
    // Should not throw
  });

  it('returns early when orchestrator does not have setLocalSkillSuggestionResolver in keys', () => {
    const deps = createMockDeps();
    const orchestrator = {
      setPreExecutionSkillInterventionResolver: vi.fn(),
      setRuntimeSkillInterventionResolver: vi.fn(),
      setSkillInstallApprovalResolver: vi.fn()
    } as any;

    registerRuntimeServiceSkillResolvers(orchestrator, deps);
    expect(orchestrator.setPreExecutionSkillInterventionResolver).not.toHaveBeenCalled();
  });

  it('handles orchestrators with undefined resolver setters gracefully', () => {
    const deps = createMockDeps();
    const orchestrator = {
      setLocalSkillSuggestionResolver: undefined,
      setPreExecutionSkillInterventionResolver: undefined,
      setRuntimeSkillInterventionResolver: undefined,
      setSkillInstallApprovalResolver: undefined
    } as any;

    // Should not throw since it uses optional chaining
    registerRuntimeServiceSkillResolvers(orchestrator, deps);
  });
});
