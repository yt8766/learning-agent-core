import { describe, expect, it, vi } from 'vitest';

import { MainGraphLearningJobsRuntime } from '../../../src/graphs/main/main-graph-learning-jobs';

function createRuntime(options?: { mcpThrows?: boolean }) {
  const learningJobs = new Map();
  const persistRuntimeState = vi.fn(async () => undefined);
  const skillRegistry = {
    publishToLab: vi.fn(async () => undefined)
  } as any;
  const learningFlow = {
    evaluateResearchJob: vi.fn(() => ({
      notes: [],
      recommendedCandidateIds: [],
      autoConfirmCandidateIds: [],
      sourceSummary: {
        externalSourceCount: 0,
        internalSourceCount: 0,
        reusedMemoryCount: 0,
        reusedRuleCount: 0,
        reusedSkillCount: 0
      },
      score: 0,
      confidence: 'medium'
    })),
    autoPersistResearchMemory: vi.fn(async () => undefined)
  } as any;
  const mcpClientManager = {
    hasCapability: vi.fn(() => true),
    invokeCapability: options?.mcpThrows
      ? vi.fn(async () => {
          throw new Error('mcp_unavailable');
        })
      : vi.fn(async () => ({
          ok: true,
          rawOutput: { summary: 'ok' }
        }))
  } as any;

  const runtime = new MainGraphLearningJobsRuntime(
    {
      policy: {
        sourcePolicyMode: 'controlled-first'
      }
    } as never,
    learningJobs,
    learningFlow,
    skillRegistry,
    mcpClientManager,
    goal => ({
      id: `skill:${goal}`,
      name: goal,
      description: goal,
      applicableGoals: [goal],
      requiredTools: [],
      steps: [],
      constraints: [],
      successSignals: [],
      riskLevel: 'low',
      source: 'document',
      status: 'lab',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }),
    persistRuntimeState
  );

  return { runtime, learningJobs, persistRuntimeState, skillRegistry, learningFlow, mcpClientManager };
}

describe('MainGraphLearningJobsRuntime', () => {
  it('queues document learning jobs and lets background processing complete them', async () => {
    const { runtime, skillRegistry, persistRuntimeState } = createRuntime();

    const queued = await runtime.createDocumentLearningJob({ documentUri: 'file:///guide.md', title: 'guide' });
    expect(queued.status).toBe('queued');

    const [completed] = await runtime.processQueuedLearningJobs();
    expect(completed).toEqual(expect.objectContaining({ id: queued.id, status: 'completed' }));
    expect(skillRegistry.publishToLab).toHaveBeenCalledTimes(1);
    expect(persistRuntimeState).toHaveBeenCalled();
  });

  it('marks research learning jobs failed when background collection throws', async () => {
    const { runtime, learningFlow } = createRuntime({ mcpThrows: true });

    const queued = await runtime.createResearchLearningJob({
      goal: '学习 LangGraph',
      preferredUrls: ['https://example.com/langgraph']
    });
    expect(queued.status).toBe('queued');

    const [failed] = await runtime.processQueuedLearningJobs();
    expect(failed).toEqual(
      expect.objectContaining({
        id: queued.id,
        status: 'failed',
        summary: 'mcp_unavailable'
      })
    );
    expect(learningFlow.autoPersistResearchMemory).not.toHaveBeenCalled();
  });
});
