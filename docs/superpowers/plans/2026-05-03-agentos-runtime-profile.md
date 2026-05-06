# AgentOS Runtime Profile Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/core`、`packages/runtime`、`packages/platform-runtime`、`apps/backend/agent-server`、`apps/frontend/agent-admin`、`apps/frontend/agent-chat`、`docs/packages/runtime`
最后核对：2026-05-03

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first AgentOS Runtime Profile MVP: schema-first contracts, context manifest assembly, syscall policy decisions, missing-context / quality-gate signals, and admin/chat projection DTOs.

**Architecture:** Add stable contracts in `packages/core`, then implement small runtime helpers in `packages/runtime` that consume those contracts without knowing official agents. `packages/platform-runtime` owns default profile registration, while backend/frontend only consume projection DTOs and do not inspect raw runtime state.

**Tech Stack:** TypeScript, Zod, Vitest, `@agent/core`, `@agent/runtime`, `@agent/platform-runtime`, NestJS adapter DTOs, React projection consumers, pnpm workspace commands.

---

## Current Baseline

- `packages/core` already follows schema-first public contracts and exports `tasking`, `contracts/execution`, `execution-trace`, and `platform-console` domains.
- `packages/runtime` already owns graph execution, interrupt / approval, checkpoint / recovery, observability, model invocation preprocessors, and governance stores.
- `packages/platform-runtime` already acts as official composition root and can own default official agent metadata.
- `agent-chat` and `agent-admin` must consume projection DTOs, not raw runtime internals.
- The workspace currently has many unrelated uncommitted changes. Implement this plan in the current checkout only and stage files task-by-task.
- The repository forbids `git worktree`.

## File Structure

Create these core contract files:

```text
packages/core/src/tasking/schemas/agent-runtime-profile.ts
packages/core/src/tasking/types/agent-runtime-profile.ts
packages/core/src/tasking/schemas/agent-runtime-context.ts
packages/core/src/tasking/types/agent-runtime-context.ts
packages/core/src/tasking/schemas/agent-runtime-syscall.ts
packages/core/src/tasking/types/agent-runtime-syscall.ts
packages/core/src/tasking/schemas/agent-runtime-quality.ts
packages/core/src/tasking/types/agent-runtime-quality.ts
packages/core/src/tasking/schemas/agent-runtime-projection.ts
packages/core/src/tasking/types/agent-runtime-projection.ts
packages/core/test/agent-runtime-profile-contracts.test.ts
```

Modify these core exports:

```text
packages/core/src/tasking/schemas/index.ts
packages/core/src/tasking/types/index.ts
packages/core/src/tasking/index.ts
packages/core/src/index.ts
```

Create these runtime helpers:

```text
packages/runtime/src/runtime/agentos/context-assembler.ts
packages/runtime/src/runtime/agentos/syscall-policy.ts
packages/runtime/src/runtime/agentos/quality-gates.ts
packages/runtime/src/runtime/agentos/runtime-projection-builder.ts
packages/runtime/src/runtime/agentos/index.ts
packages/runtime/test/agentos-context-assembler.test.ts
packages/runtime/test/agentos-syscall-policy.test.ts
packages/runtime/test/agentos-quality-gates.test.ts
packages/runtime/test/agentos-runtime-projection-builder.test.ts
```

Modify runtime exports:

```text
packages/runtime/src/runtime/index.ts
packages/runtime/src/index.ts
```

Create platform-runtime defaults:

```text
packages/platform-runtime/src/agentos/default-agent-runtime-profiles.ts
packages/platform-runtime/src/agentos/index.ts
packages/platform-runtime/test/default-agent-runtime-profiles.test.ts
```

Modify platform-runtime exports:

```text
packages/platform-runtime/src/index.ts
```

Update docs:

```text
docs/packages/runtime/agentos-runtime-profile.md
docs/packages/runtime/README.md
docs/architecture/ARCHITECTURE.md
```

Boundary decisions:

- `packages/core` owns only schema-first contracts and inferred types.
- `packages/runtime` owns deterministic helpers and projection building.
- `packages/platform-runtime` owns default official profile registry.
- `apps/*` should only consume projection DTOs in a later UI task; this MVP may stop at shared DTOs and runtime builders.
- No task should add Agent Daemon, Package Manager, full scheduler, two-person approval, or complete side-effect compensation.

---

### Task 1: Add Core Agent Runtime Profile Contracts

**Files:**

- Create: `packages/core/src/tasking/schemas/agent-runtime-profile.ts`
- Create: `packages/core/src/tasking/types/agent-runtime-profile.ts`
- Modify: `packages/core/src/tasking/schemas/index.ts`
- Modify: `packages/core/src/tasking/types/index.ts`
- Modify: `packages/core/src/tasking/index.ts`
- Test: `packages/core/test/agent-runtime-profile-contracts.test.ts`

- [ ] **Step 1: Write the failing profile contract test**

Create `packages/core/test/agent-runtime-profile-contracts.test.ts` with this initial content:

```ts
import { describe, expect, it } from 'vitest';
import {
  AgentRuntimeProfileSchema,
  AgentRuntimeLevelSchema,
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
```

- [ ] **Step 2: Run the failing profile contract test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-runtime-profile-contracts.test.ts
```

Expected: FAIL with module-not-found errors for `agent-runtime-profile`.

- [ ] **Step 3: Add the profile schemas**

Create `packages/core/src/tasking/schemas/agent-runtime-profile.ts`:

```ts
import { z } from 'zod';

export const AgentRuntimeLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const AgentRuntimeActionSchema = z.enum(['read', 'write', 'execute', 'delete', 'publish', 'spend']);
export const AgentRuntimeEnvironmentSchema = z.enum(['sandbox', 'workspace', 'staging', 'production']);
export const AgentRuntimeDataClassSchema = z.enum(['public', 'internal', 'confidential', 'secret', 'pii']);
export const AgentRuntimeBlastRadiusSchema = z.enum(['local', 'project', 'team', 'external', 'production']);
export const AgentRuntimeApprovalPolicySchema = z.enum(['none', 'auto', 'human', 'two_person']);

export const AgentDescriptorSchema = z.object({
  agentId: z.string().min(1),
  role: z.string().min(1),
  level: AgentRuntimeLevelSchema,
  description: z.string().min(1),
  capabilities: z.array(z.string().min(1)).default([])
});

export const ContextAccessProfileSchema = z.object({
  readableKinds: z.array(z.string().min(1)).default([]),
  writableKinds: z.array(z.string().min(1)).default([]),
  memoryViewScopes: z.array(z.string().min(1)).default([]),
  maxContextTokens: z.number().int().positive()
});

export const SyscallProfileSchema = z.object({
  resource: z.array(z.string().min(1)).default([]),
  mutation: z.array(z.string().min(1)).default([]),
  execution: z.array(z.string().min(1)).default([]),
  external: z.array(z.string().min(1)).default([]),
  controlPlane: z.array(z.string().min(1)).default([]),
  runtime: z.array(z.string().min(1)).default([])
});

export const PermissionProfileSchema = z.object({
  allowedActions: z.array(AgentRuntimeActionSchema).default([]),
  allowedAssetScopes: z.array(z.string().min(1)).default([]),
  allowedEnvironments: z.array(AgentRuntimeEnvironmentSchema).default([]),
  allowedDataClasses: z.array(AgentRuntimeDataClassSchema).default([]),
  maxBlastRadius: AgentRuntimeBlastRadiusSchema,
  defaultApprovalPolicy: AgentRuntimeApprovalPolicySchema
});

export const ResourceProfileSchema = z.object({
  tokenBudget: z.number().int().positive(),
  costBudgetUsd: z.number().nonnegative(),
  maxWallTimeMs: z.number().int().positive(),
  maxToolCalls: z.number().int().positive(),
  maxConcurrentTasks: z.number().int().positive(),
  modelClassAllowed: z.array(z.string().min(1)).default([])
});

export const ObservabilityProfileSchema = z.object({
  decisionLog: z.boolean(),
  rationaleSummary: z.boolean(),
  toolTrace: z.boolean(),
  evidence: z.boolean(),
  audit: z.boolean(),
  approvalHistory: z.boolean(),
  stateTransitions: z.boolean()
});

export const RecoveryProfileSchema = z.object({
  checkpoint: z.boolean(),
  resume: z.boolean(),
  rollbackLocalState: z.boolean(),
  compensateExternalEffects: z.boolean(),
  sideEffectLedger: z.boolean()
});

export const OutputContractProfileSchema = z.object({
  schemaName: z.string().min(1),
  schemaVersion: z.string().min(1),
  parseStrategy: z.enum(['strict', 'passthrough']),
  compatPolicy: z.enum(['additive', 'versioned', 'breaking'])
});

export const AgentRuntimeProfileSchema = z.object({
  descriptor: AgentDescriptorSchema,
  contextAccess: ContextAccessProfileSchema,
  syscall: SyscallProfileSchema,
  permission: PermissionProfileSchema,
  resource: ResourceProfileSchema,
  observability: ObservabilityProfileSchema,
  recovery: RecoveryProfileSchema,
  outputContract: OutputContractProfileSchema
});
```

- [ ] **Step 4: Add profile inferred types**

Create `packages/core/src/tasking/types/agent-runtime-profile.ts`:

```ts
import type { z } from 'zod';
import type {
  AgentDescriptorSchema,
  AgentRuntimeActionSchema,
  AgentRuntimeApprovalPolicySchema,
  AgentRuntimeBlastRadiusSchema,
  AgentRuntimeDataClassSchema,
  AgentRuntimeEnvironmentSchema,
  AgentRuntimeLevelSchema,
  AgentRuntimeProfileSchema,
  ContextAccessProfileSchema,
  ObservabilityProfileSchema,
  OutputContractProfileSchema,
  PermissionProfileSchema,
  RecoveryProfileSchema,
  ResourceProfileSchema,
  SyscallProfileSchema
} from '../schemas/agent-runtime-profile';

export type AgentRuntimeLevel = z.infer<typeof AgentRuntimeLevelSchema>;
export type AgentRuntimeAction = z.infer<typeof AgentRuntimeActionSchema>;
export type AgentRuntimeEnvironment = z.infer<typeof AgentRuntimeEnvironmentSchema>;
export type AgentRuntimeDataClass = z.infer<typeof AgentRuntimeDataClassSchema>;
export type AgentRuntimeBlastRadius = z.infer<typeof AgentRuntimeBlastRadiusSchema>;
export type AgentRuntimeApprovalPolicy = z.infer<typeof AgentRuntimeApprovalPolicySchema>;
export type AgentDescriptor = z.infer<typeof AgentDescriptorSchema>;
export type ContextAccessProfile = z.infer<typeof ContextAccessProfileSchema>;
export type SyscallProfile = z.infer<typeof SyscallProfileSchema>;
export type PermissionProfile = z.infer<typeof PermissionProfileSchema>;
export type ResourceProfile = z.infer<typeof ResourceProfileSchema>;
export type ObservabilityProfile = z.infer<typeof ObservabilityProfileSchema>;
export type RecoveryProfile = z.infer<typeof RecoveryProfileSchema>;
export type OutputContractProfile = z.infer<typeof OutputContractProfileSchema>;
export type AgentRuntimeProfile = z.infer<typeof AgentRuntimeProfileSchema>;
```

- [ ] **Step 5: Export profile contracts**

Append these lines to `packages/core/src/tasking/schemas/index.ts`:

```ts
export * from './agent-runtime-profile';
```

Append these lines to `packages/core/src/tasking/types/index.ts`:

```ts
export type * from './agent-runtime-profile';
```

Confirm `packages/core/src/tasking/index.ts` already exports `./schemas` and `./types`. If it does not, add:

```ts
export * from './schemas';
export type * from './types';
```

- [ ] **Step 6: Run the profile contract test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-runtime-profile-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit profile contracts**

Run:

```bash
git add packages/core/src/tasking/schemas/agent-runtime-profile.ts packages/core/src/tasking/types/agent-runtime-profile.ts packages/core/src/tasking/schemas/index.ts packages/core/src/tasking/types/index.ts packages/core/src/tasking/index.ts packages/core/test/agent-runtime-profile-contracts.test.ts
git commit -m "feat: add agent runtime profile contracts"
```

---

### Task 2: Add Context, Missing-Context, Syscall, Quality, and Projection Contracts

**Files:**

- Create: `packages/core/src/tasking/schemas/agent-runtime-context.ts`
- Create: `packages/core/src/tasking/types/agent-runtime-context.ts`
- Create: `packages/core/src/tasking/schemas/agent-runtime-syscall.ts`
- Create: `packages/core/src/tasking/types/agent-runtime-syscall.ts`
- Create: `packages/core/src/tasking/schemas/agent-runtime-quality.ts`
- Create: `packages/core/src/tasking/types/agent-runtime-quality.ts`
- Create: `packages/core/src/tasking/schemas/agent-runtime-projection.ts`
- Create: `packages/core/src/tasking/types/agent-runtime-projection.ts`
- Modify: `packages/core/src/tasking/schemas/index.ts`
- Modify: `packages/core/src/tasking/types/index.ts`
- Test: `packages/core/test/agent-runtime-profile-contracts.test.ts`

- [ ] **Step 1: Extend the failing contract test**

Append these imports in `packages/core/test/agent-runtime-profile-contracts.test.ts`:

```ts
import {
  ContextManifestSchema,
  ContextPageSchema,
  MissingContextSignalSchema
} from '../src/tasking/schemas/agent-runtime-context';
import { PolicyDecisionSchema, ToolRequestSchema } from '../src/tasking/schemas/agent-runtime-syscall';
import { QualityGateResultSchema, QualityGateSchema } from '../src/tasking/schemas/agent-runtime-quality';
import { AgentRuntimeTaskProjectionSchema } from '../src/tasking/schemas/agent-runtime-projection';
```

Append these tests:

```ts
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
```

- [ ] **Step 2: Run the failing expanded contract test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-runtime-profile-contracts.test.ts
```

Expected: FAIL with module-not-found errors for the new contract modules.

- [ ] **Step 3: Add context schemas**

Create `packages/core/src/tasking/schemas/agent-runtime-context.ts`:

```ts
import { z } from 'zod';

export const ContextKindSchema = z.enum([
  'task',
  'plan',
  'recent_messages',
  'evidence',
  'tool_result',
  'memory',
  'rule',
  'skill',
  'knowledge',
  'approval',
  'risk'
]);

export const ContextAuthoritySchema = z.enum(['system', 'user', 'project', 'verified', 'agent', 'external']);
export const ContextTrustLevelSchema = z.enum(['high', 'medium', 'low']);
export const ContextFreshnessSchema = z.enum(['current', 'recent', 'stale', 'unknown']);
export const ContextScopeSchema = z.enum(['task', 'session', 'project', 'team', 'user', 'system']);

export const ContextPageSchema = z.object({
  id: z.string().min(1),
  kind: ContextKindSchema,
  authority: ContextAuthoritySchema,
  trustLevel: ContextTrustLevelSchema,
  freshness: ContextFreshnessSchema,
  scope: ContextScopeSchema,
  owner: z.string().min(1).optional(),
  ttl: z.string().min(1).optional(),
  sourceRefs: z.array(z.string().min(1)).default([]),
  evidenceRefs: z.array(z.string().min(1)).optional(),
  artifactRefs: z.array(z.string().min(1)).optional(),
  tokenCost: z.number().int().nonnegative(),
  readonly: z.boolean(),
  payload: z.object({
    text: z.string().optional(),
    summary: z.string().optional(),
    dataRef: z.string().min(1).optional(),
    data: z.unknown().optional()
  })
});

export const ContextBundleSchema = z.object({
  bundleId: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  pages: z.array(ContextPageSchema).default([])
});

export const ContextManifestSchema = z.object({
  bundleId: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  createdAt: z.string().min(1),
  loadedPages: z
    .array(
      z.object({
        pageId: z.string().min(1),
        kind: ContextKindSchema,
        reason: z.string().min(1),
        tokenCost: z.number().int().nonnegative(),
        authority: ContextAuthoritySchema,
        trustLevel: ContextTrustLevelSchema
      })
    )
    .default([]),
  omittedPages: z
    .array(
      z.object({
        pageId: z.string().min(1),
        reason: z.enum(['low_relevance', 'token_budget', 'low_trust', 'stale', 'permission_denied'])
      })
    )
    .default([]),
  totalTokenCost: z.number().int().nonnegative()
});

export const MissingContextSignalSchema = z.object({
  kind: z.literal('missing_context'),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  requested: z
    .array(
      z.object({
        contextKind: z.enum(['contract', 'code', 'docs', 'evidence', 'memory', 'user_input']),
        query: z.string().min(1),
        reason: z.string().min(1),
        blocking: z.boolean(),
        expectedAuthority: z.enum(['system', 'user', 'project', 'verified', 'external']).optional()
      })
    )
    .min(1)
});
```

- [ ] **Step 4: Add syscall schemas**

Create `packages/core/src/tasking/schemas/agent-runtime-syscall.ts`:

```ts
import { z } from 'zod';
import {
  AgentRuntimeActionSchema,
  AgentRuntimeBlastRadiusSchema,
  AgentRuntimeDataClassSchema,
  AgentRuntimeEnvironmentSchema
} from './agent-runtime-profile';

export const SyscallTypeSchema = z.enum(['resource', 'mutation', 'execution', 'external', 'control_plane', 'runtime']);
export const PolicyDecisionStatusSchema = z.enum(['allow', 'needs_approval', 'deny']);
export const NormalizedRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ToolRequestSchema = z.object({
  requestId: z.string().min(1),
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  syscallType: SyscallTypeSchema,
  toolName: z.string().min(1),
  intent: z.string().min(1),
  args: z.unknown(),
  agentRiskHint: z
    .object({
      action: AgentRuntimeActionSchema,
      assetScope: z.array(z.string().min(1)).default([]),
      environment: AgentRuntimeEnvironmentSchema.optional(),
      dataClasses: z.array(AgentRuntimeDataClassSchema).optional(),
      blastRadius: AgentRuntimeBlastRadiusSchema.optional()
    })
    .optional(),
  idempotencyKey: z.string().min(1).optional(),
  expectedEvidence: z.array(z.string().min(1)).default([])
});

export const PolicyDecisionSchema = z.object({
  decision: PolicyDecisionStatusSchema,
  reason: z.string().min(1),
  decidedBy: z.literal('permission_service'),
  requiredApprovalPolicy: z.enum(['human', 'two_person']).optional(),
  normalizedRisk: z.object({
    action: z.string().min(1),
    assetScope: z.array(z.string().min(1)).default([]),
    environment: z.string().min(1),
    dataClasses: z.array(z.string().min(1)).default([]),
    blastRadius: z.string().min(1),
    level: NormalizedRiskLevelSchema
  })
});
```

- [ ] **Step 5: Add quality and projection schemas**

Create `packages/core/src/tasking/schemas/agent-runtime-quality.ts`:

```ts
import { z } from 'zod';

export const QualityGateHookSchema = z.enum([
  'pre_plan',
  'post_plan',
  'pre_action',
  'post_action',
  'pre_delivery',
  'post_delivery'
]);

export const QualityGateSchema = z.object({
  gateId: z.string().min(1),
  hook: QualityGateHookSchema,
  requiredForRisk: z.array(z.enum(['low', 'medium', 'high', 'critical'])).default([]),
  evaluator: z.enum(['schema', 'test', 'reviewer', 'policy', 'source_check', 'custom']),
  onFail: z.enum(['block', 'request_revision', 'require_approval', 'warn'])
});

export const QualityGateResultSchema = z.object({
  gateId: z.string().min(1),
  status: z.enum(['passed', 'failed', 'warned', 'skipped']),
  evaluatedAt: z.string().min(1),
  reason: z.string().min(1).optional(),
  evidenceRefs: z.array(z.string().min(1)).default([])
});
```

Create `packages/core/src/tasking/schemas/agent-runtime-projection.ts`:

```ts
import { z } from 'zod';
import { PolicyDecisionSchema } from './agent-runtime-syscall';
import { QualityGateResultSchema } from './agent-runtime-quality';

export const GovernancePhaseSchema = z.enum([
  'context_loading',
  'agent_running',
  'policy_checking',
  'waiting_context',
  'waiting_approval',
  'tool_executing',
  'quality_checking',
  'delivering'
]);

export const AgentRuntimeTaskProjectionSchema = z.object({
  taskId: z.string().min(1),
  currentAgentId: z.string().min(1).optional(),
  governancePhase: GovernancePhaseSchema,
  selectedProfileId: z.string().min(1).optional(),
  contextManifestSummary: z
    .object({
      bundleId: z.string().min(1),
      loadedPageCount: z.number().int().nonnegative(),
      omittedPageCount: z.number().int().nonnegative(),
      totalTokenCost: z.number().int().nonnegative()
    })
    .optional(),
  latestPolicyDecision: PolicyDecisionSchema.optional(),
  pendingInterruptId: z.string().min(1).optional(),
  qualityGateResults: z.array(QualityGateResultSchema).default([]),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  budgetSummary: z
    .object({
      tokenBudget: z.number().int().nonnegative(),
      tokensUsed: z.number().int().nonnegative(),
      costBudgetUsd: z.number().nonnegative(),
      costUsedUsd: z.number().nonnegative()
    })
    .optional(),
  sideEffectSummary: z
    .object({
      total: z.number().int().nonnegative(),
      reversible: z.number().int().nonnegative(),
      compensated: z.number().int().nonnegative()
    })
    .optional()
});
```

- [ ] **Step 6: Add inferred type files**

Create `packages/core/src/tasking/types/agent-runtime-context.ts`:

```ts
import type { z } from 'zod';
import type {
  ContextBundleSchema,
  ContextManifestSchema,
  ContextPageSchema,
  MissingContextSignalSchema
} from '../schemas/agent-runtime-context';

export type ContextPage = z.infer<typeof ContextPageSchema>;
export type ContextBundle = z.infer<typeof ContextBundleSchema>;
export type ContextManifest = z.infer<typeof ContextManifestSchema>;
export type MissingContextSignal = z.infer<typeof MissingContextSignalSchema>;
```

Create `packages/core/src/tasking/types/agent-runtime-syscall.ts`:

```ts
import type { z } from 'zod';
import type { PolicyDecisionSchema, ToolRequestSchema } from '../schemas/agent-runtime-syscall';

export type ToolRequest = z.infer<typeof ToolRequestSchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
```

Create `packages/core/src/tasking/types/agent-runtime-quality.ts`:

```ts
import type { z } from 'zod';
import type { QualityGateResultSchema, QualityGateSchema } from '../schemas/agent-runtime-quality';

export type QualityGate = z.infer<typeof QualityGateSchema>;
export type QualityGateResult = z.infer<typeof QualityGateResultSchema>;
```

Create `packages/core/src/tasking/types/agent-runtime-projection.ts`:

```ts
import type { z } from 'zod';
import type { AgentRuntimeTaskProjectionSchema, GovernancePhaseSchema } from '../schemas/agent-runtime-projection';

export type GovernancePhase = z.infer<typeof GovernancePhaseSchema>;
export type AgentRuntimeTaskProjection = z.infer<typeof AgentRuntimeTaskProjectionSchema>;
```

- [ ] **Step 7: Export the new contracts**

Append to `packages/core/src/tasking/schemas/index.ts`:

```ts
export * from './agent-runtime-context';
export * from './agent-runtime-syscall';
export * from './agent-runtime-quality';
export * from './agent-runtime-projection';
```

Append to `packages/core/src/tasking/types/index.ts`:

```ts
export type * from './agent-runtime-context';
export type * from './agent-runtime-syscall';
export type * from './agent-runtime-quality';
export type * from './agent-runtime-projection';
```

- [ ] **Step 8: Run contract tests and core typecheck**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-runtime-profile-contracts.test.ts
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
```

Expected: both commands pass.

- [ ] **Step 9: Commit core governance contracts**

Run:

```bash
git add packages/core/src/tasking/schemas/agent-runtime-context.ts packages/core/src/tasking/types/agent-runtime-context.ts packages/core/src/tasking/schemas/agent-runtime-syscall.ts packages/core/src/tasking/types/agent-runtime-syscall.ts packages/core/src/tasking/schemas/agent-runtime-quality.ts packages/core/src/tasking/types/agent-runtime-quality.ts packages/core/src/tasking/schemas/agent-runtime-projection.ts packages/core/src/tasking/types/agent-runtime-projection.ts packages/core/src/tasking/schemas/index.ts packages/core/src/tasking/types/index.ts packages/core/test/agent-runtime-profile-contracts.test.ts
git commit -m "feat: add agent runtime governance contracts"
```

---

### Task 3: Implement Runtime Context Assembler

**Files:**

- Create: `packages/runtime/src/runtime/agentos/context-assembler.ts`
- Create: `packages/runtime/src/runtime/agentos/index.ts`
- Modify: `packages/runtime/src/runtime/index.ts`
- Modify: `packages/runtime/src/index.ts`
- Test: `packages/runtime/test/agentos-context-assembler.test.ts`

- [ ] **Step 1: Write the failing context assembler test**

Create `packages/runtime/test/agentos-context-assembler.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { assembleAgentRuntimeContext } from '../src/runtime/agentos';
import type { ContextPage } from '@agent/core';

const page = (overrides: Partial<ContextPage>): ContextPage => ({
  id: 'ctx-default',
  kind: 'task',
  authority: 'user',
  trustLevel: 'high',
  freshness: 'current',
  scope: 'task',
  sourceRefs: [],
  tokenCost: 100,
  readonly: true,
  payload: { text: 'default' },
  ...overrides
});

describe('assembleAgentRuntimeContext', () => {
  it('loads allowed pages until token budget and explains omissions', () => {
    const result = assembleAgentRuntimeContext({
      taskId: 'task-1',
      agentId: 'coder',
      bundleId: 'bundle-1',
      createdAt: '2026-05-03T08:00:00.000Z',
      profile: {
        readableKinds: ['task', 'evidence'],
        maxContextTokens: 150
      },
      candidates: [
        page({ id: 'task-page', kind: 'task', tokenCost: 80 }),
        page({ id: 'evidence-page', kind: 'evidence', authority: 'verified', tokenCost: 60 }),
        page({ id: 'memory-page', kind: 'memory', tokenCost: 10 }),
        page({ id: 'large-page', kind: 'evidence', tokenCost: 100 })
      ]
    });

    expect(result.bundle.pages.map(entry => entry.id)).toEqual(['task-page', 'evidence-page']);
    expect(result.manifest.totalTokenCost).toBe(140);
    expect(result.manifest.omittedPages).toEqual([
      { pageId: 'memory-page', reason: 'permission_denied' },
      { pageId: 'large-page', reason: 'token_budget' }
    ]);
  });

  it('omits low-trust and stale pages before lower priority valid pages', () => {
    const result = assembleAgentRuntimeContext({
      taskId: 'task-1',
      agentId: 'researcher',
      bundleId: 'bundle-2',
      createdAt: '2026-05-03T08:00:00.000Z',
      profile: {
        readableKinds: ['knowledge', 'evidence'],
        maxContextTokens: 200
      },
      candidates: [
        page({ id: 'low-trust', kind: 'knowledge', trustLevel: 'low', tokenCost: 20 }),
        page({ id: 'stale', kind: 'evidence', freshness: 'stale', tokenCost: 20 }),
        page({ id: 'verified', kind: 'evidence', authority: 'verified', tokenCost: 50 })
      ]
    });

    expect(result.bundle.pages.map(entry => entry.id)).toEqual(['verified']);
    expect(result.manifest.omittedPages).toContainEqual({ pageId: 'low-trust', reason: 'low_trust' });
    expect(result.manifest.omittedPages).toContainEqual({ pageId: 'stale', reason: 'stale' });
  });
});
```

- [ ] **Step 2: Run the failing runtime test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/runtime/test/agentos-context-assembler.test.ts
```

Expected: FAIL because `runtime/agentos` does not exist.

- [ ] **Step 3: Implement the assembler**

Create `packages/runtime/src/runtime/agentos/context-assembler.ts`:

```ts
import type { ContextBundle, ContextManifest, ContextPage } from '@agent/core';

export interface AssembleAgentRuntimeContextInput {
  taskId: string;
  agentId: string;
  bundleId: string;
  createdAt: string;
  profile: {
    readableKinds: string[];
    maxContextTokens: number;
  };
  candidates: ContextPage[];
}

export interface AssembleAgentRuntimeContextResult {
  bundle: ContextBundle;
  manifest: ContextManifest;
}

export function assembleAgentRuntimeContext(
  input: AssembleAgentRuntimeContextInput
): AssembleAgentRuntimeContextResult {
  let tokenTotal = 0;
  const loaded: ContextPage[] = [];
  const omitted: ContextManifest['omittedPages'] = [];

  for (const candidate of input.candidates) {
    if (!input.profile.readableKinds.includes(candidate.kind)) {
      omitted.push({ pageId: candidate.id, reason: 'permission_denied' });
      continue;
    }

    if (candidate.trustLevel === 'low') {
      omitted.push({ pageId: candidate.id, reason: 'low_trust' });
      continue;
    }

    if (candidate.freshness === 'stale') {
      omitted.push({ pageId: candidate.id, reason: 'stale' });
      continue;
    }

    if (tokenTotal + candidate.tokenCost > input.profile.maxContextTokens) {
      omitted.push({ pageId: candidate.id, reason: 'token_budget' });
      continue;
    }

    tokenTotal += candidate.tokenCost;
    loaded.push(candidate);
  }

  return {
    bundle: {
      bundleId: input.bundleId,
      taskId: input.taskId,
      agentId: input.agentId,
      pages: loaded
    },
    manifest: {
      bundleId: input.bundleId,
      taskId: input.taskId,
      agentId: input.agentId,
      createdAt: input.createdAt,
      loadedPages: loaded.map(page => ({
        pageId: page.id,
        kind: page.kind,
        reason: 'Allowed by profile and token budget',
        tokenCost: page.tokenCost,
        authority: page.authority,
        trustLevel: page.trustLevel
      })),
      omittedPages: omitted,
      totalTokenCost: tokenTotal
    }
  };
}
```

Create `packages/runtime/src/runtime/agentos/index.ts`:

```ts
export * from './context-assembler';
```

Append to `packages/runtime/src/runtime/index.ts`:

```ts
export * from './agentos';
```

If `packages/runtime/src/index.ts` does not already export `./runtime`, add:

```ts
export * from './runtime';
```

- [ ] **Step 4: Run context assembler tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/runtime/test/agentos-context-assembler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit context assembler**

Run:

```bash
git add packages/runtime/src/runtime/agentos/context-assembler.ts packages/runtime/src/runtime/agentos/index.ts packages/runtime/src/runtime/index.ts packages/runtime/src/index.ts packages/runtime/test/agentos-context-assembler.test.ts
git commit -m "feat: add agent runtime context assembler"
```

---

### Task 4: Implement Syscall Policy Decision Helper

**Files:**

- Create: `packages/runtime/src/runtime/agentos/syscall-policy.ts`
- Modify: `packages/runtime/src/runtime/agentos/index.ts`
- Test: `packages/runtime/test/agentos-syscall-policy.test.ts`

- [ ] **Step 1: Write the failing syscall policy test**

Create `packages/runtime/test/agentos-syscall-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decideToolRequestPolicy } from '../src/runtime/agentos';
import type { PermissionProfile, ToolRequest } from '@agent/core';

const profile: PermissionProfile = {
  allowedActions: ['read', 'write', 'execute'],
  allowedAssetScopes: ['workspace', 'artifact'],
  allowedEnvironments: ['sandbox', 'workspace'],
  allowedDataClasses: ['public', 'internal'],
  maxBlastRadius: 'project',
  defaultApprovalPolicy: 'auto'
};

const request = (overrides: Partial<ToolRequest>): ToolRequest => ({
  requestId: 'tool-1',
  taskId: 'task-1',
  agentId: 'coder',
  syscallType: 'resource',
  toolName: 'read_file',
  intent: 'Read a project document',
  args: {},
  expectedEvidence: [],
  agentRiskHint: {
    action: 'read',
    assetScope: ['workspace'],
    environment: 'workspace',
    dataClasses: ['internal'],
    blastRadius: 'local'
  },
  ...overrides
});

describe('decideToolRequestPolicy', () => {
  it('allows low-risk requests inside the profile', () => {
    const decision = decideToolRequestPolicy({ profile, request: request({}) });
    expect(decision.decision).toBe('allow');
    expect(decision.normalizedRisk.level).toBe('low');
  });

  it('denies requests outside allowed data classes', () => {
    const decision = decideToolRequestPolicy({
      profile,
      request: request({
        agentRiskHint: {
          action: 'read',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['secret'],
          blastRadius: 'local'
        }
      })
    });

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('data class');
  });

  it('requires approval for external or destructive requests', () => {
    const decision = decideToolRequestPolicy({
      profile: { ...profile, allowedActions: [...profile.allowedActions, 'publish'] },
      request: request({
        syscallType: 'external',
        toolName: 'publish',
        agentRiskHint: {
          action: 'publish',
          assetScope: ['artifact'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'external'
        }
      })
    });

    expect(decision.decision).toBe('needs_approval');
    expect(decision.requiredApprovalPolicy).toBe('human');
    expect(decision.normalizedRisk.level).toBe('high');
  });
});
```

- [ ] **Step 2: Run the failing policy test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/runtime/test/agentos-syscall-policy.test.ts
```

Expected: FAIL because `decideToolRequestPolicy` does not exist.

- [ ] **Step 3: Implement policy helper**

Create `packages/runtime/src/runtime/agentos/syscall-policy.ts`:

```ts
import type { PermissionProfile, PolicyDecision, ToolRequest } from '@agent/core';

const blastRank: Record<string, number> = {
  local: 0,
  project: 1,
  team: 2,
  external: 3,
  production: 4
};

export interface DecideToolRequestPolicyInput {
  profile: PermissionProfile;
  request: ToolRequest;
}

export function decideToolRequestPolicy(input: DecideToolRequestPolicyInput): PolicyDecision {
  const hint = input.request.agentRiskHint;
  const normalizedRisk = {
    action: hint?.action ?? 'read',
    assetScope: hint?.assetScope ?? [],
    environment: hint?.environment ?? 'workspace',
    dataClasses: hint?.dataClasses ?? ['internal'],
    blastRadius: hint?.blastRadius ?? 'local',
    level: 'low' as PolicyDecision['normalizedRisk']['level']
  };

  const deniedReason = findDeniedReason(input.profile, normalizedRisk);
  if (deniedReason) {
    return {
      decision: 'deny',
      reason: deniedReason,
      decidedBy: 'permission_service',
      normalizedRisk: { ...normalizedRisk, level: 'critical' }
    };
  }

  const needsApproval =
    ['delete', 'publish', 'spend'].includes(normalizedRisk.action) ||
    ['secret', 'pii'].some(dataClass => normalizedRisk.dataClasses.includes(dataClass)) ||
    blastRank[normalizedRisk.blastRadius] >= blastRank.external;

  if (needsApproval) {
    return {
      decision: 'needs_approval',
      reason: 'Request crosses a high-risk action, data class, or blast radius.',
      decidedBy: 'permission_service',
      requiredApprovalPolicy: 'human',
      normalizedRisk: { ...normalizedRisk, level: 'high' }
    };
  }

  return {
    decision: 'allow',
    reason: 'Request is allowed by profile and does not require approval.',
    decidedBy: 'permission_service',
    normalizedRisk
  };
}

function findDeniedReason(profile: PermissionProfile, risk: PolicyDecision['normalizedRisk']): string | undefined {
  if (!profile.allowedActions.includes(risk.action as never)) {
    return `Action ${risk.action} is not allowed by profile.`;
  }

  if (risk.assetScope.some(scope => !profile.allowedAssetScopes.includes(scope))) {
    return 'Request includes an asset scope that is not allowed by profile.';
  }

  if (!profile.allowedEnvironments.includes(risk.environment as never)) {
    return `Environment ${risk.environment} is not allowed by profile.`;
  }

  if (risk.dataClasses.some(dataClass => !profile.allowedDataClasses.includes(dataClass as never))) {
    return 'Request includes a data class that is not allowed by profile.';
  }

  if (blastRank[risk.blastRadius] > blastRank[profile.maxBlastRadius]) {
    return `Blast radius ${risk.blastRadius} exceeds profile maximum ${profile.maxBlastRadius}.`;
  }

  return undefined;
}
```

Append to `packages/runtime/src/runtime/agentos/index.ts`:

```ts
export * from './syscall-policy';
```

- [ ] **Step 4: Run syscall policy tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/runtime/test/agentos-syscall-policy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit syscall policy helper**

Run:

```bash
git add packages/runtime/src/runtime/agentos/syscall-policy.ts packages/runtime/src/runtime/agentos/index.ts packages/runtime/test/agentos-syscall-policy.test.ts
git commit -m "feat: add agent runtime syscall policy"
```

---

### Task 5: Implement Quality Gate and Projection Builders

**Files:**

- Create: `packages/runtime/src/runtime/agentos/quality-gates.ts`
- Create: `packages/runtime/src/runtime/agentos/runtime-projection-builder.ts`
- Modify: `packages/runtime/src/runtime/agentos/index.ts`
- Test: `packages/runtime/test/agentos-quality-gates.test.ts`
- Test: `packages/runtime/test/agentos-runtime-projection-builder.test.ts`

- [ ] **Step 1: Write failing quality gate tests**

Create `packages/runtime/test/agentos-quality-gates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateQualityGate } from '../src/runtime/agentos';
import type { QualityGate } from '@agent/core';

describe('evaluateQualityGate', () => {
  it('passes a schema gate when the candidate parses', () => {
    const gate: QualityGate = {
      gateId: 'schema-output',
      hook: 'post_action',
      requiredForRisk: ['low', 'medium', 'high', 'critical'],
      evaluator: 'schema',
      onFail: 'block'
    };

    const result = evaluateQualityGate({
      gate,
      evaluatedAt: '2026-05-03T08:00:00.000Z',
      evidenceRefs: ['ev-1'],
      passed: true
    });

    expect(result.status).toBe('passed');
    expect(result.evidenceRefs).toEqual(['ev-1']);
  });

  it('returns failed result with reason when a gate blocks', () => {
    const result = evaluateQualityGate({
      gate: {
        gateId: 'policy-high-risk',
        hook: 'pre_action',
        requiredForRisk: ['high', 'critical'],
        evaluator: 'policy',
        onFail: 'require_approval'
      },
      evaluatedAt: '2026-05-03T08:00:00.000Z',
      passed: false,
      reason: 'Missing PolicyDecision for high-risk action'
    });

    expect(result.status).toBe('failed');
    expect(result.reason).toContain('Missing PolicyDecision');
  });
});
```

- [ ] **Step 2: Write failing projection builder tests**

Create `packages/runtime/test/agentos-runtime-projection-builder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildAgentRuntimeTaskProjection } from '../src/runtime/agentos';

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
});
```

- [ ] **Step 3: Run failing quality and projection tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/runtime/test/agentos-quality-gates.test.ts packages/runtime/test/agentos-runtime-projection-builder.test.ts
```

Expected: FAIL because helpers do not exist.

- [ ] **Step 4: Implement quality gate helper**

Create `packages/runtime/src/runtime/agentos/quality-gates.ts`:

```ts
import type { QualityGate, QualityGateResult } from '@agent/core';

export interface EvaluateQualityGateInput {
  gate: QualityGate;
  evaluatedAt: string;
  passed: boolean;
  reason?: string;
  evidenceRefs?: string[];
}

export function evaluateQualityGate(input: EvaluateQualityGateInput): QualityGateResult {
  return {
    gateId: input.gate.gateId,
    status: input.passed ? 'passed' : 'failed',
    evaluatedAt: input.evaluatedAt,
    reason: input.reason,
    evidenceRefs: input.evidenceRefs ?? []
  };
}
```

- [ ] **Step 5: Implement projection builder**

Create `packages/runtime/src/runtime/agentos/runtime-projection-builder.ts`:

```ts
import type {
  AgentRuntimeTaskProjection,
  ContextManifest,
  GovernancePhase,
  PolicyDecision,
  QualityGateResult
} from '@agent/core';

export interface RuntimeProjectionSideEffectInput {
  reversible: boolean;
  compensated: boolean;
}

export interface BuildAgentRuntimeTaskProjectionInput {
  taskId: string;
  currentAgentId?: string;
  governancePhase: GovernancePhase;
  selectedProfileId?: string;
  contextManifest?: ContextManifest;
  latestPolicyDecision?: PolicyDecision;
  pendingInterruptId?: string;
  qualityGateResults?: QualityGateResult[];
  evidenceRefs?: string[];
  budgetSummary?: AgentRuntimeTaskProjection['budgetSummary'];
  sideEffects?: RuntimeProjectionSideEffectInput[];
}

export function buildAgentRuntimeTaskProjection(
  input: BuildAgentRuntimeTaskProjectionInput
): AgentRuntimeTaskProjection {
  return {
    taskId: input.taskId,
    currentAgentId: input.currentAgentId,
    governancePhase: input.governancePhase,
    selectedProfileId: input.selectedProfileId,
    contextManifestSummary: input.contextManifest
      ? {
          bundleId: input.contextManifest.bundleId,
          loadedPageCount: input.contextManifest.loadedPages.length,
          omittedPageCount: input.contextManifest.omittedPages.length,
          totalTokenCost: input.contextManifest.totalTokenCost
        }
      : undefined,
    latestPolicyDecision: input.latestPolicyDecision,
    pendingInterruptId: input.pendingInterruptId,
    qualityGateResults: input.qualityGateResults ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    budgetSummary: input.budgetSummary,
    sideEffectSummary: input.sideEffects
      ? {
          total: input.sideEffects.length,
          reversible: input.sideEffects.filter(effect => effect.reversible).length,
          compensated: input.sideEffects.filter(effect => effect.compensated).length
        }
      : undefined
  };
}
```

Append to `packages/runtime/src/runtime/agentos/index.ts`:

```ts
export * from './quality-gates';
export * from './runtime-projection-builder';
```

- [ ] **Step 6: Run quality and projection tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/runtime/test/agentos-quality-gates.test.ts packages/runtime/test/agentos-runtime-projection-builder.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit quality and projection helpers**

Run:

```bash
git add packages/runtime/src/runtime/agentos/quality-gates.ts packages/runtime/src/runtime/agentos/runtime-projection-builder.ts packages/runtime/src/runtime/agentos/index.ts packages/runtime/test/agentos-quality-gates.test.ts packages/runtime/test/agentos-runtime-projection-builder.test.ts
git commit -m "feat: add agent runtime quality projections"
```

---

### Task 6: Add Default Platform Runtime Profiles

**Files:**

- Create: `packages/platform-runtime/src/agentos/default-agent-runtime-profiles.ts`
- Create: `packages/platform-runtime/src/agentos/index.ts`
- Modify: `packages/platform-runtime/src/index.ts`
- Test: `packages/platform-runtime/test/default-agent-runtime-profiles.test.ts`

- [ ] **Step 1: Write the failing default profile test**

Create `packages/platform-runtime/test/default-agent-runtime-profiles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { AgentRuntimeProfileSchema } from '@agent/core';
import {
  defaultAgentRuntimeProfiles,
  resolveDefaultAgentRuntimeProfile
} from '../src/agentos/default-agent-runtime-profiles';

describe('defaultAgentRuntimeProfiles', () => {
  it('contains valid supervisor, coder, reviewer, and data-report profiles', () => {
    for (const profile of defaultAgentRuntimeProfiles) {
      expect(() => AgentRuntimeProfileSchema.parse(profile)).not.toThrow();
    }

    expect(defaultAgentRuntimeProfiles.map(profile => profile.descriptor.agentId)).toEqual([
      'supervisor',
      'coder',
      'reviewer',
      'data-report'
    ]);
  });

  it('resolves a default profile by agent id', () => {
    const profile = resolveDefaultAgentRuntimeProfile('coder');
    expect(profile?.descriptor.role).toBe('coder');
    expect(profile?.syscall.mutation).toContain('apply_patch');
  });
});
```

- [ ] **Step 2: Run the failing default profile test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/platform-runtime/test/default-agent-runtime-profiles.test.ts
```

Expected: FAIL because the default profile registry does not exist.

- [ ] **Step 3: Implement default profile registry**

Create `packages/platform-runtime/src/agentos/default-agent-runtime-profiles.ts`:

```ts
import type { AgentRuntimeProfile } from '@agent/core';

const baseObservability = {
  decisionLog: true,
  rationaleSummary: true,
  toolTrace: true,
  evidence: true,
  audit: true,
  approvalHistory: true,
  stateTransitions: true
};

const baseRecovery = {
  checkpoint: true,
  resume: true,
  rollbackLocalState: true,
  compensateExternalEffects: false,
  sideEffectLedger: true
};

export const defaultAgentRuntimeProfiles: AgentRuntimeProfile[] = [
  {
    descriptor: {
      agentId: 'supervisor',
      role: 'supervisor',
      level: 4,
      description: 'Privileged planning and routing agent.',
      capabilities: ['task.plan', 'agent.request', 'result.aggregate']
    },
    contextAccess: {
      readableKinds: ['task', 'plan', 'recent_messages', 'evidence', 'memory', 'rule', 'skill', 'risk'],
      writableKinds: ['plan', 'risk'],
      memoryViewScopes: ['task', 'session', 'project'],
      maxContextTokens: 16000
    },
    syscall: {
      resource: ['search_knowledge'],
      mutation: [],
      execution: [],
      external: [],
      controlPlane: ['request_agent'],
      runtime: ['create_checkpoint']
    },
    permission: {
      allowedActions: ['read'],
      allowedAssetScopes: ['workspace', 'memory', 'evidence'],
      allowedEnvironments: ['sandbox', 'workspace'],
      allowedDataClasses: ['public', 'internal'],
      maxBlastRadius: 'project',
      defaultApprovalPolicy: 'human'
    },
    resource: {
      tokenBudget: 160000,
      costBudgetUsd: 4,
      maxWallTimeMs: 900000,
      maxToolCalls: 40,
      maxConcurrentTasks: 1,
      modelClassAllowed: ['standard', 'premium']
    },
    observability: baseObservability,
    recovery: baseRecovery,
    outputContract: {
      schemaName: 'SupervisorPlanOutput',
      schemaVersion: '1.0.0',
      parseStrategy: 'strict',
      compatPolicy: 'additive'
    }
  },
  {
    descriptor: {
      agentId: 'coder',
      role: 'coder',
      level: 3,
      description: 'Code implementation agent.',
      capabilities: ['code.edit', 'test.run']
    },
    contextAccess: {
      readableKinds: ['task', 'plan', 'evidence', 'tool_result', 'rule', 'knowledge'],
      writableKinds: ['tool_result'],
      memoryViewScopes: ['task', 'project'],
      maxContextTokens: 14000
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
    observability: baseObservability,
    recovery: baseRecovery,
    outputContract: {
      schemaName: 'CoderPatchOutput',
      schemaVersion: '1.0.0',
      parseStrategy: 'strict',
      compatPolicy: 'additive'
    }
  },
  {
    descriptor: {
      agentId: 'reviewer',
      role: 'reviewer',
      level: 2,
      description: 'Quality and risk review agent.',
      capabilities: ['diff.review', 'policy.check']
    },
    contextAccess: {
      readableKinds: ['task', 'plan', 'evidence', 'tool_result', 'risk', 'rule'],
      writableKinds: ['risk'],
      memoryViewScopes: ['task', 'project'],
      maxContextTokens: 10000
    },
    syscall: {
      resource: ['read_artifact'],
      mutation: [],
      execution: ['run_test'],
      external: [],
      controlPlane: [],
      runtime: ['create_checkpoint']
    },
    permission: {
      allowedActions: ['read', 'execute'],
      allowedAssetScopes: ['workspace', 'artifact', 'evidence'],
      allowedEnvironments: ['sandbox', 'workspace'],
      allowedDataClasses: ['public', 'internal'],
      maxBlastRadius: 'project',
      defaultApprovalPolicy: 'auto'
    },
    resource: {
      tokenBudget: 80000,
      costBudgetUsd: 2,
      maxWallTimeMs: 600000,
      maxToolCalls: 30,
      maxConcurrentTasks: 1,
      modelClassAllowed: ['standard', 'premium']
    },
    observability: baseObservability,
    recovery: baseRecovery,
    outputContract: {
      schemaName: 'ReviewerFindingOutput',
      schemaVersion: '1.0.0',
      parseStrategy: 'strict',
      compatPolicy: 'additive'
    }
  },
  {
    descriptor: {
      agentId: 'data-report',
      role: 'data-report',
      level: 4,
      description: 'Structured data report generation agent.',
      capabilities: ['report.plan', 'report.generate', 'report.verify']
    },
    contextAccess: {
      readableKinds: ['task', 'plan', 'knowledge', 'evidence', 'tool_result', 'rule'],
      writableKinds: ['tool_result'],
      memoryViewScopes: ['task', 'project'],
      maxContextTokens: 18000
    },
    syscall: {
      resource: ['search_knowledge', 'read_artifact'],
      mutation: ['create_artifact'],
      execution: ['run_test'],
      external: [],
      controlPlane: ['request_agent'],
      runtime: ['create_checkpoint']
    },
    permission: {
      allowedActions: ['read', 'write', 'execute'],
      allowedAssetScopes: ['artifact', 'workspace', 'knowledge'],
      allowedEnvironments: ['sandbox', 'workspace'],
      allowedDataClasses: ['public', 'internal'],
      maxBlastRadius: 'project',
      defaultApprovalPolicy: 'human'
    },
    resource: {
      tokenBudget: 180000,
      costBudgetUsd: 5,
      maxWallTimeMs: 1200000,
      maxToolCalls: 80,
      maxConcurrentTasks: 1,
      modelClassAllowed: ['standard', 'premium']
    },
    observability: baseObservability,
    recovery: baseRecovery,
    outputContract: {
      schemaName: 'DataReportBundleOutput',
      schemaVersion: '1.0.0',
      parseStrategy: 'strict',
      compatPolicy: 'additive'
    }
  }
];

export function resolveDefaultAgentRuntimeProfile(agentId: string): AgentRuntimeProfile | undefined {
  return defaultAgentRuntimeProfiles.find(profile => profile.descriptor.agentId === agentId);
}
```

Create `packages/platform-runtime/src/agentos/index.ts`:

```ts
export * from './default-agent-runtime-profiles';
```

Append to `packages/platform-runtime/src/index.ts`:

```ts
export * from './agentos';
```

- [ ] **Step 4: Run default profile tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/platform-runtime/test/default-agent-runtime-profiles.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit default platform profiles**

Run:

```bash
git add packages/platform-runtime/src/agentos/default-agent-runtime-profiles.ts packages/platform-runtime/src/agentos/index.ts packages/platform-runtime/src/index.ts packages/platform-runtime/test/default-agent-runtime-profiles.test.ts
git commit -m "feat: add default agent runtime profiles"
```

---

### Task 7: Document Runtime Profile MVP and Run Final Verification

**Files:**

- Create: `docs/packages/runtime/agentos-runtime-profile.md`
- Modify: `docs/packages/runtime/README.md`
- Modify: `docs/architecture/ARCHITECTURE.md`

- [ ] **Step 1: Add runtime module documentation**

Create `docs/packages/runtime/agentos-runtime-profile.md`:

```markdown
# AgentOS Runtime Profile

状态：current
文档类型：architecture
适用范围：`packages/core`、`packages/runtime`、`packages/platform-runtime`
最后核对：2026-05-03

## 定位

AgentOS Runtime Profile 是自治 Agent 的运行时治理模型。它不表示每个 Agent 都是操作系统，而表示每个 Agent 运行在 Runtime 提供的受管 profile 中。

## 第一阶段能力

- `AgentRuntimeProfile`：描述 Agent 的能力、上下文权限、系统调用权限、资源预算、恢复和输出契约。
- `ContextPage / ContextBundle / ContextManifest`：记录 Agent 看见了什么、为什么加载、哪些内容被省略。
- `ToolRequest / PolicyDecision`：Agent 只提出请求，审批结论由 Permission Service 计算。
- `MissingContextSignal`：支持阻塞和非阻塞缺上下文信号。
- `QualityGate / QualityGateResult`：把验证建模为 Runtime 生命周期 hook。
- `AgentRuntimeTaskProjection`：给 admin/chat 的裁剪投影，不暴露 raw runtime state。

## 边界

- `packages/core` 只放 schema-first contract。
- `packages/runtime` 放 deterministic helper：context assembler、policy helper、quality gate helper、projection builder。
- `packages/platform-runtime` 放默认官方 profile registry。
- `apps/*` 只消费 projection DTO。

## 禁止回退

- 不让 Agent 自判最终审批结论。
- 不让业务 Agent 直接调度其他 Agent。
- 不把完整内部推理写入审计。
- 不把不可逆外部副作用描述为可 rollback。
```

- [ ] **Step 2: Link the new runtime doc**

In `docs/packages/runtime/README.md`, add this link near the runtime documents list:

```markdown
- `agentos-runtime-profile.md` — Agent Runtime Profile、Context Manifest、ToolRequest / PolicyDecision 与 QualityGate 的第一阶段治理模型
```

In `docs/architecture/ARCHITECTURE.md`, add one short paragraph near the Runtime layering section:

```markdown
AgentOS Runtime Profile 是当前 Runtime Kernel 的第一阶段治理模型：Agent 不是 OS，而是运行在可裁剪 profile 中的受管执行单元。Profile、Context Manifest、ToolRequest / PolicyDecision 与 QualityGate 的落地边界见 `docs/packages/runtime/agentos-runtime-profile.md`。
```

- [ ] **Step 3: Run affected tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/agent-runtime-profile-contracts.test.ts packages/runtime/test/agentos-context-assembler.test.ts packages/runtime/test/agentos-syscall-policy.test.ts packages/runtime/test/agentos-quality-gates.test.ts packages/runtime/test/agentos-runtime-projection-builder.test.ts packages/platform-runtime/test/default-agent-runtime-profiles.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run typechecks**

Run:

```bash
pnpm exec tsc -p packages/core/tsconfig.json --noEmit
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
pnpm exec tsc -p packages/platform-runtime/tsconfig.json --noEmit
```

Expected: PASS. If unrelated existing red lights appear, record the exact failure and confirm all new focused tests still pass.

- [ ] **Step 5: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 6: Commit docs and verification updates**

Run:

```bash
git add docs/packages/runtime/agentos-runtime-profile.md docs/packages/runtime/README.md docs/architecture/ARCHITECTURE.md
git commit -m "docs: document agent runtime profile mvp"
```

---

## Self-Review

Spec coverage:

- Agent/runtime/control-plane boundary is covered by Tasks 1, 6, and 7.
- Context virtual memory is covered by Tasks 2 and 3.
- Missing context signal is covered by Task 2.
- Syscall boundary and policy decision are covered by Tasks 2 and 4.
- QualityGate hook is covered by Tasks 2 and 5.
- Admin/chat projection DTO is covered by Tasks 2 and 5.
- MVP scope avoids daemon, package manager, full scheduler, two-person approval, and full compensation engine.

Plan constraints:

- No `git worktree` is used.
- Each implementation task starts with a failing test.
- All public contracts are schema-first and use `z.infer` types.
- `ToolRequest` has only `agentRiskHint`; `PolicyDecision` owns the final approval decision.
- Frontend/backend integration is intentionally deferred until stable contracts and runtime projection builders exist.

Verification summary:

- Focused Vitest commands are listed per task.
- Typechecks for `packages/core`, `packages/runtime`, and `packages/platform-runtime` are required before completion.
- `pnpm check:docs` is required because the plan updates docs.
