import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../src/runtime/runtime-architecture-helpers', () => ({
  normalizeExecutionMode: vi.fn((mode: string) => mode ?? 'execute')
}));

vi.mock('../../../src/runtime/runtime-review-records', () => ({
  normalizeRuntimeSpecialistFinding: vi.fn(input => input)
}));

vi.mock('../../../src/bridges/supervisor-runtime-bridge', () => ({
  buildResearchSourcePlan: vi.fn(() => []),
  markExecutionStepBlocked: vi.fn(),
  markExecutionStepCompleted: vi.fn(),
  markExecutionStepStarted: vi.fn(),
  mergeEvidence: vi.fn((existing, newItems) => [...existing, ...newItems])
}));

vi.mock('../../../src/flows/approval/research-skill-interruption', () => ({
  handleResearchSkillIntervention: vi.fn().mockResolvedValue({ interrupted: false })
}));

vi.mock('../../../src/flows/runtime-stage/runtime-stage-helpers', () => ({
  announceSkillStep: vi.fn(),
  completeSkillStep: vi.fn(),
  resolveResearchDispatchObjective: vi.fn(() => 'research objective')
}));

import { runResearchStage } from '../../../src/flows/runtime-stage/runtime-stage-research';
import { handleResearchSkillIntervention } from '../../../src/flows/approval/research-skill-interruption';
import { normalizeExecutionMode } from '../../../src/runtime/runtime-architecture-helpers';
import { buildResearchSourcePlan } from '../../../src/bridges/supervisor-runtime-bridge';

function makeTask(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'task-1',
    status: 'running',
    currentMinistry: 'hubu-search',
    currentWorker: 'worker-1',
    executionMode: undefined,
    executionPlan: { mode: 'execute' },
    planMode: undefined,
    resolvedWorkflow: {},
    modelRoute: [{ ministry: 'hubu-search', workerId: 'worker-1' }],
    externalSources: [],
    budgetState: { sourceBudget: 8, sourcesConsumed: 0 },
    specialistLead: { domain: 'coding', reason: 'test' },
    supportingSpecialists: [],
    contextSlicesBySpecialist: [],
    knowledgeIngestionState: undefined,
    knowledgeIndexState: undefined,
    approvals: [],
    trace: [],
    routeConfidence: 0.9,
    ...overrides
  };
}

function makeState(overrides: Record<string, unknown> = {}): any {
  return {
    retryCount: 0,
    maxRetries: 2,
    observations: [],
    dispatches: [],
    ...overrides
  };
}

function makeCallbacks(overrides: Record<string, unknown> = {}): any {
  return {
    ensureTaskNotCancelled: vi.fn(),
    syncTaskRuntime: vi.fn(),
    markSubgraph: vi.fn(),
    markWorkerUsage: vi.fn(),
    addTrace: vi.fn(),
    addProgressDelta: vi.fn(),
    setSubTaskStatus: vi.fn(),
    addMessage: vi.fn(),
    upsertAgentState: vi.fn(),
    persistAndEmitTask: vi.fn().mockResolvedValue(undefined),
    updateBudgetState: vi.fn((task, overrides) => ({
      sourceBudget: 8,
      sourcesConsumed: 0,
      ...(task.budgetState ?? {}),
      ...overrides
    })),
    resolveResearchMinistry: vi.fn(() => 'hubu-search'),
    ...overrides
  };
}

function makeHubu(overrides: Record<string, unknown> = {}): any {
  return {
    research: vi.fn().mockResolvedValue({
      summary: 'research completed',
      memories: [{ id: 'mem-1' }],
      knowledgeEvidence: [],
      skills: [{ id: 'skill-1' }],
      specialistFinding: undefined,
      contractMeta: { parseStatus: 'success', fallbackUsed: false }
    }),
    getState: vi.fn(() => ({ state: 'hubu' })),
    ...overrides
  };
}

describe('runResearchStage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (normalizeExecutionMode as any).mockImplementation((mode: string) => mode ?? 'execute');
    (buildResearchSourcePlan as any).mockReturnValue([]);
    (handleResearchSkillIntervention as any).mockResolvedValue({ interrupted: false });
  });

  it('runs research and returns result', async () => {
    const task = makeTask();
    const hubu = makeHubu();
    const callbacks = makeCallbacks();

    const result = await runResearchStage(task, makeState(), hubu, {} as any, undefined, callbacks);

    expect(result.currentStep).toBe('research');
    expect(result.researchSummary).toBe('research completed');
    expect(result.retrievedMemories).toHaveLength(1);
    expect(result.retrievedSkills).toHaveLength(1);
    expect(result.resumeFromApproval).toBe(false);
  });

  it('persists task after successful research', async () => {
    const task = makeTask();
    const hubu = makeHubu();
    const callbacks = makeCallbacks();

    await runResearchStage(task, makeState(), hubu, {} as any, undefined, callbacks);

    expect(callbacks.persistAndEmitTask).toHaveBeenCalled();
  });

  it('uses libuDocs for research when ministry is libu-delivery', async () => {
    const task = makeTask();
    const callbacks = makeCallbacks({ resolveResearchMinistry: () => 'libu-delivery' });
    const hubu = makeHubu();
    const libuDocs = {
      research: vi.fn().mockResolvedValue({
        summary: 'docs research',
        memories: [],
        skills: [],
        contractMeta: { parseStatus: 'success', fallbackUsed: false }
      }),
      getState: vi.fn(() => ({ state: 'docs' }))
    };

    const result = await runResearchStage(task, makeState(), hubu, libuDocs as any, undefined, callbacks);

    expect(libuDocs.research).toHaveBeenCalled();
    expect(hubu.research).not.toHaveBeenCalled();
    expect(result.researchSummary).toBe('docs research');
  });

  it('blocks research when skill intervention is interrupted', async () => {
    (handleResearchSkillIntervention as any).mockResolvedValue({
      interrupted: true,
      statePatch: { currentStep: 'research', approvalRequired: true }
    });

    const task = makeTask();
    const hubu = makeHubu();
    const callbacks = makeCallbacks();

    const result = await runResearchStage(task, makeState(), hubu, {} as any, undefined, callbacks);

    expect(result.currentStep).toBe('research');
    expect(result.approvalRequired).toBe(true);
  });

  it('adds planning guard trace in plan mode', async () => {
    (normalizeExecutionMode as any).mockReturnValue('plan');
    const task = makeTask();
    const hubu = makeHubu();
    const callbacks = makeCallbacks();

    await runResearchStage(task, makeState(), hubu, {} as any, undefined, callbacks);

    expect(callbacks.addTrace).toHaveBeenCalledWith(
      expect.anything(),
      'planning_readonly_guard',
      expect.stringContaining('只读'),
      expect.anything()
    );
  });

  it('updates budget state with sources consumed', async () => {
    const sources = [
      { id: 'src-1', summary: 'source 1', sourceUrl: 'https://example.com', sourceType: 'web', trustClass: 'internal' }
    ];
    (buildResearchSourcePlan as any).mockReturnValue(sources);

    const task = makeTask();
    const hubu = makeHubu();
    const callbacks = makeCallbacks();

    await runResearchStage(task, makeState(), hubu, {} as any, undefined, callbacks);

    expect(callbacks.updateBudgetState).toHaveBeenCalledWith(task, expect.objectContaining({ sourcesConsumed: 1 }));
  });

  it('sets research evidence refs on task', async () => {
    const task = makeTask();
    const hubu = makeHubu();
    const callbacks = makeCallbacks();

    await runResearchStage(task, makeState(), hubu, {} as any, undefined, callbacks);

    expect(callbacks.setSubTaskStatus).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'running');
    expect(callbacks.setSubTaskStatus).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'completed');
  });

  it('upserts specialist findings when specialistLead exists', async () => {
    const task = makeTask();
    const hubu = makeHubu();
    const callbacks = makeCallbacks();

    await runResearchStage(task, makeState(), hubu, {} as any, undefined, callbacks);

    expect(task.specialistFindings).toBeDefined();
    expect(task.specialistFindings.length).toBeGreaterThan(0);
  });

  it('sets knowledge state when knowledgeEvidence is present', async () => {
    const hubu = makeHubu({
      research: vi.fn().mockResolvedValue({
        summary: 'research with knowledge',
        memories: [],
        knowledgeEvidence: [{ id: 'ev-1', detail: { documentId: 'doc-1' } }],
        skills: [],
        contractMeta: { parseStatus: 'success', fallbackUsed: false }
      })
    });
    const task = makeTask();
    const callbacks = makeCallbacks();

    await runResearchStage(task, makeState(), hubu, {} as any, undefined, callbacks);

    expect(task.knowledgeIngestionState.status).toBe('completed');
    expect(task.knowledgeIndexState.indexStatus).toBe('ready');
  });

  it('tracks observations from research summary', async () => {
    const task = makeTask();
    const hubu = makeHubu();
    const callbacks = makeCallbacks();
    const state = makeState({ observations: ['prev obs'] });

    const result = await runResearchStage(task, state, hubu, {} as any, undefined, callbacks);

    expect(result.observations).toContain('prev obs');
    expect(result.observations).toContain('research completed');
  });
});
