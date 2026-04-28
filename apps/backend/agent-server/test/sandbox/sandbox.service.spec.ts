import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  SandboxProviderRegistry,
  SimulatedSandboxProvider,
  type SandboxProvider,
  type ToolExecutionResult
} from '@agent/runtime';
import { beforeEach, describe, expect, it } from 'vitest';

import { SandboxRepository } from '../../src/sandbox/sandbox.repository';
import { SandboxService } from '../../src/sandbox/sandbox.service';

describe('SandboxService', () => {
  let service: SandboxService;

  beforeEach(() => {
    service = new SandboxService(new SandboxRepository());
  });

  it('lists the documented core sandbox profiles with safe summaries', () => {
    const profiles = service.listProfiles();

    expect(profiles.map(profile => profile.profile)).toEqual(
      expect.arrayContaining([
        'readonly',
        'workspace-readonly',
        'workspace-write',
        'network-restricted',
        'browser-automation',
        'release-ops',
        'host',
        'danger-full-access'
      ])
    );
    expect(profiles.find(profile => profile.profile === 'workspace-write')).toEqual(
      expect.objectContaining({
        profile: 'workspace-write',
        writableWorkspace: true,
        requiresApproval: false,
        riskClass: 'medium'
      })
    );
    expect(profiles.find(profile => profile.profile === 'host')).toEqual(
      expect.objectContaining({
        profile: 'host',
        requiresApproval: true,
        riskClass: 'critical'
      })
    );
  });

  it('allows low risk workspace-write preflight and preserves metadata paths', () => {
    const response = service.preflight({
      sessionId: 'session-allow',
      taskId: 'task-allow',
      requestId: 'request-allow',
      toolName: 'edit_file',
      profile: 'workspace-write',
      riskClass: 'low',
      permissionScope: {
        workspaceRoot: '/workspace',
        allowedPaths: ['/workspace/apps/backend/agent-server/src/sandbox'],
        deniedPaths: ['/workspace/.env']
      },
      metadata: {
        path: 'apps/backend/agent-server/src/sandbox/sandbox.service.ts',
        nested: { path: 'apps/backend/agent-server/test/sandbox/sandbox.service.spec.ts' }
      }
    });

    expect(response).toEqual(
      expect.objectContaining({
        decision: 'allow',
        reasonCode: 'sandbox_policy_allowed',
        profile: 'workspace-write',
        requiresApproval: false
      })
    );
    expect(response.run).toEqual(
      expect.objectContaining({
        runId: expect.stringMatching(/^sandbox_run_/),
        requestId: 'request-allow',
        taskId: 'task-allow',
        sessionId: 'session-allow',
        status: 'passed',
        verdict: 'allow',
        metadata: {
          path: 'apps/backend/agent-server/src/sandbox/sandbox.service.ts',
          nested: { path: 'apps/backend/agent-server/test/sandbox/sandbox.service.spec.ts' }
        }
      })
    );
    expect(service.getRun(response.run.runId)).toEqual(response.run);
  });

  it('blocks host, release, danger and high risk runs with approval projection', () => {
    const response = service.preflight({
      sessionId: 'session-approval',
      taskId: 'task-approval',
      requestId: 'request-approval',
      toolName: 'run_terminal',
      profile: 'release-ops',
      riskClass: 'high',
      commandPreview: 'git push origin feature/sandbox'
    });

    expect(response.decision).toBe('require_approval');
    expect(response.reasonCode).toBe('sandbox_approval_required');
    expect(response.requiresApproval).toBe(true);
    expect(response.run.status).toBe('blocked');
    expect(response.run.verdict).toBe('block');
    expect(response.approval).toEqual({
      approvalId: `approval_${response.run.runId}`,
      interruptId: `interrupt_${response.run.runId}`,
      resumeEndpoint: `/api/sandbox/runs/${response.run.runId}/approval`
    });
  });

  it('denies preflight when denied paths or commands are requested', () => {
    expect(() =>
      service.preflight({
        taskId: 'task-denied-path',
        toolName: 'read_file',
        profile: 'readonly',
        permissionScope: {
          allowedPaths: ['/workspace'],
          deniedPaths: ['/workspace/private.key']
        },
        inputPreview: 'Read /workspace/private.key'
      })
    ).toThrow(ForbiddenException);

    try {
      service.preflight({
        taskId: 'task-denied-command',
        toolName: 'run_terminal',
        profile: 'workspace-write',
        commandPreview: 'rm -rf /workspace/build',
        permissionScope: {
          deniedCommands: ['rm']
        }
      });
      throw new Error('expected deny');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(
        expect.objectContaining({
          code: 'sandbox_policy_denied',
          reasonCode: 'sandbox_denied_command'
        })
      );
    }
  });

  it('executes readonly and verification commands through the sandbox provider boundary', async () => {
    const readonlyRun = await service.executeCommand({
      sessionId: 'session-execute-readonly',
      taskId: 'task-execute-readonly',
      requestId: 'request-execute-readonly',
      command: 'pwd',
      profile: 'readonly',
      cwd: process.cwd(),
      timeoutMs: 1_000,
      metadata: {
        actor: 'test',
        rawOutput: 'must not be persisted',
        nested: { rawOutput: 'must not be persisted' }
      }
    });
    const verificationRun = await service.executeCommand({
      taskId: 'task-execute-verification',
      command: 'pnpm exec vitest --version',
      profile: 'verification',
      cwd: process.cwd()
    });

    expect(readonlyRun).toEqual(
      expect.objectContaining({
        requestId: 'request-execute-readonly',
        taskId: 'task-execute-readonly',
        sessionId: 'session-execute-readonly',
        profile: 'readonly',
        stage: 'execution',
        status: 'passed',
        verdict: 'allow',
        outputPreview: 'Local process sandbox completed command'
      })
    );
    expect(readonlyRun.metadata).toEqual({
      actor: 'test',
      providerId: 'local-process',
      exitCode: 0,
      durationMs: expect.any(Number)
    });
    expect(JSON.stringify(readonlyRun.metadata)).not.toContain('rawOutput');
    expect(service.getRun(readonlyRun.runId)).toEqual(readonlyRun);
    expect(verificationRun).toEqual(
      expect.objectContaining({
        profile: 'verification',
        stage: 'execution',
        status: 'passed',
        verdict: 'allow',
        outputPreview: 'Local process sandbox completed command'
      })
    );
  });

  it('records provider policy blocks as failed block runs without throwing raw output', async () => {
    const run = await service.executeCommand({
      taskId: 'task-execute-denied-operator',
      command: 'pwd > /tmp/agent-tools-sandbox-leak',
      profile: 'readonly',
      cwd: process.cwd(),
      metadata: {
        source: 'unit-test',
        rawOutput: { secret: 'do not persist' },
        stdout: 'do not persist'
      }
    });

    expect(run).toEqual(
      expect.objectContaining({
        taskId: 'task-execute-denied-operator',
        profile: 'readonly',
        stage: 'execution',
        status: 'failed',
        verdict: 'block',
        outputPreview: 'Local process sandbox rejected command by policy'
      })
    );
    expect(run.metadata).toEqual({
      source: 'unit-test',
      providerId: 'local-process',
      exitCode: 1,
      durationMs: expect.any(Number),
      errorMessage: 'Local process sandbox only executes parsed argv commands without shell operators'
    });
    expect(JSON.stringify(run.metadata)).not.toContain('do not persist');
  });

  it('blocks high risk command profiles before provider execution', async () => {
    const registry = new SandboxProviderRegistry();
    const provider = new CountingSandboxProvider();
    registry.register(provider);
    registry.register(new SimulatedSandboxProvider());
    const guardedService = new SandboxService(new SandboxRepository(), registry);

    const hostRun = await guardedService.executeCommand({
      sessionId: 'session-host',
      taskId: 'task-host',
      requestId: 'request-host',
      command: 'pwd',
      profile: 'host',
      cwd: process.cwd()
    });

    expect(hostRun).toEqual(
      expect.objectContaining({
        requestId: 'request-host',
        taskId: 'task-host',
        sessionId: 'session-host',
        profile: 'host',
        stage: 'execution',
        status: 'blocked',
        verdict: 'block',
        outputPreview: 'Sandbox profile or risk class requires approval before execution.'
      })
    );
    expect(hostRun.metadata).toEqual(
      expect.objectContaining({
        approvalId: `approval_${hostRun.runId}`,
        interruptId: `interrupt_${hostRun.runId}`,
        resumeEndpoint: `/api/sandbox/runs/${hostRun.runId}/approval`,
        reasonCode: 'sandbox_approval_required'
      })
    );
    expect(provider.runCount).toBe(0);
  });

  it('gets runs by id and reports missing runs using sandbox_run_not_found', () => {
    const response = service.preflight({
      taskId: 'task-get',
      toolName: 'read_file',
      profile: 'readonly',
      inputPreview: 'README.md'
    });

    expect(service.getRun(response.run.runId)).toEqual(response.run);
    expect(() => service.getRun('missing-run')).toThrow(NotFoundException);
    try {
      service.getRun('missing-run');
      throw new Error('expected not found');
    } catch (error) {
      expect((error as NotFoundException).getResponse()).toEqual(
        expect.objectContaining({ code: 'sandbox_run_not_found', runId: 'missing-run' })
      );
    }
  });

  it('rejects empty route and body ids using sandbox_preflight_invalid', () => {
    expectInvalidSandboxRequest(() => service.getRun(''));
    expectInvalidSandboxRequest(() => service.cancelRun('', { actor: 'human' }));
    expectInvalidSandboxRequest(() =>
      service.resumeApproval('', {
        sessionId: 'session-empty-route',
        interrupt: { action: 'approve', runId: 'sandbox-run-1' }
      })
    );
    expectInvalidSandboxRequest(() =>
      service.preflight({
        sessionId: '',
        taskId: 'task-empty-session',
        toolName: 'read_file',
        profile: 'readonly'
      })
    );
    expectInvalidSandboxRequest(() =>
      service.preflight({
        taskId: '',
        toolName: 'read_file',
        profile: 'readonly'
      })
    );
    expectInvalidSandboxRequest(() =>
      service.cancelRun('sandbox-run-1', {
        sessionId: '',
        taskId: ''
      })
    );
    expectInvalidSandboxRequest(() =>
      service.resumeApproval('sandbox-run-1', {
        sessionId: '',
        interrupt: { action: 'approve', runId: 'sandbox-run-1' }
      })
    );
  });

  it('cancels non-terminal runs and rejects repeated or terminal cancels with conflict', () => {
    const response = service.preflight({
      taskId: 'task-cancel',
      toolName: 'run_terminal',
      profile: 'host',
      riskClass: 'critical'
    });

    const cancelled = service.cancelRun(response.run.runId, {
      sessionId: 'session-cancel',
      actor: 'human',
      reason: 'no longer needed'
    });

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.metadata).toEqual(
      expect.objectContaining({
        cancelledBy: 'human',
        cancelReason: 'no longer needed'
      })
    );
    expect(() => service.cancelRun(response.run.runId, {})).toThrow(ConflictException);
    expect(() =>
      service.cancelRun(
        service.preflight({ taskId: 'task-terminal', toolName: 'read_file', profile: 'readonly' }).run.runId,
        {}
      )
    ).toThrow(ConflictException);

    try {
      service.cancelRun(response.run.runId, {});
      throw new Error('expected conflict');
    } catch (error) {
      expect((error as ConflictException).getResponse()).toEqual(
        expect.objectContaining({
          code: 'sandbox_run_conflict',
          runId: response.run.runId,
          status: 'cancelled'
        })
      );
    }
  });

  it('rejects approval resume route and approval id mismatches with sandbox_preflight_invalid', () => {
    const run = service.preflight({
      sessionId: 'session-mismatch',
      taskId: 'task-mismatch',
      toolName: 'run_terminal',
      profile: 'host',
      riskClass: 'critical'
    }).run;

    expectInvalidSandboxRequest(() =>
      service.resumeApproval(run.runId, {
        sessionId: 'session-mismatch',
        interrupt: {
          action: 'approve',
          runId: 'different-run',
          approvalId: `approval_${run.runId}`
        }
      })
    );
    expectInvalidSandboxRequest(() =>
      service.resumeApproval(run.runId, {
        sessionId: 'session-mismatch',
        interrupt: {
          action: 'approve',
          runId: run.runId,
          approvalId: 'approval_different-run'
        }
      })
    );
  });

  it('applies approval approve/bypass and reject/abort actions to blocked runs', () => {
    const approveRun = service.preflight({
      sessionId: 'session-approve',
      taskId: 'task-approve',
      toolName: 'run_terminal',
      profile: 'host',
      riskClass: 'critical'
    }).run;
    const approved = service.resumeApproval(approveRun.runId, {
      sessionId: 'session-approve',
      actor: 'reviewer',
      reason: 'approved for test',
      interrupt: {
        action: 'approve',
        runId: approveRun.runId,
        approvalId: `approval_${approveRun.runId}`,
        feedback: 'ship it'
      }
    });

    expect(approved.status).toBe('passed');
    expect(approved.verdict).toBe('allow');
    expect(approved.metadata).toEqual(
      expect.objectContaining({
        approvedBy: 'reviewer',
        approvalReason: 'approved for test',
        feedback: 'ship it'
      })
    );

    const rejectRun = service.preflight({
      taskId: 'task-reject',
      toolName: 'run_terminal',
      profile: 'release-ops',
      riskClass: 'high'
    }).run;
    const rejected = service.resumeApproval(rejectRun.runId, {
      sessionId: 'session-reject',
      actor: 'reviewer',
      interrupt: { action: 'reject', runId: rejectRun.runId, feedback: 'unsafe command' }
    });

    expect(rejected.status).toBe('cancelled');
    expect(rejected.verdict).toBe('block');
    expect(rejected.metadata).toEqual(expect.objectContaining({ feedback: 'unsafe command' }));
  });

  it('keeps feedback and input actions observable while preserving updatedAt and metadata', () => {
    const response = service.preflight({
      taskId: 'task-feedback',
      toolName: 'run_terminal',
      profile: 'host',
      riskClass: 'critical',
      metadata: { original: true }
    });
    const updated = service.resumeApproval(response.run.runId, {
      sessionId: 'session-feedback',
      actor: 'reviewer',
      interrupt: {
        action: 'feedback',
        runId: response.run.runId,
        feedback: 'please narrow the path',
        payload: { reasonCode: 'needs_scope' }
      }
    });

    expect(updated.status).toBe('blocked');
    expect(updated.updatedAt >= response.run.updatedAt).toBe(true);
    expect(updated.metadata).toEqual(
      expect.objectContaining({
        original: true,
        feedback: 'please narrow the path',
        approvalAction: 'feedback',
        approvalPayload: { reasonCode: 'needs_scope' }
      })
    );
  });

  it('validates request bodies with zod and uses sandbox_preflight_invalid', () => {
    expect(() => service.preflight({ taskId: 'missing-tool' })).toThrow(BadRequestException);
    try {
      service.preflight({ taskId: 'missing-tool' });
      throw new Error('expected invalid request');
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ code: 'sandbox_preflight_invalid' })
      );
    }
  });
});

class CountingSandboxProvider implements SandboxProvider {
  readonly id = 'counting';
  readonly supportedProfiles = ['readonly', 'verification'] as const;
  readonly supportedCapabilities = ['command'] as const;
  runCount = 0;

  canRun(): boolean {
    return true;
  }

  async run(): Promise<ToolExecutionResult> {
    this.runCount += 1;
    return {
      ok: true,
      outputSummary: 'counting provider ran',
      rawOutput: { unsafe: true },
      exitCode: 0,
      durationMs: 1
    };
  }
}

function expectInvalidSandboxRequest(action: () => unknown): void {
  try {
    action();
    throw new Error('expected invalid sandbox request');
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ code: 'sandbox_preflight_invalid' })
    );
  }
}
