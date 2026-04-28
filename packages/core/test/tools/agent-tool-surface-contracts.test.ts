import { describe, expect, it } from 'vitest';

import {
  AgentToolAliasRequestSchema,
  AgentToolAliasSchema,
  AgentToolApprovalModeSchema,
  AgentToolResolutionSchema,
  AgentToolSurfaceActorSchema,
  AgentToolSurfaceErrorCodeSchema
} from '@agent/tools';

describe('agent tool surface contracts', () => {
  it('parses supported aliases and approval modes', () => {
    expect(AgentToolAliasSchema.parse('edit')).toBe('edit');
    expect(AgentToolApprovalModeSchema.parse('full_auto')).toBe('full_auto');
  });

  it('parses an alias request with safe defaults', () => {
    const request = AgentToolAliasRequestSchema.parse({
      alias: 'read',
      input: { path: 'README.md' }
    });

    expect(request).toMatchObject({
      alias: 'read',
      approvalMode: 'suggest',
      input: { path: 'README.md' }
    });
  });

  it('parses an alias request actor without leaking unsupported actor values', () => {
    const requestedBy = AgentToolSurfaceActorSchema.parse({
      actor: 'specialist_agent',
      actorId: 'coder-1'
    });

    expect(requestedBy).toEqual({
      actor: 'specialist_agent',
      actorId: 'coder-1'
    });
    expect(() => AgentToolSurfaceActorSchema.parse({ actor: 'external_vendor' })).toThrow();
  });

  it('parses a resolved tool surface decision', () => {
    const resolution = AgentToolResolutionSchema.parse({
      alias: 'edit',
      toolName: 'patch_local_file',
      capabilityId: 'capability:patch_local_file',
      riskClass: 'high',
      requiresApproval: false,
      approvalMode: 'auto_edit',
      approvalReasonCode: 'auto_edit_allows_workspace_patch',
      sandboxProfile: 'workspace-write',
      input: { path: 'src/index.ts', search: 'old', replace: 'new' },
      inputPreview: 'edit src/index.ts',
      reasonCode: 'alias_edit_patch',
      reason: 'Resolved edit alias to patch_local_file.'
    });

    expect(resolution.toolName).toBe('patch_local_file');
  });

  it('accepts the documented sandbox profiles', () => {
    for (const sandboxProfile of ['workspace-readonly', 'workspace-write', 'release-ops'] as const) {
      expect(
        AgentToolResolutionSchema.parse({
          alias: 'command',
          toolName: 'run_terminal',
          capabilityId: 'capability:run_terminal',
          riskClass: 'medium',
          requiresApproval: true,
          approvalMode: 'suggest',
          sandboxProfile,
          input: { command: 'pnpm test' },
          reasonCode: 'alias_command',
          reason: 'Resolved command alias to run_terminal.'
        }).sandboxProfile
      ).toBe(sandboxProfile);
    }
  });

  it('parses documented surface error codes', () => {
    expect(AgentToolSurfaceErrorCodeSchema.parse('agent_tool_alias_unresolved')).toBe('agent_tool_alias_unresolved');
  });

  it('rejects unsupported aliases', () => {
    expect(() =>
      AgentToolAliasRequestSchema.parse({
        alias: 'browse',
        input: { url: 'https://example.com' }
      })
    ).toThrow();
  });
});
