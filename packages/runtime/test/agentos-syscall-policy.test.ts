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
