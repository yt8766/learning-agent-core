import type { SandboxProfileRecord } from './sandbox.types';

export const SANDBOX_PROFILES: SandboxProfileRecord[] = [
  {
    profile: 'readonly',
    description: 'Read-only sandbox profile for controlled workspace and memory reads.',
    writableWorkspace: false,
    networkAccess: 'disabled',
    requiresApproval: false,
    riskClass: 'low'
  },
  {
    profile: 'read-only',
    description: 'Provider-level read-only profile, compatible with readonly governance semantics.',
    writableWorkspace: false,
    networkAccess: 'disabled',
    requiresApproval: false,
    riskClass: 'low'
  },
  {
    profile: 'verification',
    description: 'Provider-level verification profile for safe test and check commands.',
    writableWorkspace: false,
    networkAccess: 'disabled',
    requiresApproval: false,
    riskClass: 'low'
  },
  {
    profile: 'workspace-readonly',
    description: 'Workspace read-only access with no writes and no external network.',
    writableWorkspace: false,
    networkAccess: 'disabled',
    requiresApproval: false,
    riskClass: 'low'
  },
  {
    profile: 'workspace-write',
    description: 'Workspace writes limited by permission scope and denied path policy.',
    writableWorkspace: true,
    networkAccess: 'disabled',
    requiresApproval: false,
    riskClass: 'medium'
  },
  {
    profile: 'network-restricted',
    description: 'Restricted network access through explicit host allowlists.',
    writableWorkspace: false,
    networkAccess: 'restricted',
    requiresApproval: true,
    riskClass: 'high'
  },
  {
    profile: 'browser-automation',
    description: 'Controlled browser automation without access to personal browser profiles.',
    writableWorkspace: false,
    networkAccess: 'restricted',
    requiresApproval: true,
    riskClass: 'high'
  },
  {
    profile: 'release-ops',
    description: 'Release, CI, or remote operations that require explicit approval.',
    writableWorkspace: true,
    networkAccess: 'restricted',
    requiresApproval: true,
    riskClass: 'high'
  },
  {
    profile: 'host',
    description: 'Host-level execution reserved for audited administrator approval.',
    writableWorkspace: true,
    networkAccess: 'enabled',
    requiresApproval: true,
    riskClass: 'critical'
  },
  {
    profile: 'danger-full-access',
    description: 'Full-access provider profile treated as critical host-level execution.',
    writableWorkspace: true,
    networkAccess: 'enabled',
    requiresApproval: true,
    riskClass: 'critical'
  }
];
