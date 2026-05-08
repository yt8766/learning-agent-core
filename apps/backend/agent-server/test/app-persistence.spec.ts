import { describe, expect, it } from 'vitest';

import type { DynamicModule, Provider } from '@nestjs/common';

import {
  createPersistenceImports,
  resolveBackendPersistenceMode,
  shouldEnablePersistence
} from '../src/app.persistence';

function readTypeOrmOptions(imports: unknown[]): Record<string, unknown> {
  const typeOrmModule = imports[0] as DynamicModule;
  const coreModule = typeOrmModule.imports?.[0] as DynamicModule;
  const optionsProvider = coreModule.providers?.find(
    (provider): provider is Provider & { useValue: Record<string, unknown> } =>
      typeof provider === 'object' &&
      provider !== null &&
      'useValue' in provider &&
      (provider.useValue as Record<string, unknown>).type === 'postgres'
  );

  if (!optionsProvider) {
    throw new Error('TypeORM options provider was not found.');
  }

  return optionsProvider.useValue;
}

describe('agent-server persistence module wiring', () => {
  it('defaults local and test bootstraps to memory persistence', () => {
    expect(resolveBackendPersistenceMode({ NODE_ENV: 'development' })).toBe('memory');
    expect(resolveBackendPersistenceMode({ NODE_ENV: 'test' })).toBe('memory');
    expect(createPersistenceImports({ NODE_ENV: 'test' })).toEqual([]);
  });

  it('enables postgres only when explicitly requested', () => {
    expect(shouldEnablePersistence({ BACKEND_PERSISTENCE: 'postgres', DATABASE_URL: 'postgres://db' })).toBe(true);
    expect(createPersistenceImports({ BACKEND_PERSISTENCE: 'postgres', DATABASE_URL: 'postgres://db' })).toHaveLength(
      2
    );
  });

  it('supports DB_HOST postgres configuration without enabling synchronize', () => {
    const imports = createPersistenceImports({ BACKEND_PERSISTENCE: 'postgres', DB_HOST: 'db.local' });

    expect(readTypeOrmOptions(imports)).toMatchObject({
      host: 'db.local',
      synchronize: false
    });
  });

  it('fails fast when production requests postgres without DATABASE_URL or DB_HOST', () => {
    expect(() => resolveBackendPersistenceMode({ NODE_ENV: 'production', BACKEND_PERSISTENCE: 'postgres' })).toThrow(
      /DATABASE_URL or DB_HOST/
    );
  });

  it('rejects unsupported persistence modes', () => {
    expect(() => resolveBackendPersistenceMode({ BACKEND_PERSISTENCE: 'sqlite' })).toThrow(
      /Unsupported BACKEND_PERSISTENCE mode/
    );
  });

  it('keeps legacy database opt-in for existing tests during migration', () => {
    expect(
      createPersistenceImports({
        NODE_ENV: 'test',
        AGENT_SERVER_ENABLE_DATABASE_IN_TEST: 'true',
        DATABASE_URL: 'postgres://db'
      })
    ).toHaveLength(2);
  });
});
