import { describe, expect, it } from 'vitest';

import packageJson from '../../../package.json';
import turboJson from '../../../turbo.json';
import agentServerPackageJson from '../../../apps/backend/agent-server/package.json';
import authServerPackageJson from '../../../apps/backend/auth-server/package.json';
import knowledgeServerPackageJson from '../../../apps/backend/knowledge-server/package.json';

describe('dev backend launcher', () => {
  it('uses Turbo filters to start all backend services from the root start:dev script', () => {
    expect(packageJson.scripts['start:dev']).toBe(
      'pnpm build:lib && turbo run dev:backend --filter=@agent/auth-server --filter=@agent/knowledge-server --filter=server'
    );
    expect(packageJson.scripts['start:dev:backends']).toBe(packageJson.scripts['start:dev']);

    expect(turboJson.tasks['dev:backend']).toEqual({
      persistent: true,
      cache: false
    });

    expect(authServerPackageJson.scripts['dev:backend']).toBe('nest start --watch');
    expect(knowledgeServerPackageJson.scripts['dev:backend']).toBe('nest start --watch');
    expect(agentServerPackageJson.scripts['dev:backend']).toBe('nest start --watch');
  });
});
