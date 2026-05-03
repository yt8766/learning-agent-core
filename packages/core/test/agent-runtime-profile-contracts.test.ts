import { describe, expect, it } from 'vitest';
import {
  AgentRuntimeLevelSchema,
  AgentRuntimeProfileSchema,
  PermissionProfileSchema
} from '../src/tasking/schemas/agent-runtime-profile';

describe('Agent Runtime Profile contracts', () => {
  it('parses a composable coder profile', () => {
    const parsed = AgentRuntimeProfileSchema.parse({
      descriptor: {
        agentId: 'coder',
        role: 'coder',
        level: 3,
        description: 'Code implementation agent',
        capabilities: ['code.edit', 'test.run']
      },
      contextAccess: {
        readableKinds: ['task', 'plan', 'rule', 'evidence', 'tool_result'],
        writableKinds: ['tool_result'],
        memoryViewScopes: ['task', 'project'],
        maxContextTokens: 12000
      },
      syscall: {
        resource: ['read_file', 'search_knowledge'],
        mutation: ['apply_patch'],
        execution: ['run_test'],
        external: [],
        controlPlane: ['request_agent'],
        runtime: ['create_checkpoint']
      },
      permission: {
        allowedActions: ['read', 'write', 'execute'],
        allowedAssetScopes: ['workspace', 'artifact'],
        allowedEnvironments: ['sandbox', 'workspace'],
        allowedDataClasses: ['public', 'internal'],
        maxBlastRadius: 'project',
        defaultApprovalPolicy: 'human'
      },
      resource: {
        tokenBudget: 120000,
        costBudgetUsd: 3,
        maxWallTimeMs: 900000,
        maxToolCalls: 60,
        maxConcurrentTasks: 1,
        modelClassAllowed: ['standard', 'premium']
      },
      observability: {
        decisionLog: true,
        rationaleSummary: true,
        toolTrace: true,
        evidence: true,
        audit: true,
        approvalHistory: true,
        stateTransitions: true
      },
      recovery: {
        checkpoint: true,
        resume: true,
        rollbackLocalState: true,
        compensateExternalEffects: false,
        sideEffectLedger: true
      },
      outputContract: {
        schemaName: 'CoderPatchOutput',
        schemaVersion: '1.0.0',
        parseStrategy: 'strict',
        compatPolicy: 'additive'
      }
    });

    expect(parsed.descriptor.agentId).toBe('coder');
    expect(parsed.permission.allowedDataClasses).toEqual(['public', 'internal']);
  });

  it('rejects invalid agent levels and non-positive resource budgets', () => {
    expect(() => AgentRuntimeLevelSchema.parse(5)).toThrow();
    expect(() =>
      PermissionProfileSchema.parse({
        allowedActions: ['read'],
        allowedAssetScopes: ['workspace'],
        allowedEnvironments: ['workspace'],
        allowedDataClasses: ['secret'],
        maxBlastRadius: 'project',
        defaultApprovalPolicy: 'none'
      })
    ).not.toThrow();
  });
});
