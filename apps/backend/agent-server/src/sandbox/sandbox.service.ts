import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { SandboxPolicy, SandboxProviderRegistry } from '@agent/runtime';

import { SANDBOX_PROFILES } from './sandbox.profiles';
import { SandboxRepository } from './sandbox.repository';
import {
  SandboxApprovalResumeRequestSchema,
  SandboxCancelRequestSchema,
  SandboxExecuteCommandRequestSchema,
  SandboxPreflightRequestSchema
} from './sandbox.schemas';
import {
  assertNonEmptyId,
  assertNotTerminal,
  buildApproval,
  buildRun,
  createDefaultSandboxProviderRegistry,
  normalizePermissionScope,
  parseOrThrow,
  resolveDeniedReason,
  sanitizeExecutionMetadata,
  toProviderProfile
} from './sandbox.service.helpers';
import type { SandboxPreflightResponse, SandboxProfileRecord, SandboxRunRecord } from './sandbox.types';

const HIGH_RISK_PROFILES = new Set(['host', 'danger-full-access', 'release-ops']);
const TERMINAL_STATUSES = new Set(['passed', 'failed', 'cancelled', 'exhausted']);

@Injectable()
export class SandboxService {
  constructor(
    private readonly repository: SandboxRepository,
    @Optional()
    private readonly providerRegistry: SandboxProviderRegistry = createDefaultSandboxProviderRegistry()
  ) {}

  listProfiles(): SandboxProfileRecord[] {
    return SANDBOX_PROFILES.map(profile => ({ ...profile }));
  }

  preflight(body: unknown): SandboxPreflightResponse {
    const input = parseOrThrow(SandboxPreflightRequestSchema, body, 'sandbox_preflight_invalid');
    const profile = this.getProfile(input.profile);
    const normalizedPermissionScope = normalizePermissionScope(input.permissionScope);
    const now = new Date().toISOString();
    const runId = `sandbox_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const deniedReason = resolveDeniedReason(input.commandPreview, input.inputPreview, normalizedPermissionScope);

    if (deniedReason) {
      const run = this.repository.saveRun(
        buildRun({
          runId,
          now,
          input,
          status: 'blocked',
          verdict: 'block',
          outputPreview: deniedReason.reason,
          metadata: input.metadata
        })
      );
      throw new ForbiddenException({
        code: 'sandbox_policy_denied',
        reasonCode: deniedReason.reasonCode,
        message: deniedReason.reason,
        runId: run.runId,
        profile: input.profile
      });
    }

    const requiresApproval =
      profile.requiresApproval ||
      HIGH_RISK_PROFILES.has(profile.profile) ||
      input.riskClass === 'high' ||
      input.riskClass === 'critical';
    const run = this.repository.saveRun(
      buildRun({
        runId,
        now,
        input,
        status: requiresApproval ? 'blocked' : 'passed',
        verdict: requiresApproval ? 'block' : 'allow',
        outputPreview: requiresApproval
          ? 'Sandbox preflight requires approval before execution.'
          : 'Sandbox preflight allowed this execution plan.',
        metadata: input.metadata
      })
    );

    if (requiresApproval) {
      return {
        decision: 'require_approval',
        reasonCode: 'sandbox_approval_required',
        reason: 'Sandbox profile or risk class requires approval before continuing.',
        profile: input.profile,
        normalizedPermissionScope,
        requiresApproval: true,
        run,
        approval: buildApproval(run.runId)
      };
    }

    return {
      decision: 'allow',
      reasonCode: 'sandbox_policy_allowed',
      reason: 'Sandbox policy allowed this execution plan.',
      profile: input.profile,
      normalizedPermissionScope,
      requiresApproval: false,
      run
    };
  }

  async executeCommand(body: unknown): Promise<SandboxRunRecord> {
    const input = parseOrThrow(SandboxExecuteCommandRequestSchema, body, 'sandbox_preflight_invalid');
    const profile = this.getProfile(input.profile);
    const normalizedPermissionScope = normalizePermissionScope(input.permissionScope);
    const now = new Date().toISOString();
    const runId = `sandbox_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const baseRunInput = {
      requestId: input.requestId,
      taskId: input.taskId,
      sessionId: input.sessionId,
      profile: input.profile,
      metadata: input.metadata
    };
    const deniedReason = resolveDeniedReason(input.command, undefined, normalizedPermissionScope);

    if (deniedReason) {
      return this.repository.saveRun(
        buildRun({
          runId,
          now,
          input: baseRunInput,
          stage: 'execution',
          status: 'failed',
          verdict: 'block',
          outputPreview: deniedReason.reason,
          metadata: {
            ...sanitizeExecutionMetadata(input.metadata),
            reasonCode: deniedReason.reasonCode
          }
        })
      );
    }

    if (profile.requiresApproval || HIGH_RISK_PROFILES.has(profile.profile)) {
      const approval = buildApproval(runId);
      return this.repository.saveRun(
        buildRun({
          runId,
          now,
          input: baseRunInput,
          stage: 'execution',
          status: 'blocked',
          verdict: 'block',
          outputPreview: 'Sandbox profile or risk class requires approval before execution.',
          metadata: {
            ...sanitizeExecutionMetadata(input.metadata),
            reasonCode: 'sandbox_approval_required',
            approvalId: approval.approvalId,
            interruptId: approval.interruptId,
            resumeEndpoint: approval.resumeEndpoint
          }
        })
      );
    }

    const providerProfile = toProviderProfile(input.profile);
    const provider = providerProfile
      ? this.providerRegistry.resolve({
          profile: providerProfile,
          capability: 'command',
          policy: new SandboxPolicy({ allowedProfiles: ['readonly', 'verification'] })
        })
      : undefined;

    if (!provider || !providerProfile) {
      return this.repository.saveRun(
        buildRun({
          runId,
          now,
          input: baseRunInput,
          stage: 'execution',
          status: 'failed',
          verdict: 'block',
          outputPreview: 'Sandbox executor is unavailable for this profile.',
          metadata: {
            ...sanitizeExecutionMetadata(input.metadata),
            reasonCode: 'sandbox_executor_unavailable'
          }
        })
      );
    }

    const result = await provider.run({
      command: input.command,
      profile: providerProfile,
      cwd: input.cwd,
      timeoutMs: input.timeoutMs
    });

    return this.repository.saveRun(
      buildRun({
        runId,
        now,
        input: baseRunInput,
        stage: 'execution',
        status: result.ok ? 'passed' : 'failed',
        verdict: result.ok ? 'allow' : 'block',
        outputPreview: result.outputSummary,
        metadata: {
          ...sanitizeExecutionMetadata(input.metadata),
          providerId: provider.id,
          ...(typeof result.exitCode === 'number' ? { exitCode: result.exitCode } : {}),
          ...(typeof result.durationMs === 'number' ? { durationMs: result.durationMs } : {}),
          ...(result.errorMessage ? { errorMessage: result.errorMessage } : {})
        }
      })
    );
  }

  getRun(runId: string): SandboxRunRecord {
    assertNonEmptyId(runId);
    const run = this.repository.getRun(runId);
    if (!run) {
      throw new NotFoundException({
        code: 'sandbox_run_not_found',
        message: `Sandbox run ${runId} not found`,
        runId
      });
    }
    return run;
  }

  cancelRun(runId: string, body: unknown): SandboxRunRecord {
    assertNonEmptyId(runId);
    const input = parseOrThrow(SandboxCancelRequestSchema, body, 'sandbox_preflight_invalid');
    const run = this.getRun(runId);
    assertNotTerminal(run, TERMINAL_STATUSES);
    return this.repository.saveRun({
      ...run,
      status: 'cancelled',
      verdict: 'block',
      updatedAt: new Date().toISOString(),
      metadata: {
        ...run.metadata,
        cancelledBy: input.actor,
        cancelReason: input.reason
      }
    });
  }

  resumeApproval(runId: string, body: unknown): SandboxRunRecord {
    assertNonEmptyId(runId);
    const input = parseOrThrow(SandboxApprovalResumeRequestSchema, body, 'sandbox_preflight_invalid');
    const run = this.getRun(runId);
    if (input.interrupt.runId && input.interrupt.runId !== runId) {
      throw new BadRequestException({
        code: 'sandbox_preflight_invalid',
        message: 'Approval runId must match the route runId',
        runId
      });
    }
    if (input.interrupt.approvalId && input.interrupt.approvalId !== `approval_${runId}`) {
      throw new BadRequestException({
        code: 'sandbox_preflight_invalid',
        message: 'Approval id does not match the sandbox run',
        runId
      });
    }
    assertNotTerminal(run, TERMINAL_STATUSES);

    const baseMetadata = {
      ...run.metadata,
      approvalAction: input.interrupt.action,
      approvalActor: input.actor,
      approvalReason: input.reason,
      approvalPayload: input.interrupt.payload,
      feedback: input.interrupt.feedback
    };
    const updatedAt = new Date().toISOString();

    if (input.interrupt.action === 'approve' || input.interrupt.action === 'bypass') {
      return this.repository.saveRun({
        ...run,
        status: 'passed',
        verdict: 'allow',
        updatedAt,
        metadata: {
          ...baseMetadata,
          approvedBy: input.actor,
          approvalReason: input.reason
        }
      });
    }

    if (input.interrupt.action === 'reject' || input.interrupt.action === 'abort') {
      return this.repository.saveRun({
        ...run,
        status: 'cancelled',
        verdict: 'block',
        updatedAt,
        metadata: baseMetadata
      });
    }

    return this.repository.saveRun({
      ...run,
      status: 'blocked',
      verdict: 'block',
      updatedAt,
      metadata: baseMetadata
    });
  }

  private getProfile(profileName: string): SandboxProfileRecord {
    const profile = SANDBOX_PROFILES.find(item => item.profile === profileName);
    if (!profile) {
      throw new NotFoundException({
        code: 'sandbox_profile_not_found',
        message: `Sandbox profile ${profileName} not found`,
        profile: profileName
      });
    }
    return profile;
  }
}
