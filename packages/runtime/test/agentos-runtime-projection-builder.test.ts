import { describe, expect, it } from 'vitest';
import { buildAgentRuntimeTaskProjection } from '../src/runtime/agentos';
import { AgentRuntimeTaskProjectionSchema } from '@agent/core';
import type { ContextManifest } from '@agent/core';

describe('buildAgentRuntimeTaskProjection', () => {
  it('summarizes context manifest, policy, gates, budget, and side effects', () => {
    const projection = buildAgentRuntimeTaskProjection({
      taskId: 'task-1',
      currentAgentId: 'coder',
      governancePhase: 'quality_checking',
      selectedProfileId: 'coder.workspace.standard',
      contextManifest: {
        bundleId: 'bundle-1',
        taskId: 'task-1',
        agentId: 'coder',
        createdAt: '2026-05-03T08:00:00.000Z',
        loadedPages: [
          {
            pageId: 'ctx-1',
            kind: 'task',
            reason: 'current task',
            tokenCost: 100,
            authority: 'user',
            trustLevel: 'high'
          }
        ],
        omittedPages: [{ pageId: 'ctx-2', reason: 'token_budget' }],
        totalTokenCost: 100
      },
      latestPolicyDecision: {
        decision: 'allow',
        reason: 'Allowed',
        decidedBy: 'permission_service',
        normalizedRisk: {
          action: 'read',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local',
          level: 'low'
        }
      },
      qualityGateResults: [
        {
          gateId: 'schema-output',
          status: 'passed',
          evaluatedAt: '2026-05-03T08:00:00.000Z',
          evidenceRefs: ['ev-1']
        }
      ],
      evidenceRefs: ['ev-1'],
      budgetSummary: {
        tokenBudget: 120000,
        tokensUsed: 100,
        costBudgetUsd: 3,
        costUsedUsd: 0.01
      },
      sideEffects: [
        { reversible: true, compensated: false },
        { reversible: false, compensated: true }
      ]
    });

    expect(projection.contextManifestSummary).toEqual({
      bundleId: 'bundle-1',
      loadedPageCount: 1,
      omittedPageCount: 1,
      totalTokenCost: 100
    });
    expect(projection.sideEffectSummary).toEqual({ total: 2, reversible: 1, compensated: 1 });
  });

  it('normalizes optional manifest defaults through the stable projection schema', () => {
    const projection = buildAgentRuntimeTaskProjection({
      taskId: 'task-1',
      governancePhase: 'context_loading',
      contextManifest: {
        bundleId: 'bundle-1',
        taskId: 'task-1',
        agentId: 'coder',
        createdAt: '2026-05-03T08:00:00.000Z',
        totalTokenCost: 0
      } as ContextManifest
    });

    expect(AgentRuntimeTaskProjectionSchema.parse(projection)).toEqual(projection);
    expect(projection.contextManifestSummary).toEqual({
      bundleId: 'bundle-1',
      loadedPageCount: 0,
      omittedPageCount: 0,
      totalTokenCost: 0
    });
  });

  it('does not leak extra runtime fields or mutable input references', () => {
    const evidenceRefs = ['ev-1'];
    const projection = buildAgentRuntimeTaskProjection({
      taskId: 'task-1',
      governancePhase: 'policy_checking',
      latestPolicyDecision: {
        decision: 'allow',
        reason: 'Allowed',
        decidedBy: 'permission_service',
        normalizedRisk: {
          action: 'read',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local',
          level: 'low'
        },
        rawRuntimeState: 'must-not-leak'
      } as never,
      qualityGateResults: [
        {
          gateId: 'schema-output',
          status: 'passed',
          evaluatedAt: '2026-05-03T08:00:00.000Z',
          evidenceRefs: ['ev-1'],
          rawRuntimeState: 'must-not-leak'
        } as never
      ],
      evidenceRefs,
      budgetSummary: {
        tokenBudget: 120000,
        tokensUsed: 100,
        costBudgetUsd: 3,
        costUsedUsd: 0.01,
        rawRuntimeState: 'must-not-leak'
      } as never
    });

    evidenceRefs.push('ev-2');

    expect(projection.evidenceRefs).toEqual(['ev-1']);
    expect(JSON.stringify(projection)).not.toContain('rawRuntimeState');
  });
});
