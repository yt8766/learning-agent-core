import { describe, expect, it } from 'vitest';

import { createPersistenceImports } from '../src/app.persistence';

describe('agent-server persistence module wiring', () => {
  it('keeps workspace smoke bootstraps independent from a local Postgres service', () => {
    expect(createPersistenceImports({ NODE_ENV: 'test' })).toEqual([]);
  });

  it('keeps workflow-run persistence enabled outside test smoke bootstraps', () => {
    expect(createPersistenceImports({ NODE_ENV: 'production' })).toHaveLength(2);
  });

  it('allows database-backed test runs to opt in explicitly', () => {
    expect(
      createPersistenceImports({
        NODE_ENV: 'test',
        AGENT_SERVER_ENABLE_DATABASE_IN_TEST: 'true'
      })
    ).toHaveLength(2);
  });
});
