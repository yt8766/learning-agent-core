import {
  ExecutionNodeRecordSchema,
  ExecutionPolicyDecisionRecordSchema,
  ExecutionRequestRecordSchema,
  ExecutionResultRecordSchema
} from '@agent/core';
import { describe, expect, it } from 'vitest';

import {
  createExecutionPolicyDecision,
  createExecutionRequest,
  createExecutionResult,
  findExecutionNode,
  listDefaultExecutionNodes,
  normalizeExecutionRiskClass
} from '../src/flows/execution-fabric';

const fixedNow = () => '2026-04-26T00:00:00.000Z';
const deterministicId = (prefix: string) => `${prefix}_fixed`;

describe('execution fabric flow helpers', () => {
  it('creates pending execution requests with medium risk by default', () => {
    const request = createExecutionRequest(
      {
        taskId: 'task_1',
        nodeId: 'execution_node_local_terminal',
        toolName: 'terminal.exec',
        requestedBy: { actor: 'supervisor', actorId: 'supervisor_1' }
      },
      { now: fixedNow, createId: deterministicId }
    );

    expect(request).toMatchObject({
      requestId: 'exec_req_fixed',
      taskId: 'task_1',
      nodeId: 'execution_node_local_terminal',
      toolName: 'terminal.exec',
      riskClass: 'medium',
      status: 'pending_policy',
      createdAt: '2026-04-26T00:00:00.000Z'
    });
    expect(ExecutionRequestRecordSchema.parse(request)).toEqual(request);
  });

  it.each([
    ['allow', false],
    ['require_approval', true],
    ['deny', false]
  ] as const)('maps %s policy decisions to requiresApproval=%s', (decision, requiresApproval) => {
    const policyDecision = createExecutionPolicyDecision(
      {
        requestId: 'exec_req_1',
        decision,
        reasonCode: 'matched_policy',
        reason: 'Policy matched the request risk.',
        riskClass: 'high'
      },
      { now: fixedNow, createId: deterministicId }
    );

    expect(policyDecision).toMatchObject({
      decisionId: 'exec_policy_fixed',
      requestId: 'exec_req_1',
      decision,
      matchedPolicyIds: [],
      requiresApproval,
      riskClass: 'high',
      createdAt: '2026-04-26T00:00:00.000Z'
    });
    expect(ExecutionPolicyDecisionRecordSchema.parse(policyDecision)).toEqual(policyDecision);
  });

  it('creates execution results with empty evidence and artifact defaults and duration', () => {
    const result = createExecutionResult(
      {
        requestId: 'exec_req_1',
        taskId: 'task_1',
        nodeId: 'execution_node_local_terminal',
        status: 'succeeded',
        startedAt: '2026-04-26T00:00:00.000Z',
        finishedAt: '2026-04-26T00:00:01.250Z'
      },
      { now: fixedNow, createId: deterministicId }
    );

    expect(result).toMatchObject({
      resultId: 'exec_result_fixed',
      requestId: 'exec_req_1',
      taskId: 'task_1',
      nodeId: 'execution_node_local_terminal',
      status: 'succeeded',
      artifactIds: [],
      evidenceIds: [],
      durationMs: 1250,
      createdAt: '2026-04-26T00:00:00.000Z'
    });
    expect(ExecutionResultRecordSchema.parse(result)).toEqual(result);
  });

  it('normalizes unknown execution risk classes to medium', () => {
    expect(normalizeExecutionRiskClass()).toBe('medium');
    expect(normalizeExecutionRiskClass(null)).toBe('medium');
    expect(normalizeExecutionRiskClass('unknown')).toBe('medium');
    expect(normalizeExecutionRiskClass('critical')).toBe('critical');
  });

  it('lists default execution nodes and finds the local terminal node', () => {
    const nodes = listDefaultExecutionNodes({ now: fixedNow });

    expect(nodes).toHaveLength(3);
    expect(nodes.map(node => ExecutionNodeRecordSchema.parse(node))).toEqual(nodes);

    const localTerminal = findExecutionNode('execution_node_local_terminal', nodes);

    expect(localTerminal).toMatchObject({
      nodeId: 'execution_node_local_terminal',
      kind: 'local_terminal',
      displayName: 'Local terminal'
    });
  });
});
