import { describe, expect, it } from 'vitest';

import { LocalProcessSandboxProvider } from '@agent/runtime';

describe('LocalProcessSandboxProvider', () => {
  it('executes readonly commands as argv without shell expansion', async () => {
    const provider = new LocalProcessSandboxProvider();

    const result = await provider.run({
      command: 'pwd',
      profile: 'readonly',
      cwd: process.cwd()
    });

    expect(result.ok).toBe(true);
    expect(result.rawOutput).toMatchObject({ command: { executable: 'pwd', args: [] } });
  });

  it('rejects write and unrestricted profiles before spawning', async () => {
    const provider = new LocalProcessSandboxProvider();

    await expect(
      provider.run({
        command: 'echo no',
        profile: 'workspace-write',
        cwd: process.cwd()
      })
    ).resolves.toMatchObject({
      ok: false,
      errorMessage: 'Local process sandbox only supports readonly and verification profiles'
    });
  });

  it('rejects shell metacharacters instead of passing them to a shell', async () => {
    const provider = new LocalProcessSandboxProvider();

    await expect(
      provider.run({
        command: 'pwd > /tmp/agent-tools-sandbox-leak',
        profile: 'readonly',
        cwd: process.cwd()
      })
    ).resolves.toMatchObject({
      ok: false,
      errorMessage: 'Local process sandbox only executes parsed argv commands without shell operators'
    });
  });

  it('rejects node eval commands even under verification profile', async () => {
    const provider = new LocalProcessSandboxProvider();

    await expect(
      provider.run({
        command: "node -e \"require('fs').writeFileSync('/tmp/agent-tools-sandbox-leak', 'x')\"",
        profile: 'verification',
        cwd: process.cwd()
      })
    ).resolves.toMatchObject({
      ok: false,
      errorMessage: 'The selected command profile only allows readonly and verification commands.'
    });
  });

  it('rejects destructive command arguments that hide behind readonly executables', async () => {
    const provider = new LocalProcessSandboxProvider();

    await expect(
      provider.run({
        command: 'find . -delete',
        profile: 'readonly',
        cwd: process.cwd()
      })
    ).resolves.toMatchObject({
      ok: false,
      errorMessage: 'Destructive commands are denied.'
    });
  });

  it('normalizes host spawn errors instead of returning raw process failures', async () => {
    const provider = new LocalProcessSandboxProvider();

    const result = await provider.run({
      command: 'pwd',
      profile: 'readonly',
      cwd: '/definitely/not/a/real/workspace'
    });

    expect(result).toMatchObject({
      ok: false,
      exitCode: 1,
      outputSummary: 'Local process sandbox command failed',
      errorMessage: 'Local process sandbox command failed',
      rawOutput: {
        error: {
          code: 'sandbox_provider_error',
          provider: 'local-process',
          reason: 'spawn_failed',
          hostErrorCode: 'ENOENT'
        }
      }
    });
    expect(JSON.stringify(result.rawOutput)).not.toContain('/definitely/not/a/real/workspace');
  });
});
