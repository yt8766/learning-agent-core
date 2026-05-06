import { describe, expect, it } from 'vitest';
import { decideToolRequestPolicy } from '../src/runtime/agentos';
import type { PermissionProfile, SyscallProfile, ToolRequest } from '@agent/core';

const profile: PermissionProfile = {
  allowedActions: ['read', 'write', 'execute'],
  allowedAssetScopes: ['workspace', 'artifact'],
  allowedEnvironments: ['sandbox', 'workspace'],
  allowedDataClasses: ['public', 'internal'],
  maxBlastRadius: 'project',
  defaultApprovalPolicy: 'auto'
};

const syscall: SyscallProfile = {
  resource: ['read_file'],
  mutation: ['apply_patch'],
  execution: ['run_test'],
  external: ['publish'],
  controlPlane: [],
  runtime: ['create_checkpoint']
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
    const decision = decideToolRequestPolicy({ profile, syscall, request: request({}) });
    expect(decision.decision).toBe('allow');
    expect(decision.normalizedRisk.level).toBe('low');
  });

  it('denies requests for tools outside the syscall profile', () => {
    const decision = decideToolRequestPolicy({
      profile,
      syscall,
      request: request({
        syscallType: 'resource',
        toolName: 'read_secret_file'
      })
    });

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('not allowed by syscall profile');
  });

  it('denies requests outside allowed data classes', () => {
    const decision = decideToolRequestPolicy({
      profile,
      syscall,
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

  it('requires approval using the profile approval policy for external requests within the blast radius', () => {
    const decision = decideToolRequestPolicy({
      profile: {
        ...profile,
        allowedActions: [...profile.allowedActions, 'publish'],
        maxBlastRadius: 'external',
        defaultApprovalPolicy: 'two_person'
      },
      syscall,
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
    expect(decision.requiredApprovalPolicy).toBe('two_person');
    expect(decision.normalizedRisk.level).toBe('high');
  });

  it('denies requests that exceed the profile max blast radius before approval', () => {
    const decision = decideToolRequestPolicy({
      profile: { ...profile, allowedActions: [...profile.allowedActions, 'publish'] },
      syscall,
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

    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('exceeds profile maximum');
  });
});
