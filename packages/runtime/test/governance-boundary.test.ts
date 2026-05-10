import { describe, expect, it } from 'vitest';

import { ApprovalService, buildToolsCenter, ExecutionWatchdog, SandboxProviderRegistry } from '../src';
import { ApprovalService as CanonicalApprovalService } from '../src/governance/approval';
import { buildToolsCenter as canonicalBuildToolsCenter } from '../src/governance/runtime-governance';
import { SandboxProviderRegistry as CanonicalSandboxProviderRegistry } from '../src/sandbox';
import { ExecutionWatchdog as CanonicalExecutionWatchdog } from '../src/watchdog';
import * as toolsExports from '@agent/tools';

describe('@agent/runtime governance boundary', () => {
  it('owns governance, sandbox, and watchdog exports without relying on tools compat bridges', () => {
    expect(ApprovalService).toBe(CanonicalApprovalService);
    expect(SandboxProviderRegistry).toBe(CanonicalSandboxProviderRegistry);
    expect(ExecutionWatchdog).toBe(CanonicalExecutionWatchdog);
    expect(buildToolsCenter).toBe(canonicalBuildToolsCenter);

    expect(toolsExports).not.toHaveProperty('ApprovalService');
    expect(toolsExports).not.toHaveProperty('SandboxProviderRegistry');
    expect(toolsExports).not.toHaveProperty('ExecutionWatchdog');
    expect(toolsExports).not.toHaveProperty('buildToolsCenter');
  });
});
