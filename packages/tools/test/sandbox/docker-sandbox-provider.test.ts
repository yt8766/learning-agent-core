import { describe, expect, it, vi } from 'vitest';

import {
  buildDockerSandboxCommandPlan,
  createDockerSandboxProviderPlugin,
  DockerSandboxProvider,
  SandboxPolicy,
  SandboxProviderRegistry
} from '../../src/sandbox';

describe('DockerSandboxProvider', () => {
  it('builds readonly docker argv with a replaceable image and read-only workspace mount', () => {
    const plan = buildDockerSandboxCommandPlan(
      {
        command: 'pnpm test',
        profile: 'readonly',
        cwd: '/repo',
        timeoutMs: 12_000
      },
      { image: 'busybox:1.36' }
    );

    expect(plan).toMatchObject({
      executable: 'docker',
      image: 'busybox:1.36',
      profile: 'readonly',
      timeoutMs: 12_000,
      readonlyMount: true
    });
    expect(plan.args).toEqual([
      'run',
      '--rm',
      '--network',
      'none',
      '-w',
      '/workspace',
      '-v',
      '/repo:/workspace:ro',
      'busybox:1.36',
      'sh',
      '-lc',
      'pnpm test'
    ]);
  });

  it('maps verification to read-only mounts and workspace-write to writable mounts', () => {
    const verificationPlan = buildDockerSandboxCommandPlan({
      command: 'pnpm verify',
      profile: 'verification',
      cwd: '/repo'
    });
    const writePlan = buildDockerSandboxCommandPlan({
      command: 'pnpm exec prettier --write packages/tools/src/sandbox/index.ts',
      profile: 'workspace-write',
      cwd: '/repo'
    });

    expect(verificationPlan.args).toContain('/repo:/workspace:ro');
    expect(verificationPlan.readonlyMount).toBe(true);
    expect(writePlan.args).toContain('/repo:/workspace');
    expect(writePlan.args).not.toContain('/repo:/workspace:ro');
    expect(writePlan.readonlyMount).toBe(false);
  });

  it('does not support unrestricted profile', async () => {
    const runner = vi.fn();
    const provider = new DockerSandboxProvider({ runner });

    expect(provider.canRun({ profile: 'unrestricted', capability: 'command' })).toBe(false);
    await expect(
      provider.run({
        command: 'pwd',
        profile: 'unrestricted',
        cwd: '/repo'
      })
    ).resolves.toMatchObject({
      ok: false,
      errorMessage: 'Docker sandbox does not support unrestricted profile'
    });
    expect(runner).not.toHaveBeenCalled();
  });

  it('runs through the injected runner and preserves stdout stderr exitCode raw output', async () => {
    const runner = vi.fn().mockResolvedValue({
      stdout: 'ok\n',
      stderr: 'warn\n',
      exitCode: 2
    });
    const provider = new DockerSandboxProvider({ image: 'node:22-alpine', runner });

    const result = await provider.run({
      command: 'pnpm test',
      profile: 'verification',
      cwd: '/repo',
      timeoutMs: 500
    });

    expect(result).toMatchObject({
      ok: false,
      exitCode: 2,
      outputSummary: 'Docker sandbox command failed',
      rawOutput: {
        stdout: 'ok\n',
        stderr: 'warn\n',
        plan: {
          image: 'node:22-alpine',
          timeoutMs: 500
        }
      }
    });
    expect(runner).toHaveBeenCalledWith(expect.objectContaining({ executable: 'docker' }));
  });

  it('returns timeout and spawn failure errors without requiring docker to be installed', async () => {
    const timeoutError = Object.assign(new Error('Docker sandbox command timed out'), { code: 124 });
    const provider = new DockerSandboxProvider({
      runner: vi.fn().mockRejectedValue(timeoutError)
    });

    await expect(
      provider.run({
        command: 'pnpm test',
        profile: 'verification',
        cwd: '/repo',
        timeoutMs: 1
      })
    ).resolves.toMatchObject({
      ok: false,
      exitCode: 124,
      outputSummary: 'Docker sandbox command failed',
      errorMessage: 'Docker sandbox command timed out'
    });
  });

  it('normalizes runner errors instead of exposing host Error objects', async () => {
    const hostError = Object.assign(new Error('spawn docker ENOENT'), { code: 'ENOENT' });
    const provider = new DockerSandboxProvider({
      runner: vi.fn().mockRejectedValue(hostError)
    });

    const result = await provider.run({
      command: 'pnpm test',
      profile: 'verification',
      cwd: '/repo'
    });

    expect(result).toMatchObject({
      ok: false,
      exitCode: 1,
      outputSummary: 'Docker sandbox command failed',
      errorMessage: 'Docker sandbox command failed',
      rawOutput: {
        error: {
          code: 'sandbox_provider_error',
          provider: 'docker',
          reason: 'runner_failed',
          hostErrorCode: 'ENOENT'
        }
      }
    });
    expect(result.rawOutput).not.toBe(hostError);
  });

  it('registers through a plugin and respects SandboxPolicy profile allow-lists', () => {
    const registry = new SandboxProviderRegistry();
    registry.install(createDockerSandboxProviderPlugin({ runner: vi.fn(), image: 'busybox' }));

    expect(
      registry.resolve({
        profile: 'workspace-write',
        capability: 'command'
      })
    ).toBeUndefined();
    expect(
      registry.resolve({
        profile: 'workspace-write',
        capability: 'command',
        policy: new SandboxPolicy({ allowedProfiles: ['workspace-write'] })
      })?.id
    ).toBe('docker');
  });
});
