import { describe, expect, it } from 'vitest';

import { resolveAgentToolSandboxProfile, shouldRequireAgentToolApproval } from '../../src';

describe('agent tool governance policy', () => {
  it('requires approval for medium and higher risk classes or capability overrides', () => {
    expect(shouldRequireAgentToolApproval('low', false)).toBe(false);
    expect(shouldRequireAgentToolApproval('low', true)).toBe(true);
    expect(shouldRequireAgentToolApproval('medium', false)).toBe(true);
    expect(shouldRequireAgentToolApproval('high', false)).toBe(true);
    expect(shouldRequireAgentToolApproval('critical', false)).toBe(true);
  });

  it('selects sandbox profiles from risk class and tool name', () => {
    expect(resolveAgentToolSandboxProfile('low', 'read_local_file')).toBe('workspace-readonly');
    expect(resolveAgentToolSandboxProfile('low', 'patch_local_file')).toBe('workspace-write');
    expect(resolveAgentToolSandboxProfile('medium', 'run_terminal')).toBe('workspace-write');
    expect(resolveAgentToolSandboxProfile('high', 'run_terminal')).toBe('release-ops');
    expect(resolveAgentToolSandboxProfile('critical', 'delete_local_file')).toBe('release-ops');
  });
});
