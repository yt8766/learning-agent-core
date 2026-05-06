import { describe, expect, it } from 'vitest';
import {
  AgentRuntimeLevelSchema,
  AgentRuntimeProfileSchema,
  PermissionProfileSchema
} from '../src/tasking/schemas/agent-runtime-profile';
import {
  ContextManifestSchema,
  ContextPageSchema,
  MissingContextSignalSchema
} from '../src/tasking/schemas/agent-runtime-context';
import { PolicyDecisionSchema, ToolRequestSchema } from '../src/tasking/schemas/agent-runtime-syscall';
import { QualityGateResultSchema, QualityGateSchema } from '../src/tasking/schemas/agent-runtime-quality';
import { AgentRuntimeTaskProjectionSchema } from '../src/tasking/schemas/agent-runtime-projection';

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

describe('Agent Runtime governance contracts', () => {
  it('parses structured context pages and manifests', () => {
    const page = ContextPageSchema.parse({
      id: 'ctx-1',
      kind: 'evidence',
      authority: 'verified',
      trustLevel: 'high',
      freshness: 'current',
      scope: 'task',
      sourceRefs: ['evidence:ev-1'],
      evidenceRefs: ['ev-1'],
      tokenCost: 120,
      readonly: true,
      payload: {
        summary: 'Tests passed',
        dataRef: 'evidence:ev-1'
      }
    });

    const manifest = ContextManifestSchema.parse({
      bundleId: 'bundle-1',
      taskId: 'task-1',
      agentId: 'coder',
      createdAt: '2026-05-03T08:00:00.000Z',
      loadedPages: [
        {
          pageId: page.id,
          kind: page.kind,
          reason: 'Verified evidence for current task',
          tokenCost: page.tokenCost,
          authority: page.authority,
          trustLevel: page.trustLevel
        }
      ],
      omittedPages: [
        {
          pageId: 'ctx-stale',
          reason: 'stale'
        }
      ],
      totalTokenCost: 120
    });

    expect(manifest.loadedPages[0]?.pageId).toBe('ctx-1');
  });

  it('parses blocking and non-blocking missing context signals', () => {
    const parsed = MissingContextSignalSchema.parse({
      kind: 'missing_context',
      taskId: 'task-1',
      agentId: 'coder',
      requested: [
        {
          contextKind: 'contract',
          query: 'AgentOS ToolRequest schema',
          reason: 'Need stable syscall contract before implementation',
          blocking: true,
          expectedAuthority: 'project'
        },
        {
          contextKind: 'docs',
          query: 'Prior AgentOS notes',
          reason: 'Helpful but not blocking',
          blocking: false
        }
      ]
    });

    expect(parsed.requested.map(request => request.blocking)).toEqual([true, false]);
  });

  it('keeps approval decisions on PolicyDecision instead of ToolRequest', () => {
    const request = ToolRequestSchema.parse({
      requestId: 'tool-1',
      taskId: 'task-1',
      agentId: 'coder',
      syscallType: 'mutation',
      toolName: 'apply_patch',
      intent: 'Update runtime contract',
      args: { files: ['packages/core/src/tasking/schemas/agent-runtime-context.ts'] },
      agentRiskHint: {
        action: 'write',
        assetScope: ['workspace'],
        environment: 'workspace',
        dataClasses: ['internal'],
        blastRadius: 'project'
      },
      expectedEvidence: ['patch_applied']
    });

    const decision = PolicyDecisionSchema.parse({
      decision: 'needs_approval',
      reason: 'Workspace source write requires human approval for this profile',
      decidedBy: 'permission_service',
      requiredApprovalPolicy: 'human',
      normalizedRisk: {
        action: 'write',
        assetScope: ['workspace'],
        environment: 'workspace',
        dataClasses: ['internal'],
        blastRadius: 'project',
        level: 'medium'
      }
    });

    expect('approvalRequired' in request).toBe(false);
    expect(decision.decision).toBe('needs_approval');
  });

  it('rejects non-canonical normalized risk values on policy decisions', () => {
    const validPolicyDecision = {
      decision: 'needs_approval',
      reason: 'Risk values must use the stable runtime taxonomy',
      decidedBy: 'permission_service',
      requiredApprovalPolicy: 'human',
      normalizedRisk: {
        action: 'write',
        assetScope: ['workspace'],
        environment: 'workspace',
        dataClasses: ['internal'],
        blastRadius: 'project',
        level: 'high'
      }
    };

    const cases = [
      {
        name: 'invalid action',
        normalizedRisk: {
          ...validPolicyDecision.normalizedRisk,
          action: 'filesystem-write'
        }
      },
      {
        name: 'invalid environment',
        normalizedRisk: {
          ...validPolicyDecision.normalizedRisk,
          environment: 'prod'
        }
      },
      {
        name: 'invalid dataClasses',
        normalizedRisk: {
          ...validPolicyDecision.normalizedRisk,
          dataClasses: ['private_data']
        }
      },
      {
        name: 'invalid blastRadius',
        normalizedRisk: {
          ...validPolicyDecision.normalizedRisk,
          blastRadius: 'global'
        }
      }
    ];

    for (const { name, normalizedRisk } of cases) {
      const result = PolicyDecisionSchema.safeParse({
        ...validPolicyDecision,
        normalizedRisk
      });

      expect(result.success, name).toBe(false);
    }
  });

  it('parses quality gates and task projections', () => {
    const gate = QualityGateSchema.parse({
      gateId: 'schema-output',
      hook: 'post_action',
      requiredForRisk: ['low', 'medium', 'high', 'critical'],
      evaluator: 'schema',
      onFail: 'block'
    });

    const result = QualityGateResultSchema.parse({
      gateId: gate.gateId,
      status: 'passed',
      evaluatedAt: '2026-05-03T08:00:00.000Z',
      evidenceRefs: ['ev-1']
    });

    const projection = AgentRuntimeTaskProjectionSchema.parse({
      taskId: 'task-1',
      currentAgentId: 'coder',
      governancePhase: 'quality_checking',
      selectedProfileId: 'coder.workspace.standard',
      contextManifestSummary: {
        bundleId: 'bundle-1',
        loadedPageCount: 1,
        omittedPageCount: 1,
        totalTokenCost: 120
      },
      latestPolicyDecision: {
        decision: 'allow',
        reason: 'Low risk read',
        decidedBy: 'permission_service',
        normalizedRisk: {
          action: 'read',
          assetScope: ['docs'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local',
          level: 'low'
        }
      },
      qualityGateResults: [result],
      evidenceRefs: ['ev-1'],
      budgetSummary: {
        tokenBudget: 120000,
        tokensUsed: 1000,
        costBudgetUsd: 3,
        costUsedUsd: 0.05
      },
      sideEffectSummary: {
        total: 0,
        reversible: 0,
        compensated: 0
      }
    });

    expect(projection.governancePhase).toBe('quality_checking');
  });
});
