import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  LocalProcessSandboxProvider,
  SandboxProviderRegistry,
  SimulatedSandboxProvider,
  type SandboxProfile
} from '@agent/tools';

import type { SandboxPermissionScope, SandboxRunRecord } from './sandbox.types';

export function normalizePermissionScope(scope?: Partial<SandboxPermissionScope>): SandboxPermissionScope {
  return {
    workspaceRoot: scope?.workspaceRoot,
    allowedPaths: scope?.allowedPaths ?? [],
    deniedPaths: scope?.deniedPaths ?? [],
    allowedHosts: scope?.allowedHosts ?? [],
    deniedHosts: scope?.deniedHosts ?? [],
    allowedCommands: scope?.allowedCommands ?? [],
    deniedCommands: scope?.deniedCommands ?? []
  };
}

export function resolveDeniedReason(
  commandPreview: string | undefined,
  inputPreview: string | undefined,
  scope: SandboxPermissionScope
): { reasonCode: string; reason: string } | undefined {
  const preview = `${commandPreview ?? ''}\n${inputPreview ?? ''}`;
  const deniedPath = scope.deniedPaths.find(path => preview.includes(path));
  if (deniedPath) {
    return {
      reasonCode: 'sandbox_denied_path',
      reason: `Sandbox policy denied access to ${deniedPath}`
    };
  }
  const deniedCommand = scope.deniedCommands.find(command => commandPreview?.split(/\s+/).includes(command));
  if (deniedCommand) {
    return {
      reasonCode: 'sandbox_denied_command',
      reason: `Sandbox policy denied command ${deniedCommand}`
    };
  }
  return undefined;
}

export function buildRun(args: {
  runId: string;
  now: string;
  input: {
    requestId?: string;
    taskId: string;
    sessionId?: string;
    profile: string;
    metadata?: Record<string, unknown>;
  };
  stage?: SandboxRunRecord['stage'];
  status: SandboxRunRecord['status'];
  verdict: SandboxRunRecord['verdict'];
  outputPreview: string;
  metadata?: Record<string, unknown>;
}): SandboxRunRecord {
  return {
    runId: args.runId,
    requestId: args.input.requestId,
    taskId: args.input.taskId,
    sessionId: args.input.sessionId,
    profile: args.input.profile,
    stage: args.stage ?? 'preflight',
    status: args.status,
    attempt: 1,
    maxAttempts: 1,
    verdict: args.verdict,
    outputPreview: args.outputPreview,
    evidenceIds: [],
    artifactIds: [],
    createdAt: args.now,
    updatedAt: args.now,
    metadata: args.metadata ?? {}
  };
}

export function createDefaultSandboxProviderRegistry(): SandboxProviderRegistry {
  const registry = new SandboxProviderRegistry();
  registry.register(new LocalProcessSandboxProvider());
  registry.register(new SimulatedSandboxProvider());
  return registry;
}

export function toProviderProfile(profile: string): SandboxProfile | undefined {
  if (profile === 'readonly' || profile === 'read-only' || profile === 'workspace-readonly') {
    return 'readonly';
  }

  if (profile === 'verification') {
    return 'verification';
  }

  if (profile === 'workspace-write') {
    return 'workspace-write';
  }

  if (profile === 'danger-full-access') {
    return 'unrestricted';
  }

  return undefined;
}

const BLOCKED_METADATA_KEYS = new Set(['rawInput', 'rawOutput', 'input', 'stdout', 'stderr', 'vendor', 'command']);

export function sanitizeExecutionMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (BLOCKED_METADATA_KEYS.has(key) || !isSafeMetadataValue(value)) {
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export function buildApproval(runId: string) {
  return {
    approvalId: `approval_${runId}`,
    interruptId: `interrupt_${runId}`,
    resumeEndpoint: `/api/sandbox/runs/${runId}/approval`
  };
}

export function assertNotTerminal(run: SandboxRunRecord, terminalStatuses: ReadonlySet<string>): void {
  if (terminalStatuses.has(run.status)) {
    throw new ConflictException({
      code: 'sandbox_run_conflict',
      message: `Sandbox run ${run.runId} is already terminal`,
      runId: run.runId,
      status: run.status
    });
  }
}

export function assertNonEmptyId(runId: string): void {
  if (runId.length === 0) {
    throw new BadRequestException({
      code: 'sandbox_preflight_invalid',
      message: 'Sandbox run id must not be empty'
    });
  }
}

export function parseOrThrow<T>(schema: { parse: (value: unknown) => T }, body: unknown, code: string): T {
  try {
    return schema.parse(body);
  } catch (error) {
    throw new BadRequestException({
      code,
      message: 'Invalid sandbox request body',
      issues: error instanceof Error ? error.message : String(error)
    });
  }
}

function isSafeMetadataValue(value: unknown): boolean {
  return value === undefined || value === null || ['string', 'number', 'boolean'].includes(typeof value);
}
