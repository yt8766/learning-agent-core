import { describe, expect, it } from 'vitest';

import {
  LocalProcessSandboxProvider,
  SandboxPolicy,
  SandboxProviderRegistry,
  SimulatedSandboxProvider
} from '@agent/runtime';

describe('SandboxProviderRegistry', () => {
  it('selects the first provider accepted by the sandbox policy', () => {
    const registry = new SandboxProviderRegistry();
    registry.register(new LocalProcessSandboxProvider());
    registry.register(new SimulatedSandboxProvider());

    const provider = registry.resolve({
      profile: 'readonly',
      capability: 'command',
      policy: new SandboxPolicy({ allowedProfiles: ['readonly'] })
    });

    expect(provider?.id).toBe('local-process');
  });

  it('runs simulated commands without touching the host process', async () => {
    const provider = new SimulatedSandboxProvider();

    const result = await provider.run({
      command: 'pnpm test',
      profile: 'verification',
      cwd: '/workspace'
    });

    expect(result).toMatchObject({
      ok: true,
      exitCode: 0,
      outputSummary: 'Simulated sandbox accepted verification command'
    });
  });
});
