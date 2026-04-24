import { describe, expect, it } from 'vitest';

import { ApprovalDecision } from '@agent/core';
import { createAgentGraph, createApprovalRecoveryGraph, createInitialState, createLearningGraph } from '@agent/runtime';

describe('runtime graph execution integration', () => {
  it('runs the main agent graph through a minimal happy path without external services', async () => {
    const graph = createAgentGraph().compile();

    const result = await graph.invoke(createInitialState('task-graph-1', 'summarize current runtime state'));

    expect(result).toMatchObject({
      taskId: 'task-graph-1',
      currentStep: 'finish',
      approvalStatus: ApprovalDecision.APPROVED,
      finalAnswer: 'LangGraph workflow completed.'
    });
    expect(result.currentPlan).toEqual(['research', 'execute', 'review']);
  });

  it('can execute approval recovery and learning graphs from the public runtime facade', async () => {
    const approval = await createApprovalRecoveryGraph()
      .compile()
      .invoke({
        taskId: 'task-graph-approval',
        goal: 'resume approved action',
        pending: {
          taskId: 'task-graph-approval',
          intent: 'write_file',
          toolName: 'filesystem',
          researchSummary: 'approval granted'
        }
      });
    const learning = await createLearningGraph().compile().invoke({
      taskId: 'task-graph-learning',
      candidateIds: [],
      autoConfirmed: false,
      confirmedCandidates: []
    });

    expect(approval.approvalStatus).toBe(ApprovalDecision.APPROVED);
    expect(learning).toMatchObject({
      taskId: 'task-graph-learning',
      autoConfirmed: false,
      confirmedCandidates: []
    });
  });
});
