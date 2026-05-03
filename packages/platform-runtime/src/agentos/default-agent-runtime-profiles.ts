import { AgentRuntimeProfileSchema } from '@agent/core';
import type { AgentRuntimeProfile } from '@agent/core';

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

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

const rawDefaultAgentRuntimeProfiles = [
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

export const defaultAgentRuntimeProfiles: readonly DeepReadonly<AgentRuntimeProfile>[] = deepFreeze(
  rawDefaultAgentRuntimeProfiles.map(profile => AgentRuntimeProfileSchema.parse(profile))
);

export function resolveDefaultAgentRuntimeProfile(agentId: string): AgentRuntimeProfile | undefined {
  const profile = defaultAgentRuntimeProfiles.find(candidate => candidate.descriptor.agentId === agentId);

  return profile ? AgentRuntimeProfileSchema.parse(profile) : undefined;
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') {
    Object.freeze(value);

    for (const propertyValue of Object.values(value)) {
      deepFreeze(propertyValue);
    }
  }

  return value as DeepReadonly<T>;
}
