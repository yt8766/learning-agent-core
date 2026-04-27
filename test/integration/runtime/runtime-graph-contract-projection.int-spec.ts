import { describe, expect, it } from 'vitest';

import { ActionIntent, ApprovalDecision, ChatCheckpointRecordSchema, TaskRecordSchema, TaskStatus } from '@agent/core';
import { createAgentGraph, createInitialState } from '@agent/runtime';

const NOW = '2026-04-26T00:00:00.000Z';

describe('runtime graph contract projection integration', () => {
  it('projects a completed main graph result into core task and checkpoint contracts', async () => {
    const executionStep = {
      id: 'step-runtime-contract-1',
      route: 'workflow-execute' as const,
      stage: 'execution' as const,
      label: 'Execute deterministic runtime integration',
      owner: 'gongbu' as const,
      status: 'completed' as const,
      startedAt: NOW,
      completedAt: NOW
    };
    const graph = createAgentGraph({
      async managerPlan(state) {
        return {
          ...state,
          currentPlan: ['research', 'execute', 'review'],
          observations: [...state.observations, `planned:${executionStep.route}`]
        };
      }
    }).compile();

    const result = await graph.invoke(createInitialState('task-runtime-contract-1', 'verify runtime projection'));
    const task = TaskRecordSchema.parse({
      id: result.taskId,
      goal: result.goal,
      status: TaskStatus.COMPLETED,
      currentStep: result.currentStep,
      retryCount: result.retryCount,
      maxRetries: result.maxRetries,
      trace: [],
      approvals: [
        {
          taskId: result.taskId,
          intent: ActionIntent.MODIFY_RULE,
          decision: ApprovalDecision.APPROVED,
          decidedAt: NOW
        }
      ],
      result: result.finalAnswer,
      agentStates: [],
      messages: [],
      createdAt: NOW,
      updatedAt: NOW
    });
    const checkpoint = ChatCheckpointRecordSchema.parse({
      checkpointId: 'checkpoint-runtime-contract-1',
      sessionId: 'session-runtime-contract-1',
      taskId: result.taskId,
      recoverability: 'safe',
      createdAt: NOW,
      updatedAt: NOW,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 1,
      learningCursor: 0,
      graphState: {
        status: task.status,
        currentStep: result.currentStep,
        retryCount: result.retryCount,
        maxRetries: result.maxRetries
      },
      pendingApprovals: [],
      agentStates: [],
      streamStatus: {
        nodeId: result.currentStep,
        nodeLabel: 'Runtime Graph',
        detail: result.observations.at(-1),
        updatedAt: NOW
      }
    });

    expect(task).toMatchObject({
      id: 'task-runtime-contract-1',
      status: TaskStatus.COMPLETED,
      result: 'LangGraph workflow completed.'
    });
    expect(checkpoint.graphState).toMatchObject({
      status: TaskStatus.COMPLETED,
      currentStep: 'finish'
    });
    expect(checkpoint.streamStatus?.detail).toBe('planned:workflow-execute');
  });

  it('keeps a pending approval graph exit parseable as a recoverable checkpoint', async () => {
    const executeCalls: string[] = [];
    const graph = createAgentGraph({
      async research(state) {
        return {
          ...state,
          currentStep: 'research',
          toolIntent: ActionIntent.WRITE_FILE,
          toolName: 'filesystem',
          approvalRequired: true,
          approvalStatus: 'pending',
          researchSummary: 'Filesystem mutation requires human approval.'
        };
      },
      async execute(state) {
        executeCalls.push('execute');
        return state;
      },
      async finish(state) {
        return {
          ...state,
          currentStep: 'finish',
          finalAnswer: 'Approval required before continuing.'
        };
      }
    }).compile();

    const result = await graph.invoke(createInitialState('task-runtime-approval-1', 'write a guarded file'));
    const checkpoint = ChatCheckpointRecordSchema.parse({
      checkpointId: 'checkpoint-runtime-approval-1',
      sessionId: 'session-runtime-approval-1',
      taskId: result.taskId,
      recoverability: 'partial',
      createdAt: NOW,
      updatedAt: NOW,
      traceCursor: 0,
      messageCursor: 0,
      approvalCursor: 0,
      learningCursor: 0,
      graphState: {
        status: TaskStatus.WAITING_APPROVAL,
        currentStep: result.currentStep,
        retryCount: result.retryCount,
        maxRetries: result.maxRetries
      },
      pendingApprovals: [
        {
          taskId: result.taskId,
          intent: ActionIntent.WRITE_FILE,
          reason: result.researchSummary,
          decision: 'pending',
          decidedAt: NOW
        }
      ],
      agentStates: [],
      pendingApproval: {
        toolName: result.toolName,
        intent: result.toolIntent,
        requestedBy: 'runtime-main-graph',
        reason: result.researchSummary,
        riskLevel: 'high'
      }
    });

    expect(executeCalls).toEqual([]);
    expect(result.approvalStatus).toBe('pending');
    expect(checkpoint.graphState.status).toBe(TaskStatus.WAITING_APPROVAL);
    expect(checkpoint.pendingApprovals[0]?.decision).toBe('pending');
    expect(checkpoint.pendingApproval?.toolName).toBe('filesystem');
  });
});
