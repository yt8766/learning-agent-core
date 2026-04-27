import { describe, expect, it } from 'vitest';

import { CommandPolicy, RawCommandClassifier } from '../../src/command';

describe('CommandPolicy', () => {
  it('allows readonly and verification commands under the safe local profile', () => {
    const policy = new CommandPolicy({ classifier: new RawCommandClassifier(), profile: 'safe-local-readonly' });

    expect(policy.evaluate({ rawCommand: 'ls packages/tools' })).toMatchObject({
      decision: 'allow',
      requiresApproval: false
    });
    expect(policy.evaluate({ rawCommand: 'pnpm test --filter @agent/tools' })).toMatchObject({
      decision: 'allow',
      requiresApproval: false
    });
  });

  it('denies mutating and destructive commands under the safe local profile', () => {
    const policy = new CommandPolicy({ classifier: new RawCommandClassifier(), profile: 'safe-local-readonly' });

    expect(policy.evaluate({ rawCommand: 'pnpm add left-pad' })).toMatchObject({
      decision: 'deny',
      reasonCode: 'profile_disallows_mutation'
    });
    expect(policy.evaluate({ rawCommand: 'git reset --hard HEAD' })).toMatchObject({
      decision: 'deny',
      reasonCode: 'destructive_command'
    });
  });
});
