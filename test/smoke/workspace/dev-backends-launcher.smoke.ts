import { describe, expect, it } from 'vitest';

import packageJson from '../../../package.json';
import turboJson from '../../../turbo.json';
import agentServerPackageJson from '../../../apps/backend/agent-server/package.json';

describe('dev backend launcher', () => {
  it('starts only the unified agent-server backend from the root scripts', () => {
    expect(packageJson.scripts['start:dev']).toBe('pnpm build:lib && turbo run dev:backend --filter=server');
    expect(packageJson.scripts['start:dev:backends']).toBe(packageJson.scripts['start:dev']);

    expect(turboJson.tasks['dev:backend']).toEqual({
      persistent: true,
      cache: false
    });

    expect(agentServerPackageJson.scripts['dev:backend']).toBe('nest start --watch');
  });
});
