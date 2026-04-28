import { describe, expect, it } from 'vitest';

import { ApprovalService, buildToolsCenter, ExecutionWatchdog, SandboxProviderRegistry } from '../src';
import { ApprovalService as CanonicalApprovalService } from '../src/governance/approval';
import { buildToolsCenter as canonicalBuildToolsCenter } from '../src/governance/runtime-governance';
import { SandboxProviderRegistry as CanonicalSandboxProviderRegistry } from '../src/sandbox';
import { ExecutionWatchdog as CanonicalExecutionWatchdog } from '../src/watchdog';
import {
  ApprovalService as ToolsApprovalService,
  buildToolsCenter as toolsBuildToolsCenter,
  ExecutionWatchdog as ToolsExecutionWatchdog,
  SandboxProviderRegistry as ToolsSandboxProviderRegistry
} from '@agent/tools';

describe('@agent/runtime governance boundary', () => {
  it('owns governance, sandbox, and watchdog exports while tools remains a compat bridge', () => {
    expect(ApprovalService).toBe(CanonicalApprovalService);
    expect(SandboxProviderRegistry).toBe(CanonicalSandboxProviderRegistry);
    expect(ExecutionWatchdog).toBe(CanonicalExecutionWatchdog);
    expect(buildToolsCenter).toBe(canonicalBuildToolsCenter);

    expect(ToolsApprovalService).toBe(CanonicalApprovalService);
    expect(ToolsSandboxProviderRegistry).toBe(CanonicalSandboxProviderRegistry);
    expect(ToolsExecutionWatchdog).toBe(CanonicalExecutionWatchdog);
    expect(toolsBuildToolsCenter).toBe(canonicalBuildToolsCenter);
  });
});
