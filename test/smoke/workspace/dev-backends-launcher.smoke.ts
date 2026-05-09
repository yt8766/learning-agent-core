import { describe, expect, it } from 'vitest';

import packageJson from '../../../package.json';
import turboJson from '../../../turbo.json';
import agentServerPackageJson from '../../../apps/backend/agent-server/package.json';

describe('dev backend launcher', () => {
  it('starts only the unified agent-server backend from the root scripts', () => {
    expect(packageJson.scripts['start:dev']).toBe('pnpm build:lib && turbo run start:dev --filter=server');
    expect(packageJson.scripts['start:dev:backends']).toBeUndefined();

    expect(turboJson.tasks['start:dev']).toEqual({
      persistent: true,
      cache: false,
      dependsOn: ['^start:dev'],
      outputs: ['dist/**/*']
    });

    expect(agentServerPackageJson.scripts['start:dev']).toBe('nest start --watch');
  });
});
