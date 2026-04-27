import { describe, expect, it } from 'vitest';

import { createDefaultToolRegistry } from '../../src';
import { AgentToolSurfaceResolver } from '../../src/agent-surface';

function createResolver(): AgentToolSurfaceResolver {
  return new AgentToolSurfaceResolver({ registry: createDefaultToolRegistry() });
}

describe('AgentToolSurfaceResolver', () => {
  it('maps read/list/search/edit aliases to stable tools', () => {
    const resolver = createResolver();

    expect(resolver.resolve({ alias: 'read', input: { path: 'README.md' } })).toMatchObject({
      toolName: 'read_local_file',
      riskClass: 'low',
      requiresApproval: false
    });
    expect(resolver.resolve({ alias: 'list', input: { path: '.' } }).toolName).toBe('list_directory');
    expect(resolver.resolve({ alias: 'search', input: { query: 'AgentTool' } }).toolName).toBe('search_in_files');
    expect(
      resolver.resolve({
        alias: 'edit',
        approvalMode: 'auto_edit',
        input: { path: 'a.ts', search: 'a', replace: 'b' }
      })
    ).toMatchObject({
      toolName: 'patch_local_file',
      requiresApproval: false,
      approvalReasonCode: 'auto_edit_allows_workspace_patch'
    });
  });

  it('selects json tools when input asks for structured json', () => {
    const resolver = createResolver();

    expect(resolver.resolve({ alias: 'read', input: { path: 'package.json', structured: true } }).toolName).toBe(
      'read_json'
    );
    expect(
      resolver.resolve({
        alias: 'write',
        approvalMode: 'auto_edit',
        input: { path: 'a.json', value: { ok: true } }
      })
    ).toMatchObject({
      toolName: 'write_json',
      requiresApproval: false
    });
  });

  it('allows full auto workspace edits while still relying on command risk classification', () => {
    const resolver = createResolver();

    expect(
      resolver.resolve({
        alias: 'edit',
        approvalMode: 'full_auto',
        input: { path: 'a.ts', search: 'before', replace: 'after' }
      })
    ).toMatchObject({
      toolName: 'patch_local_file',
      riskClass: 'high',
      requiresApproval: false,
      approvalReasonCode: 'full_auto_allows_sandbox_action'
    });
  });

  it('keeps delete approval-gated and escalates recursive deletes', () => {
    const resolver = createResolver();

    expect(
      resolver.resolve({ alias: 'delete', approvalMode: 'full_auto', input: { path: 'tmp/file.txt' } })
    ).toMatchObject({
      toolName: 'delete_local_file',
      riskClass: 'high',
      requiresApproval: true
    });
    expect(
      resolver.resolve({ alias: 'delete', approvalMode: 'full_auto', input: { path: '.', recursive: true } })
    ).toMatchObject({
      riskClass: 'critical',
      requiresApproval: true,
      approvalReasonCode: 'critical_actions_require_approval'
    });
  });

  it('classifies commands through approval modes', () => {
    const resolver = createResolver();

    expect(
      resolver.resolve({ alias: 'command', approvalMode: 'full_auto', input: { command: 'pnpm test' } })
    ).toMatchObject({
      toolName: 'run_terminal',
      riskClass: 'low',
      requiresApproval: false,
      approvalReasonCode: 'full_auto_allows_sandbox_verification_command'
    });
    expect(
      resolver.resolve({ alias: 'command', approvalMode: 'full_auto', input: { command: 'cat README.md > tmp/out' } })
    ).toMatchObject({
      riskClass: 'high',
      requiresApproval: true,
      approvalReasonCode: 'full_auto_requires_mutating_command_approval'
    });
    expect(
      resolver.resolve({ alias: 'command', approvalMode: 'full_auto', input: { command: 'rg TODO && touch tmp/out' } })
    ).toMatchObject({
      riskClass: 'high',
      requiresApproval: true,
      approvalReasonCode: 'full_auto_requires_mutating_command_approval'
    });
    expect(
      resolver.resolve({ alias: 'command', approvalMode: 'full_auto', input: { command: 'rg TODO | tee tmp/out' } })
    ).toMatchObject({
      riskClass: 'high',
      requiresApproval: true,
      approvalReasonCode: 'full_auto_requires_mutating_command_approval'
    });
    expect(
      resolver.resolve({ alias: 'command', approvalMode: 'full_auto', input: { command: 'pnpm test\nrm -rf .' } })
    ).toMatchObject({
      riskClass: 'high',
      requiresApproval: true,
      approvalReasonCode: 'full_auto_requires_mutating_command_approval'
    });
    expect(
      resolver.resolve({ alias: 'command', approvalMode: 'full_auto', input: { command: 'pnpm test & touch tmp/out' } })
    ).toMatchObject({
      riskClass: 'high',
      requiresApproval: true,
      approvalReasonCode: 'full_auto_requires_mutating_command_approval'
    });
    expect(
      resolver.resolve({ alias: 'command', approvalMode: 'auto_edit', input: { command: 'git commit -m x' } })
    ).toMatchObject({
      riskClass: 'high',
      requiresApproval: true
    });
    expect(
      resolver.resolve({ alias: 'command', approvalMode: 'full_auto', input: { command: 'rm -rf .' } })
    ).toMatchObject({
      riskClass: 'critical',
      requiresApproval: true,
      approvalReasonCode: 'destructive_command_denied'
    });
  });

  it('throws when a requested capability mismatches the resolved tool', () => {
    const resolver = createResolver();

    expect(() =>
      resolver.resolve({
        alias: 'read',
        capabilityId: 'capability.filesystem.write_local_file',
        input: { path: 'README.md' }
      })
    ).toThrow(/agent_tool_alias_capability_mismatch/);
  });

  it('validates resolver input through the core alias request schema', () => {
    const resolver = createResolver();

    expect(() =>
      resolver.resolve({
        alias: 'read',
        input: { path: 'README.md' },
        unexpected: true
      } as never)
    ).toThrow();
  });
});
