import { describe, expect, it } from 'vitest';

import { decideToolRequestPolicy } from '../../../src/runtime/agentos/syscall-policy';

function makeProfile(overrides: Record<string, unknown> = {}): any {
  return {
    allowedActions: ['read', 'write', 'delete', 'publish', 'spend'],
    allowedAssetScopes: ['workspace', 'project'],
    allowedEnvironments: ['workspace', 'production'],
    allowedDataClasses: ['internal', 'secret', 'pii'],
    maxBlastRadius: 'production',
    defaultApprovalPolicy: 'human',
    ...overrides
  };
}

function makeSyscall(overrides: Record<string, unknown> = {}): any {
  return {
    resource: ['read_file', 'list_directory'],
    mutation: ['write_file', 'delete_file'],
    execution: ['terminal'],
    external: ['http_request', 'web_search'],
    controlPlane: ['manage_workers'],
    runtime: ['set_model'],
    ...overrides
  };
}

function makeRequest(overrides: Record<string, unknown> = {}): any {
  return {
    toolName: 'write_file',
    syscallType: 'mutation',
    agentRiskHint: {
      action: 'write',
      assetScope: ['workspace'],
      environment: 'workspace',
      dataClasses: ['internal'],
      blastRadius: 'local'
    },
    ...overrides
  };
}

describe('decideToolRequestPolicy extended (direct)', () => {
  it('allows safe read request', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({
        toolName: 'read_file',
        syscallType: 'resource',
        agentRiskHint: {
          action: 'read',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('allow');
  });

  it('denies when tool not in syscall profile', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({
        toolName: 'unknown_tool',
        syscallType: 'mutation'
      })
    });
    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('not allowed by syscall profile');
  });

  it('denies when action not in profile', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile({ allowedActions: ['read'] }),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'delete',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('not allowed by profile');
  });

  it('denies when asset scope not allowed', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile({ allowedAssetScopes: ['workspace'] }),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'write',
          assetScope: ['production'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('asset scope');
  });

  it('denies when environment not allowed', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile({ allowedEnvironments: ['workspace'] }),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'write',
          assetScope: ['workspace'],
          environment: 'production',
          dataClasses: ['internal'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('Environment');
  });

  it('denies when data class not allowed', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile({ allowedDataClasses: ['internal'] }),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'write',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['secret'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('data class');
  });

  it('denies when blast radius exceeds profile max', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile({ maxBlastRadius: 'project' }),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'write',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'external'
        }
      })
    });
    expect(result.decision).toBe('deny');
    expect(result.reason).toContain('Blast radius');
  });

  it('needs approval for high-risk action (delete)', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'delete',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('needs_approval');
  });

  it('needs approval for publish action', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'publish',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('needs_approval');
  });

  it('needs approval for spend action', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'spend',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('needs_approval');
  });

  it('needs approval for secret data class', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'read',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['secret'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('needs_approval');
  });

  it('needs approval for pii data class', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'read',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['pii'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('needs_approval');
  });

  it('needs approval for external blast radius', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'read',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'external'
        }
      })
    });
    expect(result.decision).toBe('needs_approval');
  });

  it('needs approval for production blast radius', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'read',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'production'
        }
      })
    });
    expect(result.decision).toBe('needs_approval');
  });

  it('uses two_person approval policy when configured', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile({ defaultApprovalPolicy: 'two_person' }),
      syscall: makeSyscall(),
      request: makeRequest({
        agentRiskHint: {
          action: 'delete',
          assetScope: ['workspace'],
          environment: 'workspace',
          dataClasses: ['internal'],
          blastRadius: 'local'
        }
      })
    });
    expect(result.decision).toBe('needs_approval');
    expect(result.requiredApprovalPolicy).toBe('two_person');
  });

  it('uses default risk values when no agentRiskHint', () => {
    const result = decideToolRequestPolicy({
      profile: makeProfile(),
      syscall: makeSyscall(),
      request: makeRequest({ agentRiskHint: undefined, toolName: 'read_file', syscallType: 'resource' })
    });
    expect(result.decision).toBe('allow');
  });

  it('handles all syscall types', () => {
    const syscallTypes = ['resource', 'mutation', 'execution', 'external', 'control_plane', 'runtime'] as const;
    for (const syscallType of syscallTypes) {
      const result = decideToolRequestPolicy({
        profile: makeProfile(),
        syscall: makeSyscall(),
        request: makeRequest({ toolName: 'nonexistent', syscallType })
      });
      expect(result.decision).toBe('deny');
    }
  });
});
