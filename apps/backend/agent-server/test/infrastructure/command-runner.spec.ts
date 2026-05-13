import { describe, expect, it } from 'vitest';

import { runExternalCommand } from '../../src/infrastructure/external-process/command-runner';

describe('runExternalCommand', () => {
  it('resolves with stdout and stderr on success', async () => {
    const result = await runExternalCommand({
      command: 'echo',
      args: ['hello']
    });

    expect(result.stdout.trim()).toBe('hello');
    expect(typeof result.stderr).toBe('string');
  });

  it('rejects when the command fails', async () => {
    await expect(
      runExternalCommand({
        command: 'false',
        args: []
      })
    ).rejects.toThrow();
  });

  it('rejects when the command does not exist', async () => {
    await expect(
      runExternalCommand({
        command: 'non-existent-command-12345',
        args: []
      })
    ).rejects.toThrow();
  });

  it('respects custom timeout', async () => {
    const result = await runExternalCommand({
      command: 'echo',
      args: ['timeout-test'],
      timeoutMs: 5000
    });

    expect(result.stdout.trim()).toBe('timeout-test');
  });
});
